import { Subject } from 'rxjs'
import io, { ManagerOptions, SocketOptions } from 'socket.io-client'
import { ClientPayload, RoomPayload, SessionDescriptionPayload, CandidatePayload } from '.'

const subjects = {
  onBroadcasts: new Subject<{ [key: string]: string }>(),
  onConnect: new Subject<string>(),
  onDisconnect: new Subject<void>(),
  onClient: new Subject<ClientPayload>(),
  onCall: new Subject<RoomPayload & { [key: string]: any }>(),
  onJoin: new Subject<RoomPayload>(),
  onLeave: new Subject<Omit<RoomPayload, 'room'> & { room?: string }>(),
  onSessionDescription: new Subject<SessionDescriptionPayload>(),
  onCandidate: new Subject<CandidatePayload>(),
  onConfig: new Subject<RTCIceServer[]>()
}

function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  let recoveryToken: string | undefined = undefined
  const socket = io(uri, { ...opts, query: { ...opts?.query, recoveryToken } })
  socket.io.on('reconnect_attempt', () => {
    socket.io.opts.query = { ...socket.io.opts.query, recoveryToken }
  })
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    subjects.onConnect.next(socket.id)
  })

  socket.on('recovery', payload => (recoveryToken = payload)) // store recovery token
  socket.on('peer', payload => subjects.onClient.next(payload)) // a new peer has connected to the websocket
  socket.on('config', payload => subjects.onConfig.next(payload)) // received ice servers config from the server
  socket.on('call', ({ isBroadcast = false, ...rest }: RoomPayload) => subjects.onCall.next({ isBroadcast, ...rest })) // a peer is calling (or response after creating a room)
  socket.on('join', payload => subjects.onJoin.next(payload)) // a peer has joined a room that you're in
  socket.on('leave', payload => subjects.onLeave.next(payload)) // a peer has left a room or has disconnected
  socket.on('desc', payload => subjects.onSessionDescription.next(payload)) // received a session description from another peer
  socket.on('candidate', payload => subjects.onCandidate.next(payload)) // received an icecandidate from another peer
  socket.on('broadcasts', payload => subjects.onBroadcasts.next(payload)) // the list of broadcasts has been updated on the server
  socket.on('disconnect', () => subjects.onDisconnect.next()) // socket server has disconnected

  return {
    ...subjects,
    me: () => socket.id,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => {
      recoveryToken = undefined
      socket.close()
    },
    createRoom: (payload: { isBroadcast: boolean }) => socket.emit('call', payload),
    makeCall: (payload: { to?: string, isBroadcast: boolean, [key: string]: any }) => socket.emit('call', payload),
    broadcast: (payload: Omit<RoomPayload, 'from'> & { [key: string]: any }) => socket.emit('broadcast', payload),
    join: (payload: Omit<RoomPayload, 'from'> & { [key: string]: any }) => socket.emit('join', payload),
    leave: (payload: Omit<RoomPayload, 'from'>) => {
      recoveryToken = undefined
      socket.emit('leave', payload)
    },
    sendSessionDescription: (sessionDescription: Omit<SessionDescriptionPayload, 'from'>) => socket.emit('desc', sessionDescription),
    sendCandidate: (iceCandidate: Omit<CandidatePayload, 'from'>) => socket.emit('candidate', iceCandidate)
  }
}

export default createIoSignalingChanel
