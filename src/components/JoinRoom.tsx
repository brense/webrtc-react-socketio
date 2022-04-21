import { Button, Card, CardActions, CardContent, CardHeader, Divider, List, ListItem, ListItemSecondaryAction, ListItemText, TextField } from '@mui/material'
import { FormEvent, useCallback } from 'react'

function JoinRoom({ onJoin, rooms }: { onJoin: (name: string) => void, rooms: Array<{ room: string, creator: string, isBroadcast: boolean }> }) {
  const handleConnect = useCallback((evt: FormEvent) => {
    evt.preventDefault()
    onJoin((evt.target as any).elements.name.value)
  }, [onJoin])

  return <Card component="form" onSubmit={handleConnect}>
    <CardHeader title={rooms.length > 0 ? 'Join a room' : 'Create a room'} />
    {rooms.length > 0 && <List>
      {rooms.map(({ room }, k) => <ListItem key={k}>
        <ListItemText primary={room} />
        <ListItemSecondaryAction><Button size="small">Join room</Button></ListItemSecondaryAction>
      </ListItem>)}
    </List>}
    {rooms.length > 0 && <Divider>Or create one</Divider>}
    <CardContent>
      <TextField
        variant="filled"
        margin="normal"
        label="Room name"
        name="name"
        fullWidth
        autoFocus
      />
    </CardContent>
    <CardActions sx={{ justifyContent: 'flex-end' }}>
      <Button variant="contained" type="submit">Join</Button>
    </CardActions>
  </Card>
}

export default JoinRoom
