import { Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { broadcasts } from './config'
import { websocket } from '.'

function handleJoin(socket: Socket) {
  return (payload: { room: string }) => {
    socket.join(payload.room)
    const recoveryToken = jwt.sign({ room: payload.room }, 'secret')
    socket.emit('recovery', recoveryToken)
    const broadcaster = broadcasts[payload.room]
    console.info(`peer ${socket.id} joined ${broadcaster ? 'broadcast' : 'call'} ${payload.room}`)
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('join', { ...payload, from: socket.id })
    } else if (!broadcaster || broadcaster === socket.id) {
      socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
    }
  }
}

export default handleJoin
