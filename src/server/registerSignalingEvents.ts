import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import broadcasts from './broadcasts'

function registerSignalingEvents(io: Server) {
  return (socket: Socket, next: () => void) => {

    // rejoin room and re-assign broadcast owner socket id
    const { recoveryToken } = socket.handshake.query
    if (recoveryToken) {
      jwt.verify(recoveryToken as string || '', 'secret', attemptRejoinRoom)
    }

    // emit connected peer event and send broadcasts and configuration
    socket.broadcast.emit('peer', { from: socket.id })
    socket.emit('broadcasts', broadcasts)

    // handle signaling events
    socket.on('desc', handleDescription)
    socket.on('candidate', handleCandidate)

    next()

    function handleDescription(payload: { room: string, to: string }) {
      const broadcaster = broadcasts[payload.room]
      if (broadcaster && socket.id !== broadcaster) {
        io.to(broadcaster).emit('desc', { ...payload, from: socket.id })
      } else {
        socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id })
      }
    }

    function handleCandidate(payload: { room: string, to: string }) {
      const broadcaster = broadcasts[payload.room]
      if (broadcaster && socket.id !== broadcaster) {
        io.to(broadcaster).emit('candidate', { ...payload, from: socket.id })
      } else {
        socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id })
      }
    }

    function attemptRejoinRoom(error: jwt.VerifyErrors | null, decoded?: string | jwt.JwtPayload) {
      if (!error && decoded) {
        const { room, peerId } = decoded as { room: string, peerId?: string }
        if (peerId && (!broadcasts[room] || broadcasts[room] === peerId)) {
          broadcasts[room] = socket.id
        }
        socket.join(room)
      }
    }
  }
}

export default registerSignalingEvents
