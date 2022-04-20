import { AppBar, Box, Button, Icon, TextField, Toolbar, Typography } from '@mui/material'
import { FormEvent, useCallback, useState } from 'react'
import JoinRoom from './components/JoinRoom'
import Room from './components/Room'
import { useSignalingChannel, useWebRTC } from './webrtc'

function App() {
  const [name, setName] = useState('')
  const [hasConnected, setHasConnected] = useState(false)
  const [room, setRoom] = useState('')
  const { isConnected, ...signalingChannel } = useSignalingChannel()
  const webRTCClient = useWebRTC()

  const handleJoin = useCallback((room: string) => {
    setRoom(room)
    signalingChannel.connect()
    webRTCClient.call(room)
  }, [signalingChannel, webRTCClient])

  const handleConnect = useCallback((event: FormEvent) => {
    event.preventDefault()
    setHasConnected(true)
    signalingChannel.connect()
  }, [signalingChannel])

  const handleDisconnect = useCallback(() => {
    setHasConnected(false)
    signalingChannel.disconnect()
  }, [signalingChannel])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {name !== '' && hasConnected ? <Box sx={{ display: 'flex' }}>
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
      {room !== '' ? <Room room={room} name={name} /> : hasConnected ? <JoinRoom onJoin={handleJoin} /> : <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} component="form" onSubmit={handleConnect}>
        <TextField variant="filled" margin="normal" label="Your name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <Button variant="contained" size="large" type="submit" disabled={hasConnected || name === ''}>Connect</Button>
      </Box>}
    </Box>
  </Box>
}

export default App
