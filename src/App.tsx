import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import { AppBar, Box, Button, Card, CardContent, Icon, TextField, Toolbar, Typography } from '@mui/material'
import Room from './Room'
import { useSignalingChannel } from './signaling'

function App() {
  const [configuration, setConfiguration] = useState<RTCConfiguration>()
  const [room, setRoom] = useState<string>()

  const { isConnected, broadcast, join, socket } = useSignalingChannel()

  useEffect(() => {
    socket.on('config', iceServers => setConfiguration(config => ({ ...config, iceServers })))
  }, [socket])

  const createRoom = useCallback((event: FormEvent) => {
    event.preventDefault()
    const roomName = (event.target as any).elements.room.value
    if (!roomName || roomName === '') {
      broadcast({}, response => setRoom(response.room))
    } else {
      join({ room: roomName }, response => setRoom(response.room))
    }
  }, [broadcast, join])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'flex-end' }}>
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {room ? <Room room={room} configuration={configuration} /> : <Card component="form" onSubmit={createRoom}>
        <CardContent sx={{ display: 'flex', flexDirection: 'column' }}>
          <TextField name="room" variant="filled" label="Room" margin="normal" />
          <Button type="submit" variant="contained" size="large">Create room</Button>
        </CardContent>
      </Card>}
    </Box>
  </Box>
}

export default App
