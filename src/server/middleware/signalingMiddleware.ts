import { Server, Socket } from 'socket.io'

function applySignalingMiddleware(websocket: Server, broadcasts: { [key: string]: string }) {
  websocket.use((socket, next) => {
    socket.on('desc', handleDescription(socket)) // relay RTCPeerDescriptions (offer/answer)
    socket.on('candidate', handleCandidate(socket)) // relay RTCPeerCandidates
    next()
  })

  function handleDescription(socket: Socket) {
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const broadcaster = broadcasts[room]
      if (broadcaster && socket.id !== broadcaster) {
        websocket.to(broadcaster).emit('desc', { ...payload, room, from: socket.id })
      } else {
        socket.broadcast.to(to).emit('desc', { ...payload, room, from: socket.id })
      }
    }
  }

  function handleCandidate(socket: Socket) {
    return async ({ room, to, ...payload }: { room: string, to: string }) => {
      const broadcaster = broadcasts[room]
      if (broadcaster && socket.id !== broadcaster) {
        websocket.to(broadcaster).emit('candidate', { ...payload, room, from: socket.id })
      } else {
        socket.broadcast.to(to).emit('candidate', { ...payload, room, from: socket.id })
      }
    }
  }
}

export default applySignalingMiddleware
