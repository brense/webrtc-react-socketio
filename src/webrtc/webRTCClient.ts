import { Subject } from 'rxjs'
import { CandidatePayload, RoomPayload, SessionDescriptionPayload, SignalingChanel } from '../signaling'
import { ChannelEventPayload, MessageEventPayload, TrackEventPayload } from './types'
import jsonDateReviver from './jsonDateReviver'

export const subjects = {
  onMessage: new Subject<MessageEventPayload>(),
  onTrack: new Subject<TrackEventPayload>(),
  onChannelOpen: new Subject<ChannelEventPayload>(),
  onChannelClose: new Subject<ChannelEventPayload>()
}

function createWebRTCClient({ signalingChannel, ...configuration }: RTCConfiguration & { signalingChannel: SignalingChanel }) {
  const connections: Array<{ room: string, remotePeerId: string, connection: RTCPeerConnection, channel?: RTCDataChannel, sender?: RTCRtpSender }> = []

  signalingChannel.onConfig.subscribe(iceServers => configuration.iceServers = iceServers)
  signalingChannel.onSessionDescription.subscribe(receiveSessionDescription)
  signalingChannel.onCandidate.subscribe(receiveCandidate)
  signalingChannel.onLeave.subscribe(closeConnection)

  async function initDataChannel({ from: remotePeerId, room }: RoomPayload) {
    const { connection, channel } = getPeerConnection(room, remotePeerId)
    if (!channel) {
      console.log('create datachannel for room', room)
      setDataChannelListeners(connection.createDataChannel(room), room, remotePeerId)
    }
  }

  function getConnectionsForRoom(room: string) {
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
      channel.onmessage = message => subjects.onMessage.next({ ...JSON.parse(message.data, jsonDateReviver), room, remotePeerId })
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
    initDataChannel,
    sendMessage,
    addTrack,
    removeTrack,
    getConnectionsForRoom
  }
}

export default createWebRTCClient
