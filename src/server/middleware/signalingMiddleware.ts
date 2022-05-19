import { Server, Socket } from 'socket.io'
import { Room } from './peerDiscoveryMiddleware'

type Options = {
  peers: Array<{ socketId: string, peerId: string }>,
  rooms?: Room[]
}

function applySignalingMiddleware(websocket: Server, { peers, rooms = [] }: Options) {
  websocket.use((socket, next) => {
    socket.on('desc', handleDescription(socket)) // relay RTCPeerDescriptions (offer/answer)
    socket.on('candidate', handleCandidate(socket)) // relay RTCPeerCandidates
    next()
  })

  function handleDescription(socket: Socket) {
    const localPeerId = peers.find(p => p.socketId === socket.id)?.peerId || socket.id
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const match = rooms.find(r => r.id === room)
      if (match && match.broadcaster && localPeerId !== match.broadcaster) {
        const remoteSocketId = peers.find(p => p.peerId === match.broadcaster)?.socketId || match.broadcaster
        websocket.to(remoteSocketId).emit('desc', { ...payload, room, from: localPeerId })
      } else {
        const remoteSocketId = peers.find(p => p.peerId === to)?.socketId || to
        websocket.to(remoteSocketId).emit('desc', { ...payload, room, from: localPeerId })
      }
    }
  }

  function handleCandidate(socket: Socket) {
    const localPeerId = peers.find(p => p.socketId === socket.id)?.peerId || socket.id
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const match = rooms.find(r => r.id === room)
      if (match && match.broadcaster && localPeerId !== match.broadcaster) {
        const remoteSocketId = peers.find(p => p.peerId === match.broadcaster)?.socketId || match.broadcaster
        websocket.to(remoteSocketId).emit('candidate', { ...payload, room, from: localPeerId })
      } else {
        const remoteSocketId = peers.find(p => p.peerId === to)?.socketId || to
        websocket.to(remoteSocketId).emit('candidate', { ...payload, room, from: localPeerId })
      }
    }
  }
}

export default applySignalingMiddleware
