import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AppBar, Box, Button, Card, CardContent, Icon, List, ListItem, ListItemSecondaryAction, ListItemText, TextField, Toolbar, Typography } from '@mui/material'
import Room from './Room'
import { useSignalingChannel } from './signaling'

function App() {
  const [configuration, setConfiguration] = useState<RTCConfiguration>()
  const [roomId, setRoomId] = useState<string>()
  const [rooms, setRooms] = useState<Array<{ id: string, name?: string, broadcaster?: string }>>([])
  const selectedRoom = useMemo(() => rooms.find(r => r.id === roomId), [roomId, rooms])

  const { isConnected, join, socket } = useSignalingChannel()

  useEffect(() => {
    socket.on('config', iceServers => setConfiguration(config => ({ ...config, iceServers })))
    socket.on('rooms', setRooms)
    return () => {
      socket.off('config')
      socket.off('rooms', setRooms)
    }
  }, [socket])

  const joinRoom = useCallback(({ id: room, name }: { id?: string, name?: string }) => {
    join({ room, name: (!name || name === '') ? undefined : name }, response => setRoomId(response.room))
  }, [join])

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault()
    const name = (event.target as any).elements.room.value
    joinRoom({ name })
  }, [joinRoom])

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
      {selectedRoom ? <Room room={selectedRoom} configuration={configuration} /> : <Card component="form" onSubmit={handleSubmit}>
        <List disablePadding>
          {rooms.map(({ id, name }) => <ListItem key={id}>
            <ListItemText primary={id} secondary={name} />
            <ListItemSecondaryAction>
              <Button size="small" onClick={() => joinRoom({ id, name })}>Join</Button>
            </ListItemSecondaryAction>
          </ListItem>)}
        </List>
        <CardContent sx={{ display: 'flex', flexDirection: 'column' }}>
          <TextField name="room" variant="filled" label="Room" margin="normal" />
          <Button type="submit" variant="contained" size="large">Create room</Button>
        </CardContent>
      </Card>}
    </Box>
  </Box>
}

export default App
