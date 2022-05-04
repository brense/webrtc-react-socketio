import { Socket } from 'socket.io'
import { broadcasts } from './config'
import { websocket } from '.'

function handleDescription(socket: Socket) {
  return (payload: { room: string, to: string }) => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('desc', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id })
    }
  }
}

export default handleDescription
