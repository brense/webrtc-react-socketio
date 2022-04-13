import React, { useContext, useEffect, useState } from 'react'
import { Subject, Subscription } from 'rxjs'
import io, { ManagerOptions, SocketOptions } from 'socket.io-client'

export type ClientPayload = {
  from: string
}

export type SessionDescriptionPayload = {
  room: string
  sdp: RTCSessionDescriptionInit | null
  to: string
  from: string
}

export type CandidatePayload = {
  room: string
  candidate: RTCIceCandidateInit
  to: string
  from: string
}

export type RoomPayload = {
  from: string
  room: string
}

const onConnect = new Subject<string>()
const onDisconnect = new Subject()
const onClient = new Subject<ClientPayload>()
const onJoin = new Subject<RoomPayload>()
const onLeave = new Subject<Omit<RoomPayload, 'room'> & { room?: string }>()
const onSessionDescription = new Subject<SessionDescriptionPayload>()
const onCandidate = new Subject<CandidatePayload>()

export function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  const socket = io(uri, opts)
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    onConnect.next(socket.id)
  })

  /*
    - a room is either a broadcast or a call
    - when a peer joins a broadcast it doenst add any datachannels or tracks
    - when a peer joins a call it adds its own datachannels and tracks
  */

  socket.on('client', payload => onClient.next(payload)) // a new client has connected to the websocket
  socket.on('join', payload => onJoin.next(payload)) // a peer wants to join a room or has created one
  socket.on('leave', payload => onLeave.next(payload)) // a peer has left a room or has disconnected
  socket.on('desc', payload => onSessionDescription.next(payload)) // receive a session description from another peer
  socket.on('candidate', payload => onCandidate.next(payload)) // receive an icecandidate from another peer

  socket.on('disconnect', () => {
    onDisconnect.next(undefined)
  })

  return {
    onConnect,
    onDisconnect,
    onClient,
    onJoin,
    onLeave,
    onSessionDescription,
    onCandidate,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => socket.close(),
    join: (payload: Omit<RoomPayload, 'from'>) => socket.emit('join', payload),
    leave: (payload: Omit<RoomPayload, 'from'>) => socket.emit('leave', payload),
    sendSessionDescription: (sessionDescription: Omit<SessionDescriptionPayload, 'from'>) => socket.emit('desc', sessionDescription),
    sendCandidate: (iceCandidate: Omit<CandidatePayload, 'from'>) => socket.emit('candidate', iceCandidate)
  }
}

export type SignalingChanel = ReturnType<typeof createIoSignalingChanel>

const SignalingChanelContext = React.createContext<SignalingChanel>(undefined as unknown as SignalingChanel)

export function SignalingChannelProvider({ children, signalingChannel }: React.PropsWithChildren<{ signalingChannel: SignalingChanel }>) {
  return <SignalingChanelContext.Provider value={signalingChannel}>{children}</SignalingChanelContext.Provider>
}

export function useSignalingChannel() {
  const [isConnected, setIsConnected] = useState(false)
  const signalingChannel = useContext(SignalingChanelContext)
  useEffect(() => {
    const subscriptions: Subscription[] = []
    subscriptions.push(signalingChannel.onConnect.subscribe(() => setIsConnected(true)))
    subscriptions.push(signalingChannel.onDisconnect.subscribe(() => setIsConnected(false)))
    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
  return { isConnected, ...signalingChannel }
}
