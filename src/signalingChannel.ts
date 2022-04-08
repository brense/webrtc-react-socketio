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

export type OfferPayload = {
  from: string
  sdp: RTCSessionDescriptionInit
}

export type CandidatePayload = {
  from: string
  candidate: RTCIceCandidateInit
}

export type SignalingChannel = {
  onConnect: { subscribe: (subscriber: (peerId: string) => void) => void }
  onSignal: { subscribe: (subscriber: (payload: SignalPayload) => void) => void }
  onOffer: { subscribe: (subscriber: (payload: OfferPayload) => void) => void }
  onAnswer: { subscribe: (subscriber: (payload: OfferPayload) => void) => void }
  onCandidate: { subscribe: (subscriber: (payload: CandidatePayload) => void) => void }
  sendOffer: (payload: SessionDescription) => void
  sendAnswer: (payload: SessionDescription) => void
  sendCandidate: (payload: IceCandidate) => void
}

function createSocketIOSignalingChannel(socket: Socket): SignalingChannel {
  const onConnect = new Subject<string>()
  const onSignal = new Subject<SignalPayload>()
  const onOffer = new Subject<OfferPayload>()
  const onAnswer = new Subject<OfferPayload>()
  const onCandidate = new Subject<CandidatePayload>()

  socket.on('connect', () => {
    console.log(`Connected to websocket, id: ${socket.id}`)
    onConnect.next(socket.id)
    socket.on('signal', onSignal.next)
    socket.on('offer', onOffer.next)
    socket.on('answer', onAnswer.next)
    socket.on('candidate', onCandidate.next)
  })

  return {
    onConnect,
    onSignal,
    onOffer,
    onAnswer,
    onCandidate,
    sendOffer: sessionDescription => socket.emit('offer', sessionDescription),
    sendAnswer: sessionDescription => socket.emit('answer', sessionDescription),
    sendCandidate: iceCandidate => socket.emit('candidate', iceCandidate)
  }
}

export default createSocketIOSignalingChannel
