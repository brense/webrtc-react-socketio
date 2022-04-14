import React, { useContext } from 'react'
import { Subject } from 'rxjs'
import { CandidatePayload, createIoSignalingChanel, RoomPayload, SessionDescriptionPayload } from './signalingChannel'

const onMessage = new Subject<{ [key: string]: string | number }>()
const onTrack = new Subject<RTCTrackEvent>()
const onChannelOpen = new Subject<string>()
const onChannelClose = new Subject<string>()

export function createWebRTCClient(signalingChannel: ReturnType<typeof createIoSignalingChanel>, configuration?: RTCConfiguration) {
  const connections: Array<{ room: string, remotePeerId: string, connection: RTCPeerConnection, channel?: RTCDataChannel }> = []

  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onJoin.subscribe(sendOffer)
  signalingChannel.onLeave.subscribe(closeConnection)

  async function sendOffer({ from: remotePeerId, room }: RoomPayload) {
    const { connection, channel } = getPeerConnection(room, remotePeerId, async () => {
      await connection.setLocalDescription(await connection.createOffer())
      console.log('send offer', remotePeerId, room, connection)
      signalingChannel.sendSessionDescription({
        sdp: connection.localDescription,
        room,
        to: remotePeerId
      })
    })
    if (!channel) {
      console.log('create datachannel for room', room)
      setDataChannelListeners(connection.createDataChannel(room), room, remotePeerId)
    }
  }

  async function joinRoom(room: string, isExistingBroadcast?: boolean) {
    signalingChannel.join({ room })
  }

  async function leaveRoom(room: string, remotePeerId: string) {
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
      channel.onmessage = message => onMessage.next(JSON.parse(message.data))
      channel.onopen = () => onChannelOpen.next(room)
      channel.onclose = () => {
        console.log('channel closed', room, remotePeerId)
        const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
        if (index >= 0) {
          connections[index].connection.close()
          connections.splice(index, 1)
        }
        onChannelClose.next(room)
      }
      const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
      connections[index] = { ...connections[index], channel }
      console.log('received data channel', room, remotePeerId, channel)
    }
  }

  function getPeerConnection(room: string, remotePeerId: string, onNegotiationNeededCallback?: (event: Event) => void) {
    const onNegotiationNeeded = getOnNegotationNeededSubjectForConnection(room, remotePeerId)
    onNegotiationNeededCallback && onNegotiationNeeded.subscribe(onNegotiationNeededCallback)
    const existingConnection = connections.find(c => c.room === room && c.remotePeerId === remotePeerId)
    if (existingConnection) {
      return existingConnection
    }
    console.log(`create new connection for room "${room}"`)
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = event => onIceCandidate(event, room)
    connection.onnegotiationneeded = event => onNegotiationNeeded.next(event)
    connection.ondatachannel = event => setDataChannelListeners(event.channel, room, remotePeerId)
    connection.ontrack = track => onTrack.next(track)
    connection.oniceconnectionstatechange = event => console.log('ice state changed', event)
    connections.push({ room, remotePeerId, connection })
    return { room, remotePeerId, connection }
  }

  function sendMessage(room: string, data: { [key: string]: string | number }) {
    connections.filter(c => c.room === room).forEach(({ channel }) => channel?.send(JSON.stringify(data)))
  }

  return {
    onMessage,
    onTrack,
    onChannelOpen,
    onChannelClose,
    joinRoom,
    leaveRoom,
    sendMessage
  }
}

const connectionOnNegotioationNeededSubjects: { [key: string]: Subject<Event> } = {}
function getOnNegotationNeededSubjectForConnection(room: string, remotePeerId: string) {
  if (!connectionOnNegotioationNeededSubjects[`${room}|${remotePeerId}`]) {
    connectionOnNegotioationNeededSubjects[`${room}|${remotePeerId}`] = new Subject()
  }
  return connectionOnNegotioationNeededSubjects[`${room}|${remotePeerId}`]
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
