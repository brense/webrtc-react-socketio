import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Subject } from 'rxjs'
import { CandidatePayload, createIoSignalingChanel, RoomPayload, SessionDescriptionPayload, useSignalingChannel } from './signalingChannel'

type ChannelEventPayload = { remotePeerId: string, room: string }
type MessageEventPayload = { remotePeerId: string, room: string, [key: string]: string | number }
type TrackEventPayload = { remotePeerId: string, room: string, track: RTCTrackEvent }

const subjects = {
  onMessage: new Subject<MessageEventPayload>(),
  onTrack: new Subject<TrackEventPayload>(),
  onChannelOpen: new Subject<ChannelEventPayload>(),
  onChannelClose: new Subject<ChannelEventPayload>()
}

export function createWebRTCClient({ signalingChannel, ...configuration }: RTCConfiguration & { signalingChannel: ReturnType<typeof createIoSignalingChanel> }) {
  const connections: Array<{ room: string, remotePeerId: string, connection: RTCPeerConnection, channel?: RTCDataChannel, sender?: RTCRtpSender }> = []

  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onLeave.subscribe(closeConnection)

  // TODO: this name is misleading, it only sends an offer because of the onNegotiationNeeded listener in the getPeerConnection code
  // TODO: should be more like: initDataChannel or initMediaTrack, etc...
  async function sendOffer({ from: remotePeerId, room }: RoomPayload) {
    const { connection, channel } = getPeerConnection(room, remotePeerId)
    if (!channel) {
      console.log('create datachannel for room', room)
      setDataChannelListeners(connection.createDataChannel(room), room, remotePeerId)
    }
  }

  async function getConnectionsForRoom(room: string) {
    return connections.filter(c => c.room === room)
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
      channel.onmessage = message => subjects.onMessage.next({ ...JSON.parse(message.data, dateReviver), room, remotePeerId })
      channel.onopen = () => {
        subjects.onChannelOpen.next({ remotePeerId, room })
      }
      channel.onclose = () => {
        console.log('channel closed', room, remotePeerId)
        const index = connections.findIndex(c => c.room === room && c.remotePeerId === remotePeerId)
        if (index >= 0) {
          connections[index].connection.close()
          connections.splice(index, 1)
        }
        subjects.onChannelClose.next({ remotePeerId, room })
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
    console.log(`create new connection for ${remotePeerId} in room "${room}"`)
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
    connection.ontrack = track => subjects.onTrack.next({ remotePeerId, room, track })
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
        try {
          connection.removeTrack(sender)
          connections[i].sender = undefined
        } catch (e) {
          // error
        }
      }
    })
  }

  return {
    ...subjects,
    getPeerConnection,
    sendOffer,
    sendMessage,
    addTrack,
    removeTrack,
    getConnectionsForRoom
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

export function useCall() {
  const [room, setRoom] = useState<string>()
  const { makeCall, onCall, me, join, leave, onJoin } = useSignalingChannel()
  const { sendMessage, addTrack, removeTrack, sendOffer } = useWebRTC()

  useEffect(() => {
    const subscriber = onCall.subscribe(({ from: remotePeerId, room }) => {
      if (remotePeerId === me()) {
        setRoom(room)
      }
    })
    return () => subscriber.unsubscribe()
  }, [onCall, me])

  useEffect(() => {
    const subscriber = onJoin.subscribe(payload => payload.room === room && sendOffer(payload))
    return () => subscriber.unsubscribe()
  }, [onJoin, sendOffer, room])

  const handleMakeCall = useCallback((to: string | null, options?: { isBroadcast?: boolean, [key: string]: any }) => {
    const { isBroadcast = false, ...rest } = options || {}
    makeCall({ to: to || undefined, isBroadcast, ...rest })
  }, [makeCall])

  const handleAnswerCall = useCallback(({ room, ...options }: { room: string, [key: string]: any }) => {
    join({ room, ...options })
    setRoom(room)
  }, [join])

  const handleLeaveRoom = useCallback(() => room ? leave({ room }) : console.warn('You need to make a call before the room can be left'), [room, leave])
  const handleSendMessage = useCallback((message: { [key: string]: any }) => room ? sendMessage(room, message) : console.warn('You need to make a call before you can send a message'), [room, sendMessage])
  const handleAddTrack = useCallback((track: MediaStreamTrack, ...streams: MediaStream[]) => room ? addTrack(room, track, ...streams) : console.warn('You need to make a call before you can add a track'), [room, addTrack])
  const handleRemoveTrack = useCallback(() => room ? removeTrack(room) : console.warn('You need to make a call before you can remove track'), [room, removeTrack])

  return {
    makeCall: handleMakeCall,
    answerCall: handleAnswerCall,
    room: !room ? undefined : {
      name: room,
      leaveRoom: handleLeaveRoom,
      sendMessage: handleSendMessage,
      addTrack: handleAddTrack,
      removeTrack: handleRemoveTrack
    }
  }
}

export type Room = Exclude<ReturnType<typeof useCall>['room'], undefined>

export function useOnCall(eventListener: (payload: RoomPayload & { [key: string]: any }) => void) {
  const { onCall, me } = useSignalingChannel()
  useEffect(() => {
    const subscriber = onCall.subscribe(payload => payload.from !== me() && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [onCall, me, eventListener])
}

export function useOnNewPeer(room: string, eventListener: (payload: RoomPayload) => void) {
  const { onJoin } = useSignalingChannel()
  useEffect(() => {
    const subscriber = onJoin.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener, onJoin])
}

export function useOnChannelOpen(room: string, eventListener: (payload: ChannelEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onChannelOpen.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export function useOnChannelClose(room: string, eventListener: (payload: ChannelEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onChannelClose.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export function useOnMessage(room: string, eventListener: (payload: MessageEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onMessage.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export function useOnTrack(room: string, eventListener: (payload: TrackEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onTrack.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}
