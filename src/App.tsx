import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, AppBar, Box, Button, Card, CardContent, CardHeader, Divider, FormControlLabel, FormGroup, Icon, IconButton, List, ListItem, ListItemSecondaryAction, ListItemText, ListSubheader, Switch, TextField, Toolbar, Tooltip, Typography } from '@mui/material'
import Room from './Room'
import { useSignalingChannel } from './signaling'
import useSnackbar from './useSnackbar'
import useUsernameDialog from './useUsernameDialog'

function App() {
  const [configuration, setConfiguration] = useState<RTCConfiguration>()
  const [selectedRoom, setSelectedRoom] = useState<{ id: string, name?: string, broadcaster?: string }>()
  const [username, setUsername] = useState<string>()
  const [rooms, setRooms] = useState<Array<{ id: string, name?: string, broadcaster?: string }>>([])
  const { isConnected, join, broadcast, socket } = useSignalingChannel()
  const shareLink = useMemo(() => selectedRoom ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}?roomId=${selectedRoom.id}` : undefined, [selectedRoom])
  const { openSnackbar } = useSnackbar()
  const { openUsernameDialog } = useUsernameDialog()

  const joinRoom = useCallback(async ({ id, name, hidden = false, isBroadcast = false }: { id?: string, name?: string, hidden?: boolean, isBroadcast?: boolean }) => {
    !username && setUsername(await openUsernameDialog())
    const payload = { id, hidden, name: (!name || name === '') ? undefined : name }
    isBroadcast ? broadcast(payload, response => setSelectedRoom(response.room)) : join(payload, response => setSelectedRoom(response.room))
  }, [join, broadcast])

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault()
    const name = (event.target as any).elements.room.value
    const hidden = (event.target as any).elements.hidden.checked
    const isBroadcast = (event.target as any).elements.isBroadcast.checked
    joinRoom({ name, hidden, isBroadcast })
  }, [joinRoom])

  const handleShareLinkCopy = useCallback(async () => {
    await navigator.clipboard.writeText(shareLink || '')
    openSnackbar(<Alert severity="success">Copied!</Alert>)
  }, [shareLink])

  const handleAny = useCallback((eventName: string, payload: any) => {
    //console.log('any', eventName, payload)
  }, [])

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('roomId')
    if (id) {
      joinRoom({ id })
    }
  }, [])

  useEffect(() => {
    socket.onAny(handleAny)
    socket.on('config', iceServers => setConfiguration(config => ({ ...config, iceServers })))
    socket.on('rooms', setRooms)
    return () => {
      socket.offAny(handleAny)
      socket.off('config')
      socket.off('rooms', setRooms)
    }
  }, [socket])

  return <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    <AppBar position="static">
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        {selectedRoom ? <Box sx={{ display: 'flex' }}>
          <Typography variant="h5">{selectedRoom.name || 'Unnamed room'}</Typography>
          <Tooltip title="Click to copy share link">
            <IconButton size="small" onClick={handleShareLinkCopy}><Icon color="primary">link</Icon></IconButton>
          </Tooltip>
        </Box> : <span />}
        <Box sx={{ display: 'flex', flexWrap: 'nowrap' }}>
          <Typography variant="body2">Server status:</Typography>
          {isConnected ? <Icon color="success">bolt</Icon> : <Icon color="disabled">power</Icon>}
          <Typography variant="body2" color={isConnected ? 'success' : 'textSecondary'}>{isConnected ? 'Connected' : 'Disconnected'}</Typography>
        </Box>
      </Toolbar>
    </AppBar>
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {selectedRoom && username ? <Room room={selectedRoom} username={username} configuration={configuration} /> : <Card component="form" onSubmit={handleSubmit} autoComplete="off">
        {rooms.length > 0 && <CardHeader title="Welcome!" />}
        <List subheader={rooms.length > 0 ? <ListSubheader>Join a room:</ListSubheader> : null} disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
          {rooms.map(({ id, name }) => <ListItem key={id}>
            <ListItemText primary={name || 'Unnamed room'} secondary={id} secondaryTypographyProps={{ component: 'code' }} />
            <ListItemSecondaryAction>
              <Button size="small" onClick={() => joinRoom({ id, name })}>Join</Button>
            </ListItemSecondaryAction>
          </ListItem>)}
        </List>
        {rooms.length > 0 && <Divider>OR</Divider>}
        <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Typography variant="h6">Create a room</Typography>
          <TextField name="room" variant="filled" label="Room name (optional)" margin="normal" role="presentation" autoComplete="off" fullWidth />
          <FormGroup sx={{ display: 'flex', flexDirection: 'row', marginBottom: 2 }}>
            <FormControlLabel control={<Switch name="hidden" />} label="Hidden" />
            <FormControlLabel control={<Switch name="isBroadcast" />} label="Broadcast" />
          </FormGroup>
          <Button type="submit" variant="contained" size="large">Create</Button>
        </CardContent>
      </Card>}
    </Box>
  </Box>
}

export default App
