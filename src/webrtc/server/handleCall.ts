import { Socket } from 'socket.io'
import { randomBytes } from 'crypto'
import jwt from 'jsonwebtoken'
import { broadcasts } from './config'
import { websocket } from '.'

function handleCall(socket: Socket) {
  return (payload?: { to?: string, isBroadcast?: boolean, [key: string]: any }) => {
    const room = randomBytes(20).toString('hex')
    console.info(`peer ${socket.id} joined room ${room}`)
    socket.join(room)
    if (payload?.isBroadcast) {
      broadcasts[room] = socket.id
      websocket.emit('broadcasts', broadcasts)
    }
    if (payload?.to) {
      websocket.to(payload.to).emit('call', { ...payload, room, from: socket.id })
    }
    const recoveryToken = jwt.sign({ room, peerId: payload?.isBroadcast ? socket.id : undefined }, 'secret')
    socket.emit('recovery', recoveryToken)
    socket.emit('call', { ...payload, room, from: socket.id })
  }
}

export default handleCall
