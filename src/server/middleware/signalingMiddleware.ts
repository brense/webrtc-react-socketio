import { Server, Socket } from 'socket.io'

type Options = {
  rooms?: Array<{ name?: string, id: string, broadcaster?: string }>
}

function applySignalingMiddleware(websocket: Server, options?: Options) {
  const { rooms = [] } = options || { rooms: [] }
  websocket.use((socket, next) => {
    socket.on('desc', handleDescription(socket)) // relay RTCPeerDescriptions (offer/answer)
    socket.on('candidate', handleCandidate(socket)) // relay RTCPeerCandidates
    next()
  })

  function handleDescription(socket: Socket) {
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const match = rooms.find(r => r.id === room)
      if (match && match.broadcaster && socket.id !== match.broadcaster) {
        websocket.to(match.broadcaster).emit('desc', { ...payload, room, from: socket.id })
      } else {
        socket.broadcast.to(to).emit('desc', { ...payload, room, from: socket.id })
      }
    }
  }

  function handleCandidate(socket: Socket) {
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const match = rooms.find(r => r.id === room)
      if (match && match.broadcaster && socket.id !== match.broadcaster) {
        websocket.to(match.broadcaster).emit('candidate', { ...payload, room, from: socket.id })
      } else {
        socket.broadcast.to(to).emit('candidate', { ...payload, room, from: socket.id })
      }
    }
  }
}

export default applySignalingMiddleware
