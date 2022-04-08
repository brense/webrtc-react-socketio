import { Subject } from 'rxjs'
import { SignalingChannel } from './signalingChannel'

function createClient(signalingChannel: SignalingChannel) {
  let localPeerId: string
  const peers: { [key: string]: RTCPeerConnection } = {}
  const channels: { [key: string]: RTCDataChannel } = {}
  const onMessage = new Subject<MessageEvent>()
  const onTrack = new Subject<RTCTrackEvent>()
  const onChannelOpen = new Subject<string>()
  const onChannelClose = new Subject<string>()
  const onPeerConnected = new Subject<string>()
  const onPeerDisconnected = new Subject<string>()

  const connect = async () => {
    signalingChannel.onConnect.subscribe(peerId => {
      localPeerId = peerId
      signalingChannel.onSignal.subscribe(createOffer)
      signalingChannel.onOffer.subscribe(receiveOffer)
      signalingChannel.onAnswer.subscribe(receiveAnswer)
      signalingChannel.onCandidate.subscribe(receiveCandidate)
    })
  }

  const sendMessage = (message: string, to?: string) => {
    const peers = to ? [to] : Object.keys(channels)
    peers.forEach(peer => channels[peer].readyState === 'open' && channels[peer].send(message))
  }

  async function createOffer({ from }: { from: string }) {
    const conn = getPeerConnection(from)
    const channel = conn.createDataChannel(from)
    setDataChannelListeners(channel, from)
    channels[from] = channel
    const offer = await conn.createOffer()
    await conn.setLocalDescription(offer)
    signalingChannel.sendOffer({
      sdp: conn.localDescription,
      from: localPeerId,
      to: from
    })
  }

  async function receiveOffer({ from, sdp }: { from: string, sdp: RTCSessionDescriptionInit }) {
    const conn = getPeerConnection(from)
    await conn.setRemoteDescription(new RTCSessionDescription(sdp))
    // TODO: add track
    const answer = await conn.createAnswer()
    await conn.setLocalDescription(answer)
    signalingChannel.sendAnswer({
      sdp: conn.localDescription,
      from: localPeerId,
      to: from
    })
  }

  function receiveAnswer({ from, sdp }: { from: string, sdp: RTCSessionDescriptionInit }) {
    const conn = getPeerConnection(from)
    conn.setRemoteDescription(new RTCSessionDescription(sdp))
  }

  function receiveCandidate({ from, candidate }: { from: string, candidate: RTCIceCandidateInit }) {
    const conn = getPeerConnection(from)
    if (conn.remoteDescription !== null && candidate !== null) {
      conn.addIceCandidate(new RTCIceCandidate(candidate))
    }
  }

  function setDataChannelListeners(channel: RTCDataChannel, remotePeerId: string) {
    if (channel.readyState !== 'closed') {
      channels[remotePeerId] = channel
    }
    channel.onmessage = onMessage.next
    channel.onopen = () => onChannelOpen.next(remotePeerId)
    channel.onclose = () => {
      if (peers[remotePeerId]) {
        peers[remotePeerId].close()
        delete peers[remotePeerId]
      }
      onChannelClose.next(remotePeerId)
    }
  }

  function getPeerConnection(remotePeerId: string) {
    if (peers[remotePeerId]) {
      return peers[remotePeerId]
    }
    const conn = new RTCPeerConnection()
    peers[remotePeerId] = conn
    conn.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (!conn || !event || !event.candidate) return
      signalingChannel.sendCandidate({
        candidate: event.candidate,
        from: localPeerId,
        to: remotePeerId
      })
    }
    conn.ondatachannel = (event: RTCDataChannelEvent) => {
      console.log('received data channel', remotePeerId)
      channels[remotePeerId] = event.channel
      setDataChannelListeners(event.channel, remotePeerId)
    }
    conn.ontrack = onTrack.next
    conn.oniceconnectionstatechange = (event: Event) => {
      if (conn.iceConnectionState === 'connected') {
        onPeerConnected.next(remotePeerId)
      }
      if (conn.iceConnectionState === 'disconnected') {
        if (peers[remotePeerId]) {
          delete peers[remotePeerId]
        }
        onPeerDisconnected.next(remotePeerId)
      }
    }
    return conn
  }

  return {
    connect,
    sendMessage,
    onMessage: onMessage.subscribe,
    onPeerConnected: onPeerConnected.subscribe,
    onPeerDisconnected: onPeerDisconnected.subscribe,
    onChannelOpen: onChannelOpen.subscribe,
    onChannelClose: onChannelClose.subscribe
  }
}

export type WebRTCClient = ReturnType<typeof createClient>

export default createClient
