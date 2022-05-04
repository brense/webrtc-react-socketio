import { Socket } from 'socket.io'
import { broadcasts } from './config'
import { websocket } from '.'

function handleCandidate(socket: Socket) {
  return (payload: { room: string, to: string }) => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('candidate', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id })
    }
  }
}

export default handleCandidate
