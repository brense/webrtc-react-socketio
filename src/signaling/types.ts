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
  from: string
  room: string
  isBroadcast?: boolean
}

export type OnResponseCallback = (payload: { room: string, recoveryToken: string }) => void
