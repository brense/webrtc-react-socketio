import { Box, Button, FilledInput, Icon, IconButton, List, ListItem, ListItemText } from '@mui/material'
import moment from 'moment'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebRTC } from '../webrtc'
import { useWebRTCEvent } from '../webrtc/webRTC'

function AudioStream({ stream, muted }: { stream: MediaProvider, muted: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream
    }
  }, [stream])
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = muted
    }
  }, [muted])
  return <audio ref={audioRef} autoPlay />
}

function Room({ name, room }: { name: string, room: string }) {
  const [muted, setMuted] = useState(false)
  const [audioSources, setAudioSources] = useState<{ [key: string]: MediaProvider }>({})
  const hasAudio = useMemo(() => Object.keys(audioSources).length > 0, [audioSources])
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Array<{ name: string, message: string, date: Date }>>([])
  const { call, sendMessage, addTrack, removeTrack } = useWebRTC()
  const streamRef = useRef<MediaStream>()

  useEffect(() => {
    call(room)
  }, [call, room])

  useWebRTCEvent('onMessage', data => setMessages(messages => [...messages, data as any]))

  useWebRTCEvent('onTrack', ({ remotePeerId, track }) => {
    console.log('received track', track, remotePeerId)
    setAudioSources(sources => ({ ...sources, [remotePeerId]: track.streams[0] }))
    track.streams[0].onremovetrack = () => {
      setAudioSources(sources => {
        delete sources[remotePeerId]
        return { ...sources }
      })
    }
  })

  useWebRTCEvent('onChannelOpen', ({ room }) => sendMessage(room, { name: 'System', message: `${name || 'peer'} has joined`, date: new Date() }), [name])

  useWebRTCEvent('onChannelClose', ({ remotePeerId }) => {
    sendMessage(room, { name: 'System', message: `${name || 'peer'} has left`, date: new Date() })
    setAudioSources(sources => {
      delete sources[remotePeerId]
      return { ...sources }
    })
  }, [name])

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
    setMuted(muted => !muted)
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
    {Object.keys(audioSources).map(k => <AudioStream stream={audioSources[k]} muted={muted} key={k} />)}
    <Box sx={{ display: 'flex', paddingBottom: 3, alignItems: 'center' }} component="form" onSubmit={handleSendMessage} autoComplete="off">
      <FilledInput sx={{ marginRight: 1 }} name="message" fullWidth autoFocus autoComplete="false" />
      <IconButton onClick={toggleAudio} sx={{ marginRight: 1 }}><Icon color={isRecording ? 'success' : 'inherit'}>mic</Icon></IconButton>
      <IconButton onClick={toggleAudioMuted} sx={{ marginRight: 1 }}><Icon color={hasAudio ? !muted ? 'success' : 'inherit' : 'disabled'}>{hasAudio && !muted ? 'volume_up' : 'volume_mute'}</Icon></IconButton>
      <Button variant="contained" type="submit">Send</Button>
    </Box>
  </Box>
}

export default Room
