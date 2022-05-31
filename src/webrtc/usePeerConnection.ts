import { useCallback, useRef } from 'react'
import { useSignalingChannel } from '../signaling'
import jsonDateReviver from './jsonDateReviver'

const connections: { [key: string]: RTCPeerConnection } = {}
const senders: { [key: string]: RTCRtpSender } = {}
const channels: { [key: string]: RTCDataChannel } = {}

type CreatePeerConnectionParams = {
  identifier: string,
  configuration?: RTCConfiguration,
  onDataChannel?: (event: RTCDataChannelEvent) => void,
  onTrack?: (event: RTCTrackEvent) => void,
  onNegotiationNeeded: (options?: RTCOfferOptions) => void,
  onIceCandidate: (event: RTCPeerConnectionIceEvent) => void,
}

type DataChannelListeners<T extends { [key: string]: any }> = {
  onMessage?: (data: T) => void,
  onChannelOpen?: (channel: RTCDataChannel) => void,
  onChannelClose?: (channel: RTCDataChannel) => void
}

type UsePeerConnectionParams = {
  identifier: string,
  onLocalDescription: (sdp: RTCSessionDescription | null) => void,
  onIceCandidate: (candidate: RTCIceCandidate | null) => void,
  onTrack?: (track: RTCTrackEvent) => void
}

function usePeerConnection<T extends { [key: string]: any }>({ room: roomCheck, onTrack, onMessage, onChannelOpen, onChannelClose, onIceCandidateError, ...configuration }: { room: string, onIceCandidateError?: (event: Event) => void, onTrack?: (track: RTCTrackEvent) => void } & DataChannelListeners<T> & RTCConfiguration) {
  const trackRef = useRef<{ track: MediaStreamTrack, streams: MediaStream[] }>()

  const setDataChannelListeners = useCallback((channel: RTCDataChannel, dataChannelListeners: DataChannelListeners<T>) => {
    const { onMessage, onChannelOpen, onChannelClose } = dataChannelListeners
    if (channel.readyState !== 'closed') {
      channel.onmessage = message => {
        onMessage && onMessage(JSON.parse(message.data, jsonDateReviver))
      }
      if (onChannelOpen) {
        channel.onopen = () => onChannelOpen(channel)
      }
      if (onChannelClose) {
        channel.onclose = () => onChannelClose(channel)
      }
    }
  }, [])

  const createPeerConnection = useCallback(({ identifier, onDataChannel, onTrack, onNegotiationNeeded, onIceCandidate, configuration }: CreatePeerConnectionParams) => {
    console.info('using config:', configuration)
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = onIceCandidate
    connection.onnegotiationneeded = () => onNegotiationNeeded()
    connection.oniceconnectionstatechange = () => connection.iceConnectionState === 'failed' && onNegotiationNeeded({ iceRestart: true })
    onDataChannel && (connection.ondatachannel = onDataChannel)
    onTrack && (connection.ontrack = onTrack)
    onIceCandidateError && (connection.onicecandidateerror = onIceCandidateError)
    connections[identifier] = connection
    if (trackRef.current && !senders[identifier]) {
      senders[identifier] = connection.addTrack(trackRef.current.track, ...trackRef.current.streams)
    }
    return connection
  }, [])

  const getPeerConnection = useCallback(({ identifier, onLocalDescription, onIceCandidate }: UsePeerConnectionParams) => {
    const connection = connections[identifier] || createPeerConnection({
      identifier,
      onDataChannel: event => {
        setDataChannelListeners(event.channel, { onMessage, onChannelOpen, onChannelClose })
        channels[identifier] = event.channel
      },
      onTrack: event => {
        onTrack && onTrack(event)
      },
      onNegotiationNeeded: async (options?: RTCOfferOptions) => {
        await connection.setLocalDescription(await connection.createOffer(options))
        onLocalDescription(connection.localDescription)
      },
      onIceCandidate: event => {
        onIceCandidate(event.candidate)
      },
      configuration
    })
    return connection
  }, [configuration, createPeerConnection, onTrack, onChannelClose, onChannelOpen, onMessage, setDataChannelListeners])

  const { sendSessionDescription, sendIceCandidate } = useSignalingChannel({
    onSessionDescription: ({ room, sdp, from: remotePeerId }) => sdp && (!roomCheck || room === roomCheck) && receiveSessionDescription({
      identifier: `${room},${remotePeerId}`,
      sdp,
      onLocalDescription: localSdp => localSdp && sendSessionDescription({ sdp: localSdp, room, to: remotePeerId })
    }),
    onIceCandidate: ({ room, candidate, from: remotePeerId }) => candidate && (!roomCheck || room === roomCheck) && receiveCandidate({
      identifier: `${room},${remotePeerId}`,
      candidate
    }),
    onNewMember: ({ room, from: remotePeerId }) => (!roomCheck || room === roomCheck) && getPeerConnection({
      identifier: `${room},${remotePeerId}`,
      onLocalDescription: sdp => sendSessionDescription({ sdp, room, to: remotePeerId }),
      onIceCandidate: candidate => sendIceCandidate({ candidate, room, to: remotePeerId })
    }),
    onLeave: ({ room, from: remotePeerId }) => room && (!roomCheck || room === roomCheck) && destroyConnection(`${room},${remotePeerId}`)
  })

  const destroyConnection = useCallback((identifier: string) => {
    channels[identifier]?.close()
    senders[identifier]?.track?.stop()
    connections[identifier]?.close()
    delete connections[identifier]
    delete channels[identifier]
    delete senders[identifier]
  }, [])

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

  const sendMessage = useCallback((data: T) => {
    const identifiersForRoom = getChannelIdentifiersForRoom(roomCheck).filter(identifier => channels[identifier].readyState === 'open')
    identifiersForRoom.forEach(identifier => channels[identifier]?.send(JSON.stringify(data)))
  }, [roomCheck])

  const createDataChannel = useCallback(({ room, remotePeerId }: { room: string, remotePeerId: string }) => {
    const identifier = `${room},${remotePeerId}`
    const channel = connections[identifier]?.createDataChannel(identifier)
    setDataChannelListeners(channel, { onMessage, onChannelOpen, onChannelClose })
    channels[identifier] = channel
  }, [onChannelClose, onChannelOpen, onMessage, roomCheck, setDataChannelListeners])

  const addTrack = useCallback((track: MediaStreamTrack, ...streams: MediaStream[]) => {
    trackRef.current = { track, streams }
    getConnectionIdentifiersForRoom(roomCheck).forEach(identifier => {
      const sender = connections[identifier]?.addTrack(track, ...streams)
      senders[identifier] = sender
    })
  }, [roomCheck])

  const removeTrack = useCallback(() => {
    trackRef.current = undefined
    getConnectionIdentifiersForRoom(roomCheck).forEach(identifier => senders[identifier] && connections[identifier]?.removeTrack(senders[identifier]))
  }, [roomCheck])

  return {
    createDataChannel,
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
