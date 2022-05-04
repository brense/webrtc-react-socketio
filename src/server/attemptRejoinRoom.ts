import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { broadcasts } from './config'

function attemptRejoinRoom(socket: Socket) {
  return (error: jwt.VerifyErrors | null, decoded?: string | jwt.JwtPayload) => {
    if (!error && decoded) {
      const { room, peerId } = decoded as { room: string, peerId?: string }
      if (peerId && (!broadcasts[room] || broadcasts[room] === peerId)) {
        broadcasts[room] = socket.id
      }
      socket.join(room)
    }
  }
}

export default attemptRejoinRoom
