import React, { useContext } from 'react'
import { Subject } from 'rxjs'
import { CandidatePayload, createIoSignalingChanel, RoomPayload, SessionDescriptionPayload } from './signalingChannel'

const onMessage = new Subject<{ [key: string]: string | number }>()
const onTrack = new Subject<RTCTrackEvent>()
const onChannelOpen = new Subject<{ remotePeerId: string, room: string }>()
const onChannelClose = new Subject<{ remotePeerId: string, room: string }>()

export function createWebRTCClient({ signalingChannel, ...configuration }: RTCConfiguration & { signalingChannel: ReturnType<typeof createIoSignalingChanel> }) {
  let identifier = 'peer'
  const connections: Array<{ room: string, remotePeerId: string, connection: RTCPeerConnection, channel?: RTCDataChannel, sender?: RTCRtpSender }> = []

  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onLeave.subscribe(closeConnection)

  async function sendOffer({ from: remotePeerId, room }: RoomPayload) {
    const { connection, channel } = getPeerConnection(room, remotePeerId)
    if (!channel) {
      console.log('create datachannel for room', room)
      setDataChannelListeners(connection.createDataChannel(room), room, remotePeerId)
    }
  }

  async function broadcast(room: string) {
    return joinRoom(room, { isPassive: false, isBroadcast: true })
  }

  async function call(room: string) {
    return joinRoom(room, { isPassive: false, isBroadcast: false })
  }

  async function joinRoom(room: string, options?: { isPassive?: boolean, isBroadcast?: boolean }) {
    const { isPassive = true, isBroadcast = false } = options || {}
    const { onNewPeer } = signalingChannel.join({ room, isBroadcast })
    const leave = () => signalingChannel.leave({ room })
    if (!isPassive) {
      const subscription = onNewPeer.subscribe(sendOffer)
      return {
        leave: () => {
          subscription.unsubscribe()
          leave()
        },
        sendMessage: (data: { [key: string]: any; }) => sendMessage(room, data),
        addTrack: (track: MediaStreamTrack, ...streams: MediaStream[]) => addTrack(room, track, ...streams),
        remoteTrack: () => removeTrack(room)
      }
    }
    return { leave }
  }

  async function leaveRoom(room: string) {
    signalingChannel.leave({ room })
  }

  async function closeConnection({ from: remotePeerId, room }: Omit<RoomPayload, | 'room'> & { room?: string }) {
    const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
    if (index >= 0) {
      connections[index].connection.close()
      connections[index].channel?.close()
      connections.splice(index, 1)
    }
  }

  async function receiveSessionDescription({ room, sdp, from: remotePeerId }: SessionDescriptionPayload) {
    const { connection } = getPeerConnection(room, remotePeerId)
    if (sdp?.type === 'offer') {
      console.log('received offer', room, remotePeerId, sdp)
      try {
        await connection.setRemoteDescription(sdp)
      } catch (e) {
        console.log('error', e)
      }
      console.log('respond to offer', room, remotePeerId, connection)
      try {
        await connection.setLocalDescription(await connection.createAnswer())
      } catch (e) {
        console.log('error', e)
      }
      signalingChannel.sendSessionDescription({
        sdp: connection.localDescription,
        room,
        to: remotePeerId
      })
    } else if (sdp?.type === 'answer') {
      console.log('received answer', room, remotePeerId, sdp)
      try {
        await connection.setRemoteDescription(sdp)
      } catch (e) {
        console.log('error', e)
      }
    } else {
      console.log('received unsupported session description type', sdp, connection)
    }
  }

  async function receiveCandidate({ room, candidate, from: remotePeerId }: CandidatePayload) {
    console.log('received candidate', room, remotePeerId, candidate)
    const { connection } = getPeerConnection(room, remotePeerId)
    await connection.addIceCandidate(new RTCIceCandidate(candidate))
  }

  function onIceCandidate(event: RTCPeerConnectionIceEvent, room: string) {
    if (event.candidate) {
      console.log('ice candidate', event.candidate)
      signalingChannel.sendCandidate({
        candidate: event.candidate,
        room,
        to: room
      })
    }
  }

  function setDataChannelListeners(channel: RTCDataChannel, room: string, remotePeerId: string) {
    if (channel.readyState !== 'closed') {
      channel.onmessage = message => onMessage.next(JSON.parse(message.data, dateReviver))
      channel.onopen = () => {
        onChannelOpen.next({ remotePeerId, room })
        sendMessage(room, { name: 'System', message: `${identifier || 'peer'} has joined`, date: new Date() })
      }
      channel.onclose = () => {
        console.log('channel closed', room, remotePeerId)
        const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
        if (index >= 0) {
          connections[index].connection.close()
          connections.splice(index, 1)
        }
        onChannelClose.next({ remotePeerId, room })
        sendMessage(room, { name: 'System', message: `${identifier || 'peer'} has left`, date: new Date() })
      }
      const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
      connections[index] = { ...connections[index], channel }
      console.log('received data channel', room, remotePeerId, channel)
    }
  }

  function getPeerConnection(room: string, remotePeerId: string) {
    const existingConnection = connections.find(c => c.room === room && c.remotePeerId === remotePeerId)
    if (existingConnection) {
      return existingConnection
    }
    console.log(`create new connection for room "${room}"`)
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = event => onIceCandidate(event, room)
    connection.onnegotiationneeded = async event => {
      await connection.setLocalDescription(await connection.createOffer())
      console.log('send offer', remotePeerId, room, connection)
      signalingChannel.sendSessionDescription({
        sdp: connection.localDescription,
        room,
        to: remotePeerId
      })
    }
    connection.ondatachannel = event => setDataChannelListeners(event.channel, room, remotePeerId)
    connection.ontrack = track => onTrack.next(track)
    connection.oniceconnectionstatechange = event => console.log('ice state changed', event)
    connections.push({ room, remotePeerId, connection })
    return { room, remotePeerId, connection }
  }

  function sendMessage(room: string, data: { [key: string]: any }) {
    connections.filter(c => c.room === room).forEach(({ channel }) => channel?.send(JSON.stringify(data)))
  }

  function addTrack(room: string, track: MediaStreamTrack, ...streams: MediaStream[]) {
    connections.filter(c => c.room === room).forEach(({ connection }, i) => {
      console.log('add track', track)
      connections[i].sender = connection.addTrack(track, ...streams)
    })
  }

  function removeTrack(room: string) {
    connections.filter(c => c.room === room).forEach(({ connection, sender }, i) => {
      if (sender) {
        connection.removeTrack(sender)
        connections[i].sender = undefined
      }
    })
  }

  return {
    onMessage,
    onTrack,
    onChannelOpen,
    onChannelClose,
    setIdentifier: (id: string) => identifier = id,
    broadcast,
    call,
    joinRoom,
    leaveRoom,
    sendMessage,
    addTrack,
    removeTrack
  }
}

function dateReviver(name: string, value: string) {
  if (typeof value === "string" && /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.test(value)) {
    return new Date(value)
  }
  return value
}

export type WebRTCClient = ReturnType<typeof createWebRTCClient>

const WebRTCClientContext = React.createContext<WebRTCClient>(undefined as unknown as WebRTCClient)

export function WebRTCClientProvider({ children, client }: React.PropsWithChildren<{ client: WebRTCClient }>) {
  return <WebRTCClientContext.Provider value={client}>{children}</WebRTCClientContext.Provider>
}

export function useWebRTC() {
  const webRTCClient = useContext(WebRTCClientContext)
  return webRTCClient
}
