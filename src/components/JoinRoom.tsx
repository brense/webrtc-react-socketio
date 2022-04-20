import { Button, Card, CardActions, CardContent, CardHeader, TextField } from '@mui/material'
import { FormEvent, useCallback } from 'react'

function JoinRoom({ onJoin }: { onJoin: (name: string) => void }) {
  const handleConnect = useCallback((evt: FormEvent) => {
    evt.preventDefault()
    onJoin((evt.target as any).elements.name.value)
  }, [onJoin])

  return <Card component="form" onSubmit={handleConnect}>
    <CardHeader title="Join a room" subheader="If it doesn't exist yet it will be created" />
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
