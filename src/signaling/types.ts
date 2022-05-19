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
  candidate: RTCIceCandidateInit | null
  to: string
  from: string
}

export type RoomPayload = {
  id: string,
  from: string,
  broadcaster?: string,
  hidden?: boolean,
  [key: string]: any
}

export type OnResponseCallback = (payload: { room: RoomPayload, recoveryToken: string }) => void
