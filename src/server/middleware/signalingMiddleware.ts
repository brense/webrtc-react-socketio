import { Server, Socket } from 'socket.io'
import { Room } from './peerDiscoveryMiddleware'

type Options = {
  peers: Array<{ socketId: string, peerId: string }>,
  rooms?: Room[]
}

function applySignalingMiddleware(websocket: Server, { peers, rooms = [] }: Options) {
  websocket.use((socket, next) => {
    socket.on('desc', handleSignalingEvent(socket, 'desc')) // relay RTCPeerDescriptions (offer/answer)
    socket.on('candidate', handleSignalingEvent(socket, 'candidate')) // relay RTCPeerCandidates
    next()
  })

  function handleSignalingEvent(socket: Socket, type: 'desc' | 'candidate') {
    const localPeerId = peers.find(p => p.socketId === socket.id)?.peerId || socket.id
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const roomMatch = rooms.find(r => r.id === room)
      const isBroadcastRoom = roomMatch && roomMatch.broadcaster && localPeerId !== roomMatch.broadcaster
      const remoteSocketId = isBroadcastRoom ? peers.find(p => p.peerId === roomMatch.broadcaster)?.socketId : peers.find(p => p.peerId === to)?.socketId
      remoteSocketId && websocket.to(remoteSocketId).emit(type, { ...payload, room, from: localPeerId })
    }
  }
}

export default applySignalingMiddleware
