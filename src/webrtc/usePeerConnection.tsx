import { useCallback } from 'react'
import { useSignalingChannel } from '../signaling'
import jsonDateReviver from './jsonDateReviver'

const connections: { [key: string]: RTCPeerConnection } = {}
const senders: { [key: string]: RTCRtpSender } = {}
const channels: { [key: string]: RTCDataChannel } = {}

type CreatePeerConnectionParams = {
  identifier: string,
  configuration?: RTCConfiguration,
  onDataChannel: (event: RTCDataChannelEvent) => void,
  onNegotiationNeeded: (options?: RTCOfferOptions) => void,
  onIceCandidate: (event: RTCPeerConnectionIceEvent) => void
}

type DataChannelListeners = {
  onMessage?: (data: { [key: string]: any }) => void,
  onChannelOpen?: () => void,
  onChannelClose?: () => void
}

type UsePeerConnectionParams = {
  identifier: string,
  onLocalDescription: (sdp: RTCSessionDescription | null) => void,
  onIceCandidate: (candidate: RTCIceCandidate | null) => void,
  onTrack?: (track: RTCTrackEvent) => void
}

function usePeerConnection({ room: roomCheck, onTrack, onMessage, onChannelOpen, onChannelClose, ...configuration }: { room: string, onTrack?: (track: RTCTrackEvent) => void } & DataChannelListeners & RTCConfiguration) {
  const setDataChannelListeners = useCallback((channel: RTCDataChannel, dataChannelListeners: DataChannelListeners) => {
    const { onMessage, onChannelOpen, onChannelClose } = dataChannelListeners
    if (channel.readyState !== 'closed') {
      channel.onmessage = message => onMessage && onMessage(JSON.parse(message.data, jsonDateReviver))
      if (onChannelOpen) {
        channel.onopen = onChannelOpen
      }
      if (onChannelClose) {
        channel.onclose = onChannelClose
      }
    }
  }, [])

  const createPeerConnection = useCallback(({ identifier, onDataChannel, onNegotiationNeeded, onIceCandidate, configuration }: CreatePeerConnectionParams) => {
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = onIceCandidate
    connection.onnegotiationneeded = () => onNegotiationNeeded()
    connection.ondatachannel = onDataChannel
    connection.oniceconnectionstatechange = () => connection.iceConnectionState === 'failed' && onNegotiationNeeded({ iceRestart: true })
    const channel = connection.createDataChannel(identifier)
    setDataChannelListeners(channel, { onMessage, onChannelOpen, onChannelClose })
    connections[identifier] = connection
    return connection
  }, [onChannelClose, onChannelOpen, onMessage, setDataChannelListeners])

  const getPeerConnection = useCallback(({ identifier, onTrack, onLocalDescription, onIceCandidate }: UsePeerConnectionParams) => {
    const connection = connections[identifier] || createPeerConnection({
      identifier,
      onDataChannel: event => {
        setDataChannelListeners(event.channel, { onMessage, onChannelOpen, onChannelClose })
        channels[identifier] = event.channel
      },
      onNegotiationNeeded: async (options?: RTCOfferOptions) => {
        console.log('negotiation needed', identifier)
        await connection.setLocalDescription(await connection.createOffer(options))
        onLocalDescription(connection.localDescription)
      },
      onIceCandidate: event => {
        console.log('ice candidate', event)
        onIceCandidate(event.candidate)
      },
      configuration
    })
    if (onTrack) {
      connection.ontrack = track => {
        console.log('TRACK!', track)
        onTrack(track)
      }
    }
    return connection
  }, [configuration, createPeerConnection, onChannelClose, onChannelOpen, onMessage, setDataChannelListeners])

  const { sendSessionDescription, sendIceCandidate } = useSignalingChannel({
    onSessionDescription: ({ room, sdp, from: remotePeerId, ...rest }) => sdp && (!roomCheck || room === roomCheck) && receiveSessionDescription({
      identifier: `${room},${remotePeerId}`,
      sdp,
      onLocalDescription: localSdp => localSdp && sendSessionDescription({ sdp: localSdp, room, to: remotePeerId })
    }),
    onIceCandidate: ({ room, candidate, from: remotePeerId }) => {
      console.log('remote ice candidate', candidate)
      candidate && (!roomCheck || room === roomCheck) && receiveCandidate({
        identifier: `${room},${remotePeerId}`,
        candidate
      })
    },
    onNewMember: ({ room, from: remotePeerId }) => (!roomCheck || room === roomCheck) && getPeerConnection({
      identifier: `${room},${remotePeerId}`,
      onLocalDescription: sdp => sendSessionDescription({ sdp, room, to: remotePeerId }),
      onIceCandidate: candidate => sendIceCandidate({ candidate, room, to: remotePeerId })
    }),
    onLeave: () => {/* TODO: destroy connection? */ }
  })

  const receiveSessionDescription = useCallback(async ({ identifier, sdp, onLocalDescription }: { identifier: string, sdp: RTCSessionDescriptionInit, onLocalDescription: (sdp: RTCSessionDescription) => void, }) => {
    const [room, remotePeerId] = identifier.split(',')
    const connection = getPeerConnection({
      identifier,
      onLocalDescription: sdp => sendSessionDescription({ sdp, room, to: remotePeerId }),
      onIceCandidate: candidate => sendIceCandidate({ candidate, room, to: remotePeerId })
    })
    try {
      if (sdp?.type === 'offer') {
        await connection.setRemoteDescription(sdp)
        await connection.setLocalDescription(await connection.createAnswer())
        connection.localDescription && onLocalDescription(connection.localDescription)
      } else if (sdp?.type === 'answer') {
        await connection.setRemoteDescription(sdp)
      } else {
        throw new Error('received unsupported session description type')
      }
    } catch (error) {
      console.error(error)
    }
  }, [getPeerConnection, sendIceCandidate, sendSessionDescription])

  const receiveCandidate = useCallback(async ({ identifier, candidate }: { identifier: string, candidate: RTCIceCandidateInit }) => {
    const [room, remotePeerId] = identifier.split(',')
    const connection = getPeerConnection({
      identifier,
      onLocalDescription: sdp => sendSessionDescription({ sdp, room, to: remotePeerId }),
      onIceCandidate: candidate => sendIceCandidate({ candidate, room, to: remotePeerId })
    })
    try {
      await connection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error(error)
    }
  }, [getPeerConnection, sendIceCandidate, sendSessionDescription])

  const sendMessage = useCallback((data: { [key: string]: any }) => {
    getChannelIdentifiersForRoom(roomCheck).forEach(identifier => channels[identifier]?.send(JSON.stringify(data)))
  }, [roomCheck])

  const addTrack = useCallback((track: MediaStreamTrack, ...streams: MediaStream[]) => {
    console.log('add track', connections)
    getConnectionIdentifiersForRoom(roomCheck).forEach(identifier => {
      console.log('CONN', connections[identifier])
      const sender = connections[identifier]?.addTrack(track, ...streams)
      senders[identifier] = sender
    })
  }, [roomCheck])

  const removeTrack = useCallback(() => {
    getConnectionIdentifiersForRoom(roomCheck).forEach(identifier => senders[identifier] && connections[identifier]?.removeTrack(senders[identifier]))
  }, [roomCheck])

  return {
    sendMessage,
    addTrack,
    removeTrack
  }
}

function getConnectionIdentifiersForRoom(room: string) {
  return Object.keys(connections).filter(identifier => identifier.indexOf(`${room},`) === 0)
}

function getChannelIdentifiersForRoom(room: string) {
  return Object.keys(channels).filter(identifier => identifier.indexOf(`${room},`) === 0)
}

export default usePeerConnection
