import { randomBytes } from 'crypto'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import broadcasts from './broadcasts'

function registerRoomEvents(io: Server) {
  return (socket: Socket, next: () => void) => {
    socket.on('call', handleCall) // handle calls from peers (create room)
    socket.on('join', handleJoin) // peer joining a room
    socket.on('leave', handleLeave) // peer leaving a room

    // handle socket disconnecting
    socket.on('disconnecting', () => {
      socket.rooms.forEach(room => {
        socket.broadcast.to(room).emit('leave', { from: socket.id, room })
        removeAbandonedBroadcasts(socket)
      })
    })

    // handle socket disconnected
    socket.on('disconnect', () => {
      socket.broadcast.emit('leave', { from: socket.id })
      console.info(`peer ${socket.id} disconnected`)
    })

    next()

    function handleCall(payload?: { to?: string, isBroadcast?: boolean, [key: string]: any }) {
      const room = randomBytes(20).toString('hex')
      console.info(`peer ${socket.id} joined room ${room}`)
      socket.join(room)
      if (payload?.isBroadcast) {
        broadcasts[room] = socket.id
        io.emit('broadcasts', broadcasts)
      }
      if (payload?.to) {
        io.to(payload.to).emit('call', { ...payload, room, from: socket.id })
      }
      const recoveryToken = jwt.sign({ room, peerId: payload?.isBroadcast ? socket.id : undefined }, 'secret')
      socket.emit('recovery', recoveryToken)
      socket.emit('call', { ...payload, room, from: socket.id })
    }

    function handleJoin(payload: { room: string }) {
      socket.join(payload.room)
      const recoveryToken = jwt.sign({ room: payload.room }, 'secret')
      socket.emit('recovery', recoveryToken)
      const broadcaster = broadcasts[payload.room]
      console.info(`peer ${socket.id} joined ${broadcaster ? 'broadcast' : 'call'} ${payload.room}`)
      if (broadcaster && socket.id !== broadcaster) {
        io.to(broadcaster).emit('join', { ...payload, from: socket.id })
      } else if (!broadcaster || broadcaster === socket.id) {
        socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
      }
    }

    function handleLeave(payload: { room: string }) {
      removeAbandonedBroadcasts(socket)
      socket.leave(payload.room)
      socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
    }

    function removeAbandonedBroadcasts(socket: Socket) {
      socket.rooms.forEach(roomName => {
        const room = io.sockets.adapter.rooms.get(roomName)
        if (room && room.size === 1 && broadcasts[roomName]) {
          console.info('removing broadcast room', roomName)
          delete broadcasts[roomName]
          io.emit('broadcasts', broadcasts)
        }
      })
    }
  }
}

export default registerRoomEvents
