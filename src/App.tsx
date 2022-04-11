import { AppBar, Box, Button, Card, CardActions, CardContent, Icon, List, ListItem, ListItemText, TextField, Toolbar, Typography } from '@mui/material'
import { FormEvent, useCallback, useState } from 'react'
import { useSignalingChannel, useWebRTC } from './webRTC'

function Messages({ name }: { name: string }) {
  const { peers } = useWebRTC()
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
      {peers.map(peer => <ListItem key={peer.peerId}>
        <ListItemText primary={peer.name} />
      </ListItem>)}
    </List>
  </Box>
}

function App() {
  const { isConnected, hasConnected, ...signalingChannel } = useSignalingChannel()
  const [name, setName] = useState('')

  const handleConnect = useCallback((evt: FormEvent) => {
    evt.preventDefault()
    console.log('name', name)
    signalingChannel.connect()
  }, [signalingChannel, name])

  return <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Card component="form" onSubmit={handleConnect}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Toolbar>
      </AppBar>
      {hasConnected ? <Messages name={name} /> : <>
        <CardContent>
          <TextField
            variant="filled"
            margin="normal"
            label="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </CardContent>
        <CardActions sx={{ justifyContent: 'flex-end' }}>
          <Button variant="contained" type="submit" disabled={hasConnected}>Connect</Button>
        </CardActions>
      </>}
    </Card>
  </Box>
}

export default App
