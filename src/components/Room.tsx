import { Box, Button, FilledInput, List, ListItem, ListItemText } from '@mui/material'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useWebRTC } from '../webrtc'

function Room({ name, room }: { name: string, room: string }) {
  const [messages, setMessages] = useState<Array<{ name: string, message: string }>>([])
  const { onMessage, sendMessage } = useWebRTC()
  useEffect(() => {
    const subscriber = onMessage.subscribe(data => setMessages(messages => [...messages, data as any]))
    return () => subscriber.unsubscribe()
  }, [onMessage])
  const handleSendMessage = useCallback((event: FormEvent) => {
    event.preventDefault()
    const message: string = (event.target as any).elements.message.value
    if (message.trim() !== '') {
      const data = { name, message }
      sendMessage(room, data)
      setMessages(messages => [...messages, data])
    }
    (event.target as any).reset()
  }, [sendMessage, name, room])
  return <Box sx={{ height: '100%', width: '50%', maxWidth: 600, minWidth: 320, display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <List>
        {messages.map(({ name, message }, index) => <ListItem key={index}>
          <ListItemText primary={name} secondary={message} />
        </ListItem>)}
      </List>
    </Box>
    <Box sx={{ display: 'flex', paddingBottom: 3 }} component="form" onSubmit={handleSendMessage}>
      <FilledInput sx={{ marginRight: 1 }} name="message" fullWidth />
      <Button variant="contained" type="submit">Send</Button>
    </Box>
  </Box>
}

export default Room
