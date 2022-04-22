import { AppBar, Box, Button, Icon, Snackbar, TextField, Toolbar, Typography } from '@mui/material'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import CreateRoom from './components/CreateRoom'
import PrivateCall from './components/PrivateCall'
import Room from './components/Room'
import { useSignalingChannel } from './webrtc'
import { useSignalingEvent } from './webrtc/signalingChannel'

function App() {
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [hasPrivateCaller, setHasPrivateCaller] = useState<string>()
  const [privateCaller, setPrivateCaller] = useState<string>()
  const [name, setName] = useState('')
  const [room, setRoom] = useState('')
  const { isConnected, call, me, ...signalingChannel } = useSignalingChannel()

  useSignalingEvent('onCall', ({ from, room }) => {
    if (from !== me()) {
      setHasPrivateCaller(room)
    }
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) {
      // TODO: first ask for name...
      setRoom(room)
    }
  }, [])

  const handleSubmitName = useCallback((event: FormEvent) => {
    event.preventDefault()
    setName((event.target as any).elements.name.value)
  }, [])

  const handleJoinRoom = useCallback((room: string) => {
    // TODO: first ask for name...
    setRoom(room)
    setShowCreateRoom(false)
  }, [])

  const handleCall = useCallback((remotePeerId: string) => {
    call(remotePeerId, name)
    setPrivateCaller(remotePeerId)
  }, [call, name])

  const handleAcceptCall = useCallback(() => {
    setHasPrivateCaller(undefined)
    setPrivateCaller(hasPrivateCaller)
  }, [hasPrivateCaller])

  const handleDisconnect = useCallback(() => {
    signalingChannel.disconnect()
  }, [signalingChannel])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {name !== '' ? <Box sx={{ display: 'flex' }}>
          <Typography variant="h5">Welcome {name}</Typography>
          &nbsp;&nbsp;
          <Button variant="contained" size="small" color="secondary" onClick={handleDisconnect} disabled={!isConnected}>Disconnect</Button>
        </Box> : <span />}
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {room !== '' ? name ? <Room room={room} name={name} onCall={handleCall} /> : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} component="form" autoComplete="off" onSubmit={handleSubmitName}>
        <TextField variant="filled" margin="normal" label="Your name" name="name" autoFocus role="presentation" autoComplete="off" />
        <Button variant="contained" size="large" type="submit">Join room</Button>
      </Box> : <Button onClick={() => setShowCreateRoom(true)} size="large" variant="contained" disabled={!isConnected}>Create room</Button>}
    </Box>
    <CreateRoom open={showCreateRoom} onJoinRoom={handleJoinRoom} onClose={() => setShowCreateRoom(false)} />
    <PrivateCall open={Boolean(privateCaller)} room={privateCaller} onClose={() => setPrivateCaller(undefined)} />
    <Snackbar
      open={Boolean(hasPrivateCaller)}
      onClose={() => setHasPrivateCaller(undefined)}
      autoHideDuration={60000}
      message="Someone is calling you"
      action={
        <Button onClick={handleAcceptCall} color="success" size="small">
          Accept
        </Button>
      }
      sx={{ bottom: { xs: 90, sm: 0 } }}
    />
  </Box>
}

export default App
