import { AppBar, Box, Button, Icon, Snackbar, TextField, Toolbar, Typography } from '@mui/material'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import CallDialog from './components/CallDialog'
import CreateOrJoinRoom from './components/CreateOrJoinRoom'
import Room from './components/Room'
import { useSignalingChannel } from './webrtc'
import { useCall, useOnCall } from './webrtc/webRTC'

function App() {
  const [broadcasts, setBroadcasts] = useState<{ [key: string]: string }>({})
  const [hasCall, setHasCall] = useState<{ answered?: boolean, room: string, from: string, name: string | undefined }>()
  const [name, setName] = useState('')
  const { isConnected, onBroadcasts } = useSignalingChannel()
  const { makeCall, answerCall, room } = useCall()
  const previousRoom = useRef<string>()

  useEffect(() => {
    const subscriber = onBroadcasts.subscribe(payload => setBroadcasts(payload))
    return () => subscriber.unsubscribe()
  }, [onBroadcasts])

  useOnCall(payload => setHasCall(call => ({ ...call, ...payload, name: payload.name })))

  const handleCall = useCallback(({ remotePeerId, name: remoteName, isBroadcast = false }: { name?: string, remotePeerId?: string, isBroadcast?: boolean }) => {
    if (room) {
      previousRoom.current = room.name
      room.leaveRoom()
    }
    makeCall(remotePeerId || null, { isBroadcast, name })
    remotePeerId && setHasCall({ answered: true, room: '', from: remotePeerId, name: remoteName })
  }, [makeCall, name, room])

  const handleAnswerCall = useCallback(() => {
    if (hasCall && hasCall.room && name && room?.name) {
      previousRoom.current = room.name
      room.leaveRoom()
      answerCall({ ...hasCall, name })
      setHasCall(call => ({ ...call, answered: true } as unknown as any))
    }
  }, [answerCall, hasCall, name, room])

  const handleEndCall = useCallback(() => {
    setHasCall(undefined)
    if (room) {
      room.leaveRoom()
    }
    if (previousRoom.current) {
      answerCall({ room: previousRoom.current, name })
      previousRoom.current = undefined
    }
  }, [name, answerCall, room])

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

  const handleLeave = useCallback(() => {
    room && room.leaveRoom()
  }, [room])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {name !== '' ? <Box sx={{ display: 'flex' }}>
          <Typography variant="h5">Welcome {name}</Typography>
        </Box> : <span />}
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {name ? room ? <Room room={room} name={name} onCall={handleCall} onLeave={handleLeave} /> : <CreateOrJoinRoom broadcasts={broadcasts} isConnected={isConnected} onCall={handleCall} onJoin={room => answerCall({ room, name })} /> : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} component="form" autoComplete="off" onSubmit={handleSubmitName}>
        <TextField variant="filled" margin="normal" label="Your name" name="name" autoFocus role="presentation" autoComplete="off" />
        <Button variant="contained" size="large" type="submit">Connect</Button>
      </Box>}
    </Box>
    <Snackbar
      open={hasCall ? !Boolean(hasCall.answered) : false}
      message={`${hasCall?.name || 'Someone'} is calling you`}
      action={
        <Button onClick={handleAnswerCall} color="success" size="small">
          Accept
        </Button>
      }
      sx={{ bottom: { xs: 90, sm: 0 } }}
    />
    <CallDialog room={room} caller={hasCall} onEndCall={handleEndCall} />
  </Box>
}

export default App
