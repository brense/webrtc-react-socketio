import { AppBar, Box, Button, Icon, List, ListItem, ListItemText, Toolbar, Typography } from '@mui/material'
import { useCallback, useState } from 'react'
import JoinRoom from './components/JoinRoom'
import { useSignalingChannel, useWebRTC } from './webrtc'

function Messages({ name }: { name: string }) {
  return <Box sx={{ display: 'flex' }}>
    <List sx={{ flex: 1 }} dense>
      <ListItem>
        <ListItemText primary="messages..." />
      </ListItem>
    </List>
    <List>
      <ListItem>
        <ListItemText primary={name} />
      </ListItem>
    </List>
  </Box>
}

function App() {
  const { isConnected, ...signalingChannel } = useSignalingChannel()
  const [hasConnected, setHasConnected] = useState(false)
  const webRTCClient = useWebRTC()
  const [room, setRoom] = useState('')

  const handleJoin = useCallback((room: string) => {
    setRoom(room)
    signalingChannel.connect()
    webRTCClient.createBroadcast(room)
  }, [signalingChannel, webRTCClient])

  const handleConnect = useCallback(() => {
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
        {room !== '' ? <Typography variant="h5">Room: {room}</Typography> : <span />}
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {room !== '' ? <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        <Messages name={room} />
      </Box> : hasConnected ? <JoinRoom onJoin={handleJoin} /> : <Button variant="contained" size="large" onClick={handleConnect} disabled={hasConnected}>Connect</Button>}
    </Box>
  </Box>
}

export default App
