import { Subject } from 'rxjs'
import { Socket } from 'socket.io-client'

export type SessionDescription = {
  sdp: RTCSessionDescription | null,
  from: string,
  to: string
}

export type IceCandidate = {
  candidate: RTCIceCandidate,
  from: string,
  to: string
}

export type SignalPayload = {
  from: string
}

export type SessionDescriptionPayload = {
  from: string
  sdp: RTCSessionDescriptionInit
}

export type CandidatePayload = {
  from: string
  candidate: RTCIceCandidateInit
}

export type SignalingChannel = {
  onConnect: Subject<string>
  onSignal: Subject<SignalPayload>
  onSessionDescription: Subject<SessionDescriptionPayload>
  onOffer: Subject<SessionDescriptionPayload>
  onAnswer: Subject<SessionDescriptionPayload>
  onCandidate: Subject<CandidatePayload>
  onDisconnected: Subject<string>
  sendOffer: (payload: SessionDescription) => void
  sendAnswer: (payload: SessionDescription) => void
  sendSessionDescription: (payload: SessionDescription) => void
  sendCandidate: (payload: IceCandidate) => void
}

function createSocketIOSignalingChannel(socket: Socket): SignalingChannel {
  const onConnect = new Subject<string>()
  const onSignal = new Subject<SignalPayload>()
  const onSessionDescription = new Subject<SessionDescriptionPayload>()
  const onOffer = new Subject<SessionDescriptionPayload>()
  const onAnswer = new Subject<SessionDescriptionPayload>()
  const onCandidate = new Subject<CandidatePayload>()
  const onDisconnected = new Subject<string>()

  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    onConnect.next(socket.id)
    socket.on('signal', payload => onSignal.next(payload))
    socket.on('description', payload => onSessionDescription.next(payload))
    socket.on('offer', payload => onOffer.next(payload))
    socket.on('answer', payload => onAnswer.next(payload))
    socket.on('candidate', payload => onCandidate.next(payload))
    socket.on('disconnected', payload => onDisconnected.next(payload))
  })

  if (!socket.connected) {
    socket.connect()
  }

  return {
    onConnect,
    onSignal,
    onSessionDescription,
    onOffer,
    onAnswer,
    onCandidate,
    onDisconnected,
    sendSessionDescription: sessionDescription => socket.emit('description', sessionDescription),
    sendOffer: sessionDescription => socket.emit('offer', sessionDescription),
    sendAnswer: sessionDescription => socket.emit('answer', sessionDescription),
    sendCandidate: iceCandidate => socket.emit('candidate', iceCandidate)
  }
}

export default createSocketIOSignalingChannel
