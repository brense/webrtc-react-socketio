import { Box, Button, FilledInput, Icon, IconButton, List, ListItem, ListItemText } from '@mui/material'
import moment from 'moment'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Subscription } from 'rxjs'
import { useWebRTC } from '../webrtc'

function Room({ name, room }: { name: string, room: string }) {
  const [muted, setMuted] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Array<{ name: string, message: string, date: Date }>>([])
  const { onMessage, onChannelOpen, onChannelClose, sendMessage, onTrack, addTrack, removeTrack } = useWebRTC()
  const audioRef = useRef<HTMLAudioElement>(null)
  const streamRef = useRef<MediaStream>()

  useEffect(() => {
    const subscribers: Subscription[] = []
    subscribers.push(onMessage.subscribe(data => setMessages(messages => [...messages, data as any])))
    subscribers.push(onTrack.subscribe(event => {
      console.log('received track', event)
      if (audioRef.current) {
        event.streams[0].onremovetrack = () => setHasAudio(false)
        audioRef.current.srcObject = event.streams[0]
        setHasAudio(true)
      }
    }))
    return () => subscribers.forEach(subscriber => subscriber.unsubscribe())
  }, [onMessage, onChannelOpen, onChannelClose, onTrack, room])

  const toggleAudio = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = undefined
      removeTrack(room)
      setIsRecording(false)
    } else {
      setIsRecording(true)
      const stream = await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false
        })
      streamRef.current = stream
      stream.getTracks().forEach(track => addTrack(room, track, stream))
    }
  }, [room, addTrack, removeTrack])

  const toggleAudioMuted = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted
      setMuted(audioRef.current.muted)
    }
  }, [])

  const handleSendMessage = useCallback((event: FormEvent) => {
    event.preventDefault()
    const message: string = (event.target as any).elements.message.value
    if (message.trim() !== '') {
      const data = { name, message, date: new Date() }
      sendMessage(room, data)
      setMessages(messages => [...messages, data])
    }
    (event.target as any).reset()
  }, [sendMessage, name, room])

  return <Box sx={{ height: '100%', width: '50%', maxWidth: 600, minWidth: 320, display: 'flex', flexDirection: 'column' }}>
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <List>
        {messages.map(({ name, message, date }, index) => <ListItem key={index}>
          <Box component="code" sx={{ marginRight: 2 }}>{moment(date).format("HH:mm:ss")}</Box>
          <ListItemText primary={name} secondary={message} />
        </ListItem>)}
      </List>
    </Box>
    <audio ref={audioRef} autoPlay />
    <Box sx={{ display: 'flex', paddingBottom: 3, alignItems: 'center' }} component="form" onSubmit={handleSendMessage} autoComplete="off">
      <FilledInput sx={{ marginRight: 1 }} name="message" fullWidth autoFocus autoComplete="false" />
      <IconButton onClick={toggleAudio} sx={{ marginRight: 1 }}><Icon color={isRecording ? 'success' : 'inherit'}>mic</Icon></IconButton>
      <IconButton onClick={toggleAudioMuted} sx={{ marginRight: 1 }}><Icon color={hasAudio ? !muted ? 'success' : 'inherit' : 'disabled'}>{hasAudio && !muted ? 'volume_up' : 'volume_mute'}</Icon></IconButton>
      <Button variant="contained" type="submit">Send</Button>
    </Box>
  </Box>
}

export default Room
