import React, { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Box, FilledInput, Icon, IconButton, List, ListItem, ListItemText, Typography } from '@mui/material'
import { usePeerConnection } from './webrtc'
import { useSignalingChannel } from './signaling'
import moment from 'moment'

type MessageData = {
  type: 'system' | 'user',
  peerId: string,
  username: string,
  message: string,
  date: Date
}

function Room({ room: { id: room, broadcaster }, username, configuration, onLeave }: PropsWithChildren<{ room: { id: string, name?: string, broadcaster?: string }, username: string, configuration?: RTCConfiguration, onLeave?: () => void }>) {
  const [members, setMembers] = useState<Array<{ peerId: string, username: string }>>([])
  const [messages, setMessages] = useState<MessageData[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const streamRef = useRef<MediaStream>()
  const messageListEndRef = useRef<HTMLDivElement>(null)
  const { socket, peerId } = useSignalingChannel()
  const [isRecording, setIsRecording] = useState(false)

  useEffect(() => {
    messageListEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNewMemberMessage = useCallback(async ({ peerId, username, ...data }: MessageData) => {
    const isNew = await new Promise(resolve => {
      setMembers(members => {
        const memberIndex = members.findIndex(m => m.peerId === peerId)
        if (memberIndex < 0) {
          resolve(true)
          return [...members, { peerId, username }]
        }
        resolve(false)
        return members
      })
    })
    isNew && setMessages(messages => [...messages, { ...data, peerId, username: 'system', message: `${username} has joined` }])
  }, [])

  const onMessage = useCallback(async ({ type, message, ...data }: MessageData) => {
    if (type === 'system') {
      switch (message) {
        case 'new member':
          await handleNewMemberMessage({ ...data, type, message })
          break
        default:
          break
      }
    } else {
      setMessages(messages => [...messages, { ...data, type, message }])
    }
  }, [])

  const onNewPeerConnection = useCallback((connection: RTCPeerConnection, identifier: string, configuration?: RTCConfiguration) => {
    console.info('new connection using config', configuration, connection)
    createDataChannel(identifier)
  }, [])

  const { addTrack, removeTrack, createDataChannel, sendMessage } = usePeerConnection<MessageData>(room, {
    onTrack: track => {
      if (audioRef.current) {
        audioRef.current.srcObject = track.streams[0]
      }
      track.streams[0].onremovetrack = () => {
        if (audioRef.current) {
          audioRef.current.srcObject = null
        }
      }
    },
    onIceCandidateError: evt => console.info('ice candidate error', evt),
    onIceCandidate: event => console.info('ice candidate', event?.candidate),
    onNewPeerConnection,
    onChannelOpen: () => sendMessage({ type: 'system', peerId, username, message: 'new member', date: new Date() }),
    onChannelClose: () => console.log('CHANNEL CLOSE!'),
    onMessage
  },
    configuration
  )

  const handleMemberLeave = useCallback((payload: { room: string, from: string }) => {
    if (payload.room === room) {
      setMembers(members => {
        const memberIndex = members.findIndex(m => m.peerId === payload.from)
        if (memberIndex >= 0) {
          const { username } = members[memberIndex] || { username: 'Someone' }
          setMessages(messages => [...messages, { type: 'system', peerId, username: 'system', message: `${username} has left`, date: new Date() }])
          members.splice(memberIndex, 1)
          return [...members]
        }
        return members
      })
    }
  }, [room])

  const toggleBroadcast = useCallback(async () => {
    if (!streamRef.current) {
      const stream = await navigator.mediaDevices
        .getUserMedia({
          audio: true,
          video: false
        })
      stream.getTracks().forEach(track => addTrack(track, stream))
      streamRef.current = stream
      setIsRecording(true)
    } else {
      streamRef.current.getTracks().forEach(track => track.stop())
      removeTrack()
      streamRef.current = undefined
      setIsRecording(false)
    }
  }, [addTrack, removeTrack])

  const handleSubmitMessage = useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const message: string = (event.target as any).elements.message.value
    if (message.trim() !== '') {
      const data = {
        type: 'user' as 'user',
        peerId,
        username,
        message,
        date: new Date()
      }
      sendMessage(data)
      setMessages(messages => [...messages, data])
    }
    (event.target as any).reset()
  }, [])

  useEffect(() => {
    socket.on('leave', handleMemberLeave)
    return () => {
      socket.off('leave', handleMemberLeave)
    }
  }, [handleMemberLeave, socket])

  return <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden', flex: 1, width: '100%' }}>
    <Box sx={{ width: '100%', overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
      <List sx={{ minWidth: 360 }}>
        {messages.map(({ message, peerId, username, date }) => <ListItem key={moment(date).format('x') + peerId}>
          <Typography sx={{ marginRight: 2 }} variant="body2" component="code" color="textSecondary">{moment(date).format('HH:mm:ss')}</Typography>
          <ListItemText primary={username} secondary={message} />
        </ListItem>)}
        <span ref={messageListEndRef} />
      </List>
    </Box>
    <audio ref={audioRef} autoPlay />
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 360 }} component="form" onSubmit={handleSubmitMessage} autoComplete="off">
      <FilledInput sx={{ marginRight: 1 }} name="message" role="presentation" autoComplete="off" autoFocus fullWidth />
      <IconButton size="small" onClick={toggleBroadcast}><Icon color={isRecording ? 'success' : 'inherit'}>{isRecording ? 'mic' : 'mic_off'}</Icon></IconButton>
      <IconButton disabled={members.length === 0}><Badge badgeContent={members.length} color="primary"><Icon>person</Icon></Badge></IconButton>
      <IconButton size="large" onClick={() => onLeave && onLeave()}><Icon fontSize="large">phone</Icon></IconButton>
    </Box>
  </Box >
}

export default Room
