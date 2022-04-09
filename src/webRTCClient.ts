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
      signalingChannel.onSignal.subscribe(payload => true ? createOffer(payload) : getPeerConnection(payload.from))
      signalingChannel.onOffer.subscribe(receiveOffer)
      signalingChannel.onAnswer.subscribe(receiveAnswer)
      signalingChannel.onCandidate.subscribe(receiveCandidate)
    })
  }

  const sendMessage = (message: string, to?: string) => {
    const peers = to ? [to] : Object.keys(channels)
    peers.forEach(peer => channels[peer].readyState === 'open' && channels[peer].send(message))
  }

  async function createOffer({ from: remotePeerId }: { from: string }) {
    const conn = getPeerConnection(remotePeerId)
    console.log('create offer for', remotePeerId)
    try {
      await conn.setLocalDescription(await conn.createOffer())
      signalingChannel.sendOffer({
        sdp: conn.localDescription,
        from: localPeerId,
        to: remotePeerId
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function receiveOffer({ from: remotePeerId, sdp }: { from: string, sdp: RTCSessionDescriptionInit }) {
    const conn = getPeerConnection(remotePeerId)
    try {
      conn.signalingState !== 'stable' && await conn.setRemoteDescription(new RTCSessionDescription(sdp))

      const channel = conn.createDataChannel(remotePeerId)
      setDataChannelListeners(channel, remotePeerId)
      channels[remotePeerId] = channel

      conn.signalingState !== 'stable' && await conn.setLocalDescription(await conn.createAnswer())
    } catch (err) {
      console.error(err, conn)
    }
    signalingChannel.sendAnswer({
      sdp: conn.localDescription,
      from: localPeerId,
      to: remotePeerId
    })
  }

  async function receiveAnswer({ from: remotePeerId, sdp }: { from: string, sdp: RTCSessionDescriptionInit }) {
    const conn = getPeerConnection(remotePeerId)
    try {
      await conn.setRemoteDescription(new RTCSessionDescription(sdp))
    } catch (err) {
      //console.error(err, remotePeerId)
    }
  }

  async function receiveCandidate({ from: remotePeerId, candidate }: { from: string, candidate: RTCIceCandidateInit }) {
    const conn = getPeerConnection(remotePeerId)
    if (conn.remoteDescription !== null && candidate !== null) {
      await conn.addIceCandidate(new RTCIceCandidate(candidate))
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
    if (remotePeerId && peers[remotePeerId]) {
      return peers[remotePeerId]
    }
    console.log('create new connection with', remotePeerId)
    const conn = new RTCPeerConnection()
    conn.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      console.log('send ice candidate', remotePeerId, channels)
      if (!conn || !event || !event.candidate) return
      signalingChannel.sendCandidate({
        candidate: event.candidate,
        from: localPeerId,
        to: remotePeerId
      })
    }
    conn.onnegotiationneeded = () => { console.log('negotation for', remotePeerId); createOffer({ from: remotePeerId }) }
    conn.ondatachannel = (event: RTCDataChannelEvent) => {
      channels[remotePeerId] = event.channel
      setDataChannelListeners(event.channel, remotePeerId)
      console.log('received data channel', remotePeerId, channels)
    }
    conn.ontrack = onTrack.next
    conn.oniceconnectionstatechange = (event: Event) => {
      if (conn.iceConnectionState === 'connected') {
        console.log('peer connected', remotePeerId)
        onPeerConnected.next(remotePeerId)
      }
      if (conn.iceConnectionState === 'disconnected') {
        console.log('peer disconnected', remotePeerId)
        if (peers[remotePeerId]) {
          delete peers[remotePeerId]
        }
        onPeerDisconnected.next(remotePeerId)
      }
    }
    peers[remotePeerId] = conn
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
