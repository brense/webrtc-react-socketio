import { Socket } from 'socket.io'
import removeAbandonedBroadcasts from './removeAbandonedBroadcasts'

function handleLeave(socket: Socket) {
  return (payload: { room: string }) => {
    removeAbandonedBroadcasts(socket)
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
  }
}

export default handleLeave
