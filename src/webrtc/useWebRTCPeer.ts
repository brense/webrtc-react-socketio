import { useEffect } from 'react'
import jsonDateReviver from './jsonDateReviver'

const connections: { [key: string]: RTCPeerConnection } = {}

function usePeerConnection(room: string, remotePeerId: string, { onTrack, onLocalDescription }: { onTrack: (track: RTCTrackEvent) => void, onLocalDescription: (sdp: RTCSessionDescription | null) => void }) {
  const connectionKey = getConnectionKey(room, remotePeerId)
  const connection = connections[connectionKey] || createPeerConnection(room, remotePeerId, {
    onDataChannel: event => setDataChannelListeners(event.channel, {} as any),
    onNegotiationNeeded: async () => {
      await connection.setLocalDescription(await connection.createOffer())
      onLocalDescription(connection.localDescription)
    },
    onIceCandidate: event => console.log('ice candidate')
  })
  connection.ontrack = event => onTrack(event)
  useEffect(() => {
    return () => connection.close()
  }, [connection])
  return connection
}

function createPeerConnection(room: string, remotePeerId: string, { onDataChannel, onNegotiationNeeded, onIceCandidate }: { onDataChannel: (event: RTCDataChannelEvent) => void, onNegotiationNeeded: (event: Event) => void, onIceCandidate: (event: RTCPeerConnectionIceEvent) => void }) {
  const connectionKey = getConnectionKey(room, remotePeerId)
  const connection = new RTCPeerConnection(configuration)
  connection.onicecandidate = onIceCandidate
  connection.onnegotiationneeded = onNegotiationNeeded
  connection.ondatachannel = onDataChannel
  connection.oniceconnectionstatechange = event => console.info('ice state changed', event)

  connections[connectionKey] = connection
  return connections[connectionKey]
}

function setDataChannelListeners(channel: RTCDataChannel, { onMessage, onChannelOpen, onChannelClose }: { onMessage: (data: { [key: string]: any }) => void, onChannelOpen: () => void, onChannelClose: () => void }) {
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
