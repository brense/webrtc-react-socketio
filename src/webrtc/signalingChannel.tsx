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
  isBroadcast?: boolean
}


const subjects = {
  onBroadcasts: new Subject<{ [key: string]: string }>(),
  onConnect: new Subject<string>(),
  onDisconnect: new Subject(),
  onClient: new Subject<ClientPayload>(),
  onCall: new Subject<RoomPayload & { [key: string]: any }>(),
  onJoin: new Subject<RoomPayload>(),
  onLeave: new Subject<Omit<RoomPayload, 'room'> & { room?: string }>(),
  onSessionDescription: new Subject<SessionDescriptionPayload>(),
  onCandidate: new Subject<CandidatePayload>(),
  onConfig: new Subject<RTCIceServer[]>()
}

export function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  let recoveryToken: string | undefined = undefined
  const socket = io(uri, { ...opts, query: { ...opts?.query, recoveryToken } })
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    subjects.onConnect.next(socket.id)
  })

  socket.on('recovery', payload => (recoveryToken = payload)) // store recovery token
  socket.on('peer', payload => subjects.onClient.next(payload)) // a new peer has connected to the websocket
  socket.on('config', payload => subjects.onConfig.next(payload)) // received ice servers from the server
  socket.on('call', payload => subjects.onCall.next(payload)) // a peer is calling
  socket.on('join', ({ isBroadcast = false, ...rest }: RoomPayload) => subjects.onJoin.next({ isBroadcast, ...rest })) // a peer wants to join a room or has created one
  socket.on('leave', payload => subjects.onLeave.next(payload)) // a peer has left a room or has disconnected
  socket.on('desc', payload => subjects.onSessionDescription.next(payload)) // receive a session description from another peer
  socket.on('candidate', payload => subjects.onCandidate.next(payload)) // receive an icecandidate from another peer
  socket.on('broadcasts', payload => subjects.onBroadcasts.next(payload)) // update list of broadcasts

  socket.on('disconnect', () => {
    subjects.onDisconnect.next(undefined)
  })

  return {
    ...subjects,
    me: () => socket.id,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => socket.close(),
    createRoom: (payload: { isBroadcast: boolean }) => socket.emit('call', payload),
    makeCall: (payload: { to?: string, isBroadcast: boolean, [key: string]: any }) => socket.emit('call', payload),
    join: (payload: Omit<RoomPayload, 'from'> & { [key: string]: any }) => socket.emit('join', payload),
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
