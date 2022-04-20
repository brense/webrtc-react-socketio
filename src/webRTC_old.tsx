import React, { useContext, useEffect, useState } from 'react'
import { Subject, Subscription } from 'rxjs'
import io, { ManagerOptions, SocketOptions } from 'socket.io-client'

export type SignalPayload = {
  from: string
}

export type SessionDescriptionPayload = {
  from: string
  sdp: RTCSessionDescriptionInit | null
}

export type CandidatePayload = {
  from: string
  candidate: RTCIceCandidateInit
}

const onMessage = new Subject<MessageEvent>()
const onTrack = new Subject<RTCTrackEvent>()
const onChannelOpen = new Subject<string>()
const onChannelClose = new Subject<string>()
const onPeerConnected = new Subject<string>()
const onPeerDisconnected = new Subject<string>()

export function createWebRTCClient(signalingChannel: ReturnType<typeof createIoSignalingChanel>, configuration?: RTCConfiguration) {
  let localPeerId: string
  const peers: Array<{ remotePeerId: string, connection: RTCPeerConnection }> = []
  const channels: Array<{ remotePeerId: string, channel: RTCDataChannel }> = []

  signalingChannel.onConnect.subscribe(payload => localPeerId = payload)
  signalingChannel.onSignal.subscribe(respondToSignal)
  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onSocketDisconnected.subscribe(handlePeerDisconnected)
  signalingChannel.onDisconnect.subscribe(() => peers.forEach(peer => peer.connection.close()))

  function connect() {
    signalingChannel.connect()
  }

  async function respondToSignal({ from: remotePeerId }: { from: string }) {
    const connection = getPeerConnection(remotePeerId)
    await connection.setLocalDescription(await connection.createOffer())
    signalingChannel.sendSessionDescription({
      sdp: connection.localDescription,
      from: localPeerId,
      to: remotePeerId
    })
  }

  async function receiveSessionDescription({ from: remotePeerId, sdp }: SessionDescriptionPayload) {
    const connection = getPeerConnection(remotePeerId)
    if (sdp?.type === 'offer') {
      console.log('received offer', sdp)
      await connection.setRemoteDescription(new RTCSessionDescription(sdp))

      // TODO: create audio stream... https://www.html5rocks.com/en/tutorials/webrtc/basics/
      const channel = connection.createDataChannel(remotePeerId)
      setDataChannelListeners(channel, remotePeerId)
      channels.push({ remotePeerId, channel })

      sendAnswer(remotePeerId)
    } else if (sdp?.type === 'answer') {
      console.log('received answer', sdp)
      await connection.setRemoteDescription(sdp)
    } else {
      console.log('received unsupported session description type', sdp, connection)
    }
  }

  async function receiveCandidate({ from: remotePeerId, candidate }: CandidatePayload) {
    console.log('received candidate', remotePeerId, candidate)
    const connection = getPeerConnection(remotePeerId)
    await connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  function onIceCandidate(event: RTCPeerConnectionIceEvent, remotePeerId: string) {
    if (event.candidate) {
      console.log('ice candidate', event.candidate)
      signalingChannel.sendCandidate({ candidate: event.candidate, from: localPeerId, to: remotePeerId })
    }
  }

  async function sendAnswer(remotePeerId: string) {
    const connection = getPeerConnection(remotePeerId)
    console.log('respond to offer', remotePeerId, connection)
    await connection.setLocalDescription(await connection.createAnswer())
    signalingChannel.sendSessionDescription({
      sdp: connection.localDescription,
      from: localPeerId,
      to: remotePeerId
    })
  }

  function setDataChannelListeners(channel: RTCDataChannel, remotePeerId: string) {
    if (channel.readyState !== 'closed') {
      channel.onmessage = message => onMessage.next(message)
      channel.onopen = () => onChannelOpen.next(remotePeerId)
      channel.onclose = () => {
        console.log('channel closed', remotePeerId)
        const index = peers.findIndex(peer => peer.remotePeerId === remotePeerId)
        if (index >= 0) {
          peers[index].connection.close()
          peers.splice(index, 1)
        }
        onChannelClose.next(remotePeerId)
      }
      channels.push({ channel, remotePeerId })
      console.log('received data channel', remotePeerId, channel)
    }
  }

  function handlePeerDisconnected(remotePeerId: string) {
    const index = peers.findIndex(peer => peer.remotePeerId === remotePeerId)
    if (index >= 0) {
      peers.splice(index, 1)
    }
    console.log('peer disconnected', remotePeerId)
    onPeerDisconnected.next(remotePeerId)
  }

  function onIceConnectionStateChange(remotePeerId: string) {
    const match = peers.find(peer => peer.remotePeerId === remotePeerId)
    if (match?.connection.iceConnectionState === 'connected') {
      console.log('peer connected', remotePeerId)
      onPeerConnected.next(remotePeerId)
    }
    if (match?.connection.iceConnectionState === 'disconnected') {
      handlePeerDisconnected(remotePeerId)
    }
  }

  function getPeerConnection(remotePeerId: string) {
    const match = peers.find(peer => peer.remotePeerId === remotePeerId)
    if (match) {
      return match.connection
    }
    console.log('create new connection with', remotePeerId)
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = event => onIceCandidate(event, remotePeerId)
    connection.onnegotiationneeded = () => respondToSignal({ from: remotePeerId })
    connection.ondatachannel = event => setDataChannelListeners(event.channel, remotePeerId)
    connection.ontrack = track => onTrack.next(track)
    connection.oniceconnectionstatechange = () => onIceConnectionStateChange(remotePeerId)
    peers.push({ remotePeerId, connection })
    return connection
  }

  return {
    connect,
    onMessage,
    onTrack,
    onChannelOpen,
    onChannelClose,
    onPeerConnected,
    onPeerDisconnected
  }
}

const onConnect = new Subject<string>()
const onDisconnect = new Subject()
const onSignal = new Subject<SignalPayload>()
const onSessionDescription = new Subject<SessionDescriptionPayload>()
const onCandidate = new Subject<CandidatePayload>()
const onSocketDisconnected = new Subject<string>()

export function createIoSignalingChanel(uri: string, opts?: Partial<ManagerOptions & SocketOptions> | undefined) {
  const socket = io(uri, opts)
  socket.on('connect', () => {
    console.log(`Connected to websocket, localPeerId: ${socket.id}`)
    onConnect.next(socket.id)
  })

  socket.on('signal', payload => onSignal.next(payload))
  socket.on('desc', payload => onSessionDescription.next(payload))
  socket.on('candidate', payload => onCandidate.next(payload))
  socket.on('disconnected', payload => onSocketDisconnected.next(payload))

  socket.on('disconnect', () => {
    onDisconnect.next(undefined)
  })

  return {
    onConnect,
    onDisconnect,
    onSignal,
    onSessionDescription,
    onCandidate,
    onSocketDisconnected,
    connect: () => !socket.connected && socket.connect(),
    disconnect: () => socket.close(),
    sendSessionDescription: (sessionDescription: SessionDescriptionPayload & { to: string }) => socket.emit('desc', sessionDescription),
    sendCandidate: (iceCandidate: CandidatePayload & { to: string }) => socket.emit('candidate', iceCandidate)
  }
}

export type WebRTCClient = ReturnType<typeof createWebRTCClient>

export type SignalingChanel = ReturnType<typeof createIoSignalingChanel>

const WebRTCClientContext = React.createContext<WebRTCClient>(undefined as unknown as WebRTCClient)
const SignalingChanelContext = React.createContext<SignalingChanel>(undefined as unknown as SignalingChanel)

export function WebRTCClientProvider({ children, client }: React.PropsWithChildren<{ client: WebRTCClient }>) {
  return <WebRTCClientContext.Provider value={client}>{children}</WebRTCClientContext.Provider>
}

export function SignalingChannelProvider({ children, signalingChannel }: React.PropsWithChildren<{ signalingChannel: SignalingChanel }>) {
  return <SignalingChanelContext.Provider value={signalingChannel}>{children}</SignalingChanelContext.Provider>
}

export function useWebRTC() {
  const [peers, setPeers] = useState<Array<{ peerId: string, name: string }>>([])
  const webRTCClient = useContext(WebRTCClientContext)
  useEffect(() => {
    const subscriptions: Subscription[] = []
    subscriptions.push(webRTCClient.onPeerConnected.subscribe(peerId => setPeers(peers => [...peers, { peerId, name: '' }])))
    // TODO: listen for name
    subscriptions.push(webRTCClient.onPeerDisconnected.subscribe(peerId => setPeers(peers => [...peers.filter(peer => peer.peerId !== peerId)])))
    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
  return { peers, ...webRTCClient }
}

export function useSignalingChannel() {
  const [isConnected, setIsConnected] = useState(false)
  const signalingChannel = useContext(SignalingChanelContext)
  useEffect(() => {
    const subscriptions: Subscription[] = []
    subscriptions.push(signalingChannel.onConnect.subscribe(() => setIsConnected(true)))
    subscriptions.push(signalingChannel.onDisconnect.subscribe(() => setIsConnected(false)))
    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
  return { isConnected, ...signalingChannel }
}
