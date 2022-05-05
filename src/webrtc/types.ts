import createWebRTCClient from './webRTCClient'

export type ChannelEventPayload = { remotePeerId: string, room: string }
export type MessageEventPayload = { remotePeerId: string, room: string, [key: string]: string | number }
export type TrackEventPayload = { remotePeerId: string, room: string, track: RTCTrackEvent }
export type { Room } from './useCall'
export type WebRTCClient = ReturnType<typeof createWebRTCClient>
