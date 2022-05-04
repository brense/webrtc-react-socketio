import { Socket } from 'socket.io'
import { websocket } from '.'
import { broadcasts } from './config'

function removeAbandonedBroadcasts(socket: Socket) {
  socket.rooms.forEach(roomName => {
    const room = websocket.sockets.adapter.rooms.get(roomName)
    if (room && room.size === 1 && broadcasts[roomName]) {
      console.info('removing broadcast room', roomName)
      delete broadcasts[roomName]
      websocket.emit('broadcasts', broadcasts)
    }
  })
}

export default removeAbandonedBroadcasts
