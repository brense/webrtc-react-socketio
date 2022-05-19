import React, { PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, List, ListItem, ListItemText, TextField, Typography } from '@mui/material'
import { usePeerConnection } from './webrtc'
import { useSignalingChannel } from './signaling'

type MessageData = {
  type: 'system' | 'user',
  peerId: string,
  username: string,
  message: string,
  date: Date
}

function Room({ room: { id: room, broadcaster }, username, configuration }: PropsWithChildren<{ room: { id: string, name?: string, broadcaster?: string }, username: string, configuration?: RTCConfiguration }>) {
  const [members, setMembers] = useState<{ [key: string]: { username: string } }>({})
  const membersRef = useRef<typeof members>()
  const [messages, setMessages] = useState<MessageData[]>([])
  const audioRef = useRef<HTMLAudioElement>(null)
  const { socket, peerId } = useSignalingChannel()

  useEffect(() => {
    if (membersRef.current !== members) {
      console.log('members changed!', members)
      membersRef.current = members
    }
  }, [members])

  const onMessage = useCallback((data: MessageData) => {
    if (data.type === 'system') {
      switch (data.message) {
        case 'new member':
          if (!members[data.peerId]) {
            setMembers(members => ({ ...members, [data.peerId]: { username: data.username } }))
            setMessages(messages => [...messages, { ...data, username: 'system', message: `${data.username} has joined` }])
          }
      }
    } else {
      setMessages(messages => [...messages, data])
    }
  }, [])

  const { addTrack, createDataChannel, sendMessage } = usePeerConnection<MessageData>({
    room,
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
    onChannelOpen: () => sendMessage({ type: 'system', peerId, username, message: 'new member', date: new Date() }),
    onMessage,
    ...configuration
  })

  const handleMemberLeave = useCallback((payload: { room: string, from: string }) => {
    if (payload.room === room) {
      setMembers(members => {
        if (members[payload.from]) {
          setMessages(m => [...m, { type: 'system', peerId, username: 'system', message: `${members[payload.from]?.username} has left`, date: new Date() }])
          delete members[payload.from]
          return { ...members }
        }
        return members
      })
    }
  }, [room])

  const handleBroadcast = useCallback(async () => {
    const stream = await navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false
      })
    stream.getTracks().forEach(track => addTrack(track, stream))
  }, [addTrack])

  const handleNewMember = useCallback(({ room, from: remotePeerId }: { room: string, from: string }) => createDataChannel({ room, remotePeerId }), [])

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
    socket.on('new member', handleNewMember)
    socket.on('leave', handleMemberLeave)
    return () => {
      socket.off('new member', handleNewMember)
      socket.off('leave', handleMemberLeave)
    }
  }, [handleMemberLeave, socket])

  return <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
    <List sx={{ flex: 1 }}>
      {messages.map(({ message, peerId, username, date }) => <ListItem key={date + peerId}>
        <ListItemText primary={username} secondary={message} />
      </ListItem>)}
    </List>
    <audio ref={audioRef} autoPlay />
    <Box sx={{ display: 'flex' }} component="form" onSubmit={handleSubmitMessage} autoComplete="off">
      <TextField variant="filled" name="message" role="presentation" autoComplete="off" autoFocus />
    </Box>
  </Box >
}

export default Room
