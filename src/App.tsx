import { AppBar, Box, Button, Icon, Snackbar, TextField, Toolbar, Typography } from '@mui/material'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Room from './components/Room'
import { useSignalingChannel } from './webrtc'
import { useCall, useOnCall } from './webrtc/webRTC'

function App() {
  const [hasCall, setHasCall] = useState<{ room: string, from: string, name: string | undefined }>()
  const [name, setName] = useState('')
  const { isConnected, disconnect } = useSignalingChannel()
  const { makeCall, answerCall, room } = useCall()
  const previousRoom = useRef<Exclude<typeof room, undefined>>()

  useOnCall(payload => setHasCall({ ...payload, name: payload.name }))

  const handleCall = useCallback((remotePeerId?: string, isBroadcast = false) => {
    // TODO: make sure to remove tracks from room before making a new call
    makeCall(remotePeerId || null, { isBroadcast, name })
  }, [makeCall, name])

  const handleAnswerCall = useCallback(() => {
    // TODO: make sure to remove tracks from room before answering a new call
    if (hasCall && name) {
      answerCall({ ...hasCall, name })
    }
  }, [answerCall, hasCall, name])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room && name) {
      answerCall({ room, name })
    }
  }, [answerCall, name])

  const handleSubmitName = useCallback((event: FormEvent) => {
    event.preventDefault()
    setName((event.target as any).elements.name.value)
  }, [])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {name !== '' ? <Box sx={{ display: 'flex' }}>
          <Typography variant="h5">Welcome {name}</Typography>
          &nbsp;&nbsp;
          <Button variant="contained" size="small" color="secondary" onClick={() => disconnect()} disabled={!isConnected}>Disconnect</Button>
        </Box> : <span />}
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {name ? room ? <Room room={room} name={name} onCall={handleCall} /> : <Button onClick={() => handleCall(undefined, true)} size="large" variant="contained" disabled={!isConnected}>Create room</Button> : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} component="form" autoComplete="off" onSubmit={handleSubmitName}>
        <TextField variant="filled" margin="normal" label="Your name" name="name" autoFocus role="presentation" autoComplete="off" />
        <Button variant="contained" size="large" type="submit">Connect</Button>
      </Box>}
    </Box>
    <Snackbar
      open={Boolean(hasCall)}
      onClose={() => setHasCall(undefined)}
      autoHideDuration={60000}
      message={`${hasCall?.name || 'Someone'} is calling you`}
      action={
        <Button onClick={handleAnswerCall} color="success" size="small">
          Accept
        </Button>
      }
      sx={{ bottom: { xs: 90, sm: 0 } }}
    />
  </Box>
}

export default App
