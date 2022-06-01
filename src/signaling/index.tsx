import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Subject } from 'rxjs'
import io, { ManagerOptions, SocketOptions } from 'socket.io-client'
import { v4 as uuid } from 'uuid'
import { CandidatePayload, ClientPayload, OnResponseCallback, RoomPayload, SessionDescriptionPayload } from './types'

const onConnect = new Subject<string>()
const onDisconnect = new Subject<void>()
const onLeave = new Subject<Omit<RoomPayload, 'room'> & { room?: string }>()
const onNewMember = new Subject<ClientPayload & { room: string }>()
const onSessionDescription = new Subject<SessionDescriptionPayload>()
const onIceCandidate = new Subject<CandidatePayload>()

const peerId = uuid()

function createIoSignalingChannel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  let recoveryToken: string | undefined = undefined
  const socket = io(uri, { ...opts, query: { ...opts?.query, recoveryToken, peerId } })
  socket.io.on('reconnect_attempt', () => {
    socket.io.opts.query = { ...socket.io.opts.query, recoveryToken, peerId }
  })
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${peerId}, socketId: ${socket.id}`)
    onConnect.next(peerId)
  })

  socket.on('new member', payload => onNewMember.next(payload)) // a new member has joined your room
  socket.on('leave', payload => onLeave.next(payload)) // a member has left your room or has disconnected
  socket.on('desc', payload => onSessionDescription.next(payload)) // received a session description from another peer
  socket.on('candidate', payload => onIceCandidate.next(payload)) // received an icecandidate from another peer
  socket.on('disconnect', () => onDisconnect.next()) // socket server has disconnected

  function broadcast(payload: Omit<RoomPayload, 'from' | 'id'> & { id?: string }, onResponse?: OnResponseCallback) {
    socket.emit('broadcast', payload, handleResponse(onResponse))
  }

  function join(payload: Omit<RoomPayload, 'from' | 'id'> & { id?: string }, onResponse?: OnResponseCallback) {
    socket.emit('join', payload, handleResponse(onResponse))
  }

  function leave(payload: Omit<RoomPayload, 'from'>) {
    recoveryToken = undefined
    socket.emit('leave', payload)
  }

  function disconnect() {
    recoveryToken = undefined
    socket.close()
  }

  function handleResponse(onResponse?: OnResponseCallback) {
    return (payload: { recoveryToken: string, room: RoomPayload }) => {
      recoveryToken = payload.recoveryToken
      onResponse && onResponse(payload)
    }
  }

  return {
    peerId,
    connect: () => !socket.connected && socket.connect(),
    disconnect,
    broadcast,
    join,
    leave,
    sendSessionDescription: (sessionDescription: Omit<SessionDescriptionPayload, 'from'>) => socket.emit('desc', sessionDescription),
    sendIceCandidate: (iceCandidate: Omit<CandidatePayload, 'from'>) => socket.emit('candidate', iceCandidate),
    socket
  }
}

const SignalingChanelContext = createContext<SignalingChanel>(undefined as unknown as SignalingChanel)

export function SignalingChannelProvider({ children, signalingChannel }: React.PropsWithChildren<{ signalingChannel: SignalingChanel }>) {
  return <SignalingChanelContext.Provider value={signalingChannel}>{children}</SignalingChanelContext.Provider>
}

export function useSignalingChannel() {
  const [isConnected, setIsConnected] = useState(false)
  const signalingChannel = useContext(SignalingChanelContext)

  useEffect(() => {
    const connectSubscription = onConnect.subscribe(() => setIsConnected(true))
    const disconnectSubscription = onDisconnect.subscribe(() => setIsConnected(false))
    return () => {
      connectSubscription.unsubscribe()
      disconnectSubscription.unsubscribe()
    }
  }, [])

  return { isConnected, ...signalingChannel }
}

export default createIoSignalingChannel

export type SignalingChanel = ReturnType<typeof createIoSignalingChannel>

export type { ClientPayload, SessionDescriptionPayload, CandidatePayload, RoomPayload, OnResponseCallback } from './types'
