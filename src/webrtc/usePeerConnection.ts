import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useSignalingChannel } from '../signaling'
import jsonDateReviver from './jsonDateReviver'

type PeerConnectionListeners = {
  onNewPeerConnection?: (connection: RTCPeerConnection, identifier: string, configuration?: RTCConfiguration) => void,
  onDataChannel?: (event: RTCDataChannelEvent) => void,
  onTrack?: (event: RTCTrackEvent) => void,
  onNegotiationNeeded?: (options?: RTCOfferOptions) => void,
  onIceCandidate: (event?: RTCPeerConnectionIceEvent) => void,
  onIceGatheringStateChange?: (event: Event) => void,
  onIceCandidateError?: (event: Event) => void,
  onIceConnectionStateChange?: (event: Event) => void
}

type DataChannelListeners<T extends { [key: string]: any }> = {
  onMessage?: (data: T) => void,
  onChannelOpen?: (channel: RTCDataChannel) => void,
  onChannelClose?: (channel: RTCDataChannel) => void
}

function usePeerConnection<T extends { [key: string]: any }>(room: string, { onNewPeerConnection, onIceCandidate, onDataChannel, onChannelOpen, onChannelClose, onMessage, ...peerConnectionListeners }: Omit<PeerConnectionListeners, 'onIceCandidate'> & { onIceCandidate?: (event?: RTCPeerConnectionIceEvent) => void } & DataChannelListeners<T>, configuration?: RTCConfiguration) {
  const peers = useRef<{ [key: string]: { connection: RTCPeerConnection, sender?: RTCRtpSender, channel?: RTCDataChannel } }>({})
  const trackRef = useRef<{ track: MediaStreamTrack, streams: MediaStream[] }>()
  const { sendIceCandidate, sendSessionDescription, socket } = useSignalingChannel()
  const dataChannelListeners = useMemo(() => ({ onChannelOpen, onChannelClose, onMessage }), [onChannelOpen, onChannelClose, onMessage])

  useEffect(() => {
    return () => {
      Object.keys(peers.current).forEach(k => peers.current[k].connection.close)
      peers.current = {}
    }
  }, [room])

  const getPeer = useCallback(({ from: remotePeerId, room: roomCheck }: { from: string, room: string }, forceNew = true) => {
    if (roomCheck !== room) {
      return
    }
    const identifier = `${room},${remotePeerId}`
    if (!peers.current[identifier] || forceNew) {
      console.log('CREATE NEW', peers.current, forceNew)
      peers.current[identifier] && peers.current[identifier].connection.close()
      const connection = createPeerConnection({
        ...peerConnectionListeners,
        onIceCandidate: event => {
          onIceCandidate && onIceCandidate(event)
          event?.candidate && sendIceCandidate({ candidate: event.candidate, room, to: remotePeerId })
        },
        onLocalDescription: sdp => sendSessionDescription({ sdp, room, to: remotePeerId }),
        onDataChannel: event => {
          onDataChannel && onDataChannel(event)
          peers.current[identifier].channel = event.channel
          setDataChannelListeners(event.channel, dataChannelListeners)
        }
      }, configuration)
      if (trackRef.current) {
        connection.addTrack(trackRef.current.track, ...trackRef.current.streams)
      }
      peers.current[identifier] = { connection }
      onNewPeerConnection && onNewPeerConnection(connection, identifier, configuration)
    }
    return peers.current[identifier]
  }, [configuration, room, peerConnectionListeners, onIceCandidate, onNewPeerConnection, sendIceCandidate, sendSessionDescription])

  const getPeersForRoom = useCallback(() => {
    return Object.keys(peers.current).filter(identifier => identifier.indexOf(`${room},`) === 0).map(identifier => ({ ...peers.current[identifier], identifier }))
  }, [room])

  const sendMessage = useCallback((data: T) => {
    getPeersForRoom().filter(({ channel }) => channel?.readyState === 'open').forEach(({ channel }) => channel?.send(JSON.stringify(data)))
  }, [room])

  const createDataChannel = useCallback((identifier: string) => {
    const { channel: existingChannel, connection } = peers.current[identifier]
    const channel = existingChannel || connection.createDataChannel(identifier)
    if (!existingChannel) {
      peers.current[identifier].channel = channel
    }
    setDataChannelListeners(channel, dataChannelListeners)
    return channel
  }, [setDataChannelListeners, room])

  const addTrack = useCallback((track: MediaStreamTrack, ...streams: MediaStream[]) => {
    trackRef.current = { track, streams }
    getPeersForRoom().forEach(async ({ connection, identifier }) => {
      const sender = connection.addTrack(track, ...streams)
      peers.current[identifier].sender = sender
    })
  }, [room])

  const removeTrack = useCallback(() => {
    getPeersForRoom().forEach(({ sender, connection }) => sender && connection.removeTrack(sender))
    trackRef.current = undefined
  }, [room])

  const receiveSessionDescription = useCallback(async ({ sdp, ...payload }: { from: string, room: string, sdp: RTCSessionDescriptionInit }) => {
    if (payload.room !== room) {
      return
    }
    const { connection } = getPeer(payload, false) as { connection: RTCPeerConnection }
    try {
      if (sdp?.type === 'offer') {
        await connection.setRemoteDescription(sdp)
        await connection.setLocalDescription(await connection.createAnswer())
        connection.localDescription && sendSessionDescription({ sdp: connection.localDescription, room, to: payload.from })
      } else if (sdp?.type === 'answer') {
        await connection.setRemoteDescription(sdp)
      } else {
        throw new Error('received unsupported session description type')
      }
    } catch (error) {
      console.error(error)
    }
  }, [getPeer, sendIceCandidate, sendSessionDescription])

  const receiveCandidate = useCallback(async ({ candidate, ...payload }: { from: string, room: string, candidate: RTCIceCandidateInit }) => {
    if (payload.room !== room || !candidate.candidate || candidate.candidate === '') {
      return
    }
    const { connection } = getPeer(payload, false) as { connection: RTCPeerConnection }
    try {
      await connection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch (error) {
      console.error(error)
    }
  }, [getPeer, sendIceCandidate, sendSessionDescription])

  const destroyConnection = useCallback(({ from: remotePeerId, room }: { from: string, room?: string }) => {
    if (remotePeerId && room) {
      const identifier = `${room},${remotePeerId}`
      peers.current[identifier].connection.close()
      delete peers.current[identifier]
    }
  }, [])

  useEffect(() => {
    socket.on('desc', receiveSessionDescription)
    socket.on('candidate', receiveCandidate)
    socket.on('new member', getPeer)
    socket.on('leave', destroyConnection)
    return () => {
      socket.off('desc', receiveSessionDescription)
      socket.off('candidate', receiveCandidate)
      socket.off('new member', getPeer)
      socket.off('leave', destroyConnection)
    }
  }, [socket, room])

  return { sendMessage, createDataChannel, addTrack, removeTrack }
}

function setDataChannelListeners<T extends { [key: string]: any }>(channel: RTCDataChannel, dataChannelListeners: DataChannelListeners<T>) {
  const { onMessage, onChannelOpen, onChannelClose } = dataChannelListeners
  if (channel.readyState !== 'closed') {
    onMessage && (channel.onmessage = message => onMessage(JSON.parse(message.data, jsonDateReviver)))
    onChannelOpen && (channel.onopen = () => onChannelOpen(channel))
    onChannelClose && (channel.onclose = () => onChannelClose(channel))
  }
}

function createPeerConnection<T extends { [key: string]: any }>({ onLocalDescription, onIceCandidate, ...listeners }: PeerConnectionListeners & DataChannelListeners<T> & {
  onLocalDescription: (sdp: RTCSessionDescription | null) => void,
}, configuration?: RTCConfiguration) {
  const connection = new RTCPeerConnection(configuration)

  connection.onicecandidate = onIceCandidate
  connection.onnegotiationneeded = () => onNegotiationNeeded()
  connection.oniceconnectionstatechange = onIceConnectionStateChange
  connection.ondatachannel = onDataChannel
  connection.ontrack = onTrack
  connection.onicecandidateerror = onIceCandidateError
  connection.onicegatheringstatechange = onIceGatheringStateChange

  async function onNegotiationNeeded(options?: RTCOfferOptions) {
    listeners.onNegotiationNeeded && listeners.onNegotiationNeeded(options)
    await connection.setLocalDescription(await connection.createOffer(options))
    onLocalDescription(connection.localDescription)
  }

  async function onIceConnectionStateChange(event: Event) {
    listeners.onIceConnectionStateChange && listeners.onIceConnectionStateChange(event)
    connection.iceConnectionState === 'failed' && onNegotiationNeeded({ iceRestart: true })
  }

  async function onDataChannel(event: RTCDataChannelEvent) {
    listeners.onDataChannel && listeners.onDataChannel(event)
  }

  async function onTrack(event: RTCTrackEvent) {
    listeners.onTrack && listeners.onTrack(event)
  }

  async function onIceCandidateError(event: Event) {
    listeners.onIceCandidateError && listeners.onIceCandidateError(event)
  }

  async function onIceGatheringStateChange(event: Event) {
    listeners.onIceGatheringStateChange && listeners.onIceGatheringStateChange(event)
  }

  return connection
}

export default usePeerConnection
