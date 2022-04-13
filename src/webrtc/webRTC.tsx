import React, { useContext } from 'react'
import { Subject } from 'rxjs'
import { CandidatePayload, createIoSignalingChanel, RoomPayload, SessionDescriptionPayload } from './signalingChannel'

const onMessage = new Subject<MessageEvent>()
const onTrack = new Subject<RTCTrackEvent>()
const onChannelOpen = new Subject<string>()
const onChannelClose = new Subject<string>()

export function createWebRTCClient(signalingChannel: ReturnType<typeof createIoSignalingChanel>, configuration?: RTCConfiguration) {
  const rooms: Array<{ name: string, connection: RTCPeerConnection, channel?: RTCDataChannel }> = []

  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onJoin.subscribe(sendOffer)
  signalingChannel.onLeave.subscribe(closeRemoteChannel)

  async function sendOffer({ from: remotePeerId, room }: RoomPayload) {
    const { connection, channel } = getPeerConnectionForRoom(room, async () => {
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
      setDataChannelListeners(connection.createDataChannel(room), room)
    }
  }

  async function createBroadcast(room: string) {
    getPeerConnectionForRoom(room)
    signalingChannel.join({ room })
  }

  async function joinRoom(room: string, isExistingBroadcast?: boolean) {
    createRoom(room, isExistingBroadcast)
    signalingChannel.join({ room })
  }

  async function leaveRoom(room: string) {
    const index = rooms.findIndex(({ name }) => name === room)
    if (index >= 0) {
      rooms[index].connection.close()
      rooms.splice(index, 1)
    }
    signalingChannel.leave({ room })
  }

  async function createRoom(room: string, isExistingBroadcast = false) {
    const { connection } = getPeerConnectionForRoom(room)
    if (!isExistingBroadcast) {
      const channel = connection.createDataChannel(room)
      await connection.setLocalDescription(await connection.createOffer())
      setDataChannelListeners(channel, room)
    }
    return connection
  }

  async function closeRemoteChannel({ from: remotePeerId, room }: Omit<RoomPayload, | 'room'> & { room?: string }) {
    // TODO: close connection in case of a 1 to 1 call?
  }

  async function receiveSessionDescription({ room, sdp, from: remotePeerId }: SessionDescriptionPayload) {
    const { connection } = getPeerConnectionForRoom(room)
    if (sdp?.type === 'offer') {
      console.log('received offer', sdp)
      try {
        await connection.setRemoteDescription(sdp)
      } catch (e) {
        console.log('error', e)
      }
      console.log('respond to offer', room, connection)
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
      console.log('received answer', sdp)
      try {
        await connection.setRemoteDescription(sdp)
      } catch (e) {
        console.log('error', e)
      }
    } else {
      console.log('received unsupported session description type', sdp, connection)
    }
  }

  async function receiveCandidate({ room, candidate }: CandidatePayload) {
    console.log('received candidate', room, candidate)
    const { connection } = getPeerConnectionForRoom(room)
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

  function setDataChannelListeners(channel: RTCDataChannel, room: string) {
    if (channel.readyState !== 'closed') {
      channel.onmessage = message => onMessage.next(message)
      channel.onopen = () => onChannelOpen.next(room)
      channel.onclose = () => {
        console.log('channel closed', room)
        const index = rooms.findIndex(({ name }) => name === room)
        if (index >= 0) {
          rooms[index].connection.close()
          rooms.splice(index, 1)
        }
        onChannelClose.next(room)
      }
      const index = rooms.findIndex(({ name }) => name === room)
      rooms[index] = { ...rooms[index], channel }
      console.log('received data channel', room, channel)
    }
  }

  function getPeerConnectionForRoom(name: string, onNegotiationNeededCallback?: (event: Event) => void) {
    const onNegotiationNeeded = subjectNegotiationNeededForRoom(name)
    onNegotiationNeededCallback && onNegotiationNeeded.subscribe(onNegotiationNeededCallback)
    const existingRoom = rooms.find(room => room.name === name)
    if (existingRoom) {
      return existingRoom
    }
    console.log(`create new connection for room "${name}"`)
    const connection = new RTCPeerConnection(configuration)
    connection.onicecandidate = event => onIceCandidate(event, name)
    connection.onnegotiationneeded = event => onNegotiationNeeded.next(event)
    connection.ondatachannel = event => setDataChannelListeners(event.channel, name)
    connection.ontrack = track => onTrack.next(track)
    connection.oniceconnectionstatechange = event => console.log('ice state changed', event)
    rooms.push({ name, connection })
    return { name, connection }
  }

  return {
    onMessage,
    onTrack,
    onChannelOpen,
    onChannelClose,
    createBroadcast,
    joinRoom,
    leaveRoom
  }
}

const roomNegotiationNeededSubjects: { [key: string]: Subject<Event> } = {}
function subjectNegotiationNeededForRoom(room: string) {
  if (!roomNegotiationNeededSubjects[room]) {
    roomNegotiationNeededSubjects[room] = new Subject()
  }
  return roomNegotiationNeededSubjects[room]
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
