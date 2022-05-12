import { Subject } from 'rxjs'
import io, { ManagerOptions, SocketOptions } from 'socket.io-client'
import { ClientPayload, RoomPayload, SessionDescriptionPayload, CandidatePayload } from '.'

const onConnect = new Subject<string>()
const onDisconnect = new Subject<void>()
const onLeave = new Subject<Omit<RoomPayload, 'room'> & { room?: string }>()
const onNewMember = new Subject<ClientPayload>()
const onSessionDescription = new Subject<SessionDescriptionPayload>()
const onIceCandidate = new Subject<CandidatePayload>()
const onConfig = new Subject<RTCIceServer[]>()

function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  let recoveryToken: string | undefined = undefined
  const socket = io(uri, { ...opts, query: { ...opts?.query, recoveryToken } })
  socket.io.on('reconnect_attempt', () => {
    socket.io.opts.query = { ...socket.io.opts.query, recoveryToken }
  })
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    onConnect.next(socket.id)
  })

  socket.on('recovery', payload => (recoveryToken = payload)) // store recovery token
  socket.on('new member', payload => onNewMember.next(payload)) // a new member has joined your broadcast
  socket.on('config', payload => onConfig.next(payload)) // received ice servers config from the server
  socket.on('leave', payload => onLeave.next(payload)) // a member has left a broadcast or has disconnected
  socket.on('desc', payload => onSessionDescription.next(payload)) // received a session description from another peer
  socket.on('candidate', payload => onIceCandidate.next(payload)) // received an icecandidate from another peer
  socket.on('disconnect', () => onDisconnect.next()) // socket server has disconnected

  return {
    onConnect: (cb: (socketId: string) => void) => onConnect.subscribe(cb),
    onDisconnect: (cb: () => void) => onDisconnect.subscribe(cb),
    onLeave: (cb: (payload: Omit<RoomPayload, 'room'> & { room?: string }) => void) => onLeave.subscribe(cb),
    onNewMember: (cb: (payload: ClientPayload) => void) => onNewMember.subscribe(cb),
    onSessionDescription: (cb: (payload: SessionDescriptionPayload) => void) => onSessionDescription.subscribe(cb),
    onIceCandidate: (cb: (payload: CandidatePayload) => void) => onIceCandidate.subscribe(cb),
    onConfig: (cb: (iceServers: RTCIceServer[]) => void) => onConfig.subscribe(cb),
    me: () => socket.id,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => {
      recoveryToken = undefined
      socket.close()
    },
    broadcast: (payload: Omit<RoomPayload, 'from'> & { [key: string]: any }) => socket.emit('broadcast', payload),
    join: (payload: Omit<RoomPayload, 'from'> & { [key: string]: any }) => socket.emit('join', payload),
    leave: (payload: Omit<RoomPayload, 'from'>) => {
      recoveryToken = undefined
      socket.emit('leave', payload)
    },
    sendSessionDescription: (sessionDescription: Omit<SessionDescriptionPayload, 'from'>) => socket.emit('desc', sessionDescription),
    sendIceCandidate: (iceCandidate: Omit<CandidatePayload, 'from'>) => socket.emit('candidate', iceCandidate),
    socket
  }
}

export default createIoSignalingChanel
