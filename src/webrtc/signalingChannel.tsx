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
  isBroadcast?: boolean // the creator of the room is broadcasting and peers should only connect to the creator and not other peers in the room
}


const subjects = {
  onConnect: new Subject<string>(),
  onDisconnect: new Subject(),
  onClient: new Subject<ClientPayload>(),
  onCall: new Subject<RoomPayload & any>(),
  onJoin: new Subject<RoomPayload>(),
  onLeave: new Subject<Omit<RoomPayload, 'room'> & { room?: string }>(),
  onSessionDescription: new Subject<SessionDescriptionPayload>(),
  onCandidate: new Subject<CandidatePayload>()
}

export function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  const socket = io(uri, opts)
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    subjects.onConnect.next(socket.id)
  })

  socket.on('client', payload => subjects.onClient.next(payload)) // a new client has connected to the websocket
  socket.on('call', payload => subjects.onCall.next(payload)) // a client is calling
  socket.on('join', ({ isBroadcast = false, ...rest }: RoomPayload) => subjects.onJoin.next({ isBroadcast, ...rest })) // a peer wants to join a room or has created one
  socket.on('leave', payload => subjects.onLeave.next(payload)) // a peer has left a room or has disconnected
  socket.on('desc', payload => subjects.onSessionDescription.next(payload)) // receive a session description from another peer
  socket.on('candidate', payload => subjects.onCandidate.next(payload)) // receive an icecandidate from another peer

  socket.on('disconnect', () => {
    subjects.onDisconnect.next(undefined)
  })

  return {
    ...subjects,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => socket.close(),
    call: (payload?: { to?: string, isBroadcast?: boolean } & any) => socket.emit('call', payload),
    join: (payload: Omit<RoomPayload, 'from'>) => {
      socket.emit('join', payload)
      const onNewPeer = new Subject<RoomPayload>()
      socket.on('join', ({ isBroadcast = false, ...rest }: RoomPayload) => rest.room === payload.room && onNewPeer.next({ isBroadcast, ...rest }))
      return { onNewPeer }
    },
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

type EventPayloads<K extends keyof typeof subjects> = Parameters<typeof subjects[K]['subscribe']>[0]

export function useSignalingEvent<K extends keyof typeof subjects, T = EventPayloads<K>>(eventName: K, listener: T, ...deps: any[]) {
  useEffect(() => {
    const subscription = (subjects[eventName] as unknown as Subject<T>).subscribe(listener)
    return () => subscription.unsubscribe()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
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
