import { Box, Button, FilledInput, Icon, IconButton, List, ListItem, ListItemText } from '@mui/material'
import moment from 'moment'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWebRTC } from '../webrtc'
import { useWebRTCEvent } from '../webrtc/webRTC'
import RoomMembers, { Member } from './RoomMembers'

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

type Message = {
  name: string,
  message: string,
  date: Date
}

function Room({ name, room, onCall }: { name: string, room: string, onCall: (remotePeerId: string) => void }) {
  const [members, setMembers] = useState<Member[]>([])
  const [muted, setMuted] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [audioSources, setAudioSources] = useState<{ [key: string]: MediaProvider }>({})
  const hasAudio = useMemo(() => Object.keys(audioSources).length > 0, [audioSources])
  const [isRecording, setIsRecording] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const { call: join, sendMessage, addTrack, removeTrack } = useWebRTC()
  const streamRef = useRef<MediaStream>()

  useEffect(() => {
    join(room)
  }, [join, room])

  useWebRTCEvent('onMessage', ({ remotePeerId, ...data }: Message & { remotePeerId: string }) => {
    if (data.name === 'System' && data.message.indexOf('has joined') >= 0) {
      const exists = members.find(m => m.remotePeerId === remotePeerId)
      if (!exists) {
        setMembers(m => [...m, { remotePeerId, name: data.message.replace(' has joined', '') }])
      }
    }
    setMessages(messages => [...messages, data])
  })

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

  useWebRTCEvent('onChannelOpen', ({ room }) => sendMessage(room, { name: 'System', message: `${name || 'peer'} has joined`, date: new Date() }))

  useWebRTCEvent('onChannelClose', ({ remotePeerId }) => {
    const mIndex = members.findIndex(m => m.remotePeerId === remotePeerId)
    if (mIndex >= 0) {
      setMembers(m => {
        m.splice(mIndex, 1)
        return m
      })
    }
    sendMessage(room, { name: 'System', message: `${name || 'peer'} has left`, date: new Date() })
    setAudioSources(sources => {
      delete sources[remotePeerId]
      return { ...sources }
    })
  })

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

  const handleCall = useCallback((remotePeerId: string) => {
    setShowMembers(false)
    onCall(remotePeerId)
  }, [onCall])

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
      <FilledInput sx={{ marginRight: 1 }} name="message" fullWidth autoFocus role="presentation" autoComplete="off" />
      <IconButton onClick={toggleAudio} sx={{ marginRight: 1 }}><Icon color={isRecording ? 'success' : 'inherit'}>mic</Icon></IconButton>
      <IconButton onClick={toggleAudioMuted} sx={{ marginRight: 1 }}><Icon color={hasAudio ? !muted ? 'success' : 'inherit' : 'disabled'}>{hasAudio && !muted ? 'volume_up' : 'volume_mute'}</Icon></IconButton>
      <IconButton onClick={() => setShowMembers(true)} sx={{ marginRight: 1 }}><Icon>person</Icon></IconButton>
      <Button variant="contained" type="submit">Send</Button>
    </Box>
    <RoomMembers members={members} onCall={handleCall} open={showMembers} onClose={() => setShowMembers(false)} />
  </Box>
}

export default Room
