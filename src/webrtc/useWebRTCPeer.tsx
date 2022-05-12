import { createContext, useCallback, useContext, useEffect } from 'react'
import { SignalingChanel } from '../signaling'
import jsonDateReviver from './jsonDateReviver'

const connections: { [key: string]: RTCPeerConnection } = {}

const RTCConfigurationContext = createContext<RTCConfiguration | undefined>(undefined)

export function RTCConfigurationProvider({ children, configuration }: React.PropsWithChildren<{ configuration?: RTCConfiguration }>) {
  return <RTCConfigurationContext.Provider value={configuration}>{children}</RTCConfigurationContext.Provider>
}

function useRTCConfiguration() {
  return useContext(RTCConfigurationContext)
}

const SignalingChanelContext = createContext<SignalingChanel>(undefined as unknown as SignalingChanel)

function SignalingChannelProvider({ children, signalingChannel }: React.PropsWithChildren<{ signalingChannel: SignalingChanel }>) {
  return <SignalingChanelContext.Provider value={signalingChannel}>{children}</SignalingChanelContext.Provider>
}

function useSignalingChannel({ room, autoJoin = true }: { room: string, autoJoin?: boolean }) {
  const signalingChannel = useContext(SignalingChanelContext)

  useEffect(() => {
    if (autoJoin) {
      signalingChannel.join({ room })
    }
  }, [room, signalingChannel, autoJoin])

  const sendSessionDescription = useCallback((sdp: RTCSessionDescription | null, to: string) => {
    signalingChannel.sendSessionDescription({ sdp, room, to })
  }, [signalingChannel, room])

  const sendIceCandidate = useCallback((candidate: RTCIceCandidate | null, to: string) => {
    signalingChannel.sendIceCandidate({ candidate, room, to })
  }, [signalingChannel, room])

  return {
    ...signalingChannel,
    sendSessionDescription,
    sendIceCandidate
  }
}

type UsePeerConnectionParams = {
  room: string,
  remotePeerId: string,
  onTrack: (track: RTCTrackEvent) => void,
  onLocalDescription: (sdp: RTCSessionDescription | null) => void
  onIceCandidate: (candidate: RTCIceCandidate | null) => void
} & SetDataChannelListenersParams

function usePeerConnection({ room, remotePeerId, onTrack, onLocalDescription, onIceCandidate, ...dataChannelListeners }: UsePeerConnectionParams) {
  const configuration = useRTCConfiguration()
  const connectionKey = getConnectionKey(room, remotePeerId)
  const connection = connections[connectionKey] || createPeerConnection({
    room,
    remotePeerId,
    onDataChannel: event => setDataChannelListeners(event.channel, dataChannelListeners),
    onNegotiationNeeded: async () => {
      await connection.setLocalDescription(await connection.createOffer())
      onLocalDescription(connection.localDescription)
    },
    onIceCandidate: event => onIceCandidate(event.candidate),
    configuration
  })
  connection.ontrack = onTrack
  useEffect(() => {
    return () => connection.close()
  }, [connection])
  return connection
}

type CreatePeerConnectionParams = {
  room: string,
  remotePeerId: string,
  configuration?: RTCConfiguration,
  onDataChannel: (event: RTCDataChannelEvent) => void,
  onNegotiationNeeded: (event: Event) => void,
  onIceCandidate: (event: RTCPeerConnectionIceEvent) => void
}

function createPeerConnection({ room, remotePeerId, onDataChannel, onNegotiationNeeded, onIceCandidate, configuration }: CreatePeerConnectionParams) {
  const connectionKey = getConnectionKey(room, remotePeerId)
  const connection = new RTCPeerConnection(configuration)
  connection.onicecandidate = onIceCandidate
  connection.onnegotiationneeded = onNegotiationNeeded
  connection.ondatachannel = onDataChannel
  connection.oniceconnectionstatechange = event => console.info('ice state changed', event)
  connections[connectionKey] = connection
  return connections[connectionKey]
}

type SetDataChannelListenersParams = {
  onMessage: (data: { [key: string]: any }) => void,
  onChannelOpen: () => void,
  onChannelClose: () => void
}

function setDataChannelListeners(channel: RTCDataChannel, { onMessage, onChannelOpen, onChannelClose }: SetDataChannelListenersParams) {
  if (channel.readyState !== 'closed') {
    channel.onmessage = message => onMessage(JSON.parse(message.data, jsonDateReviver))
    channel.onopen = onChannelOpen
    channel.onclose = onChannelClose
  }
}

function getConnectionKey(room: string, remotePeerId: string) {
  return `${room}|${remotePeerId}`
}

export default usePeerConnection
