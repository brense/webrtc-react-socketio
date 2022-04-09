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
  onConnect: Subject<string>
  onSignal: Subject<SignalPayload>
  onOffer: Subject<OfferPayload>
  onAnswer: Subject<OfferPayload>
  onCandidate: Subject<CandidatePayload>
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
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    onConnect.next(socket.id)
    socket.on('signal', payload => onSignal.next(payload))
    socket.on('offer', payload => onOffer.next(payload))
    socket.on('answer', payload => onAnswer.next(payload))
    socket.on('candidate', payload => onCandidate.next(payload))
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
