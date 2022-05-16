import { randomBytes } from 'crypto'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

const { JWT_SECRET = 'NOT_VERY_SECRET' } = process.env

function applyPeerDiscoveryMiddleware(websocket: Server, broadcasts: { [key: string]: string }) {
  websocket.use((socket, next) => {
    attemptRecoverRoom(socket.handshake.query.recoveryToken as string || '', socket)
    socket.on('join', joinRoom(socket))
    socket.on('broadcast', assignBroadcaster(socket))
    socket.onAny((eventName, { room }: { room?: string }) => {
      if (['disconnecting', 'disconnect', 'leave'].indexOf(eventName) >= 0) {
        (room ? [room] : socket.rooms).forEach(room => {
          broadcasts[room] && websocket.to(broadcasts[room]).emit('leave', { from: socket.id, room })
        })
      }
    })
    next()
  })

  function joinRoom(socket: Socket) {
    return async ({ room = randomBytes(20).toString('hex') }: { room?: string }, callback?: (payload: { room: string, recoveryToken: string }) => void) => {
      console.info(`socket ${socket.id} joining room ${room}`)
      socket.join(room)
      broadcasts[room] && websocket.to(broadcasts[room]).emit('new member', { room, from: socket.id })
      const recoveryToken = jwt.sign({ room }, JWT_SECRET)
      callback && callback({ room, recoveryToken })
    }
  }

  function assignBroadcaster(socket: Socket) {
    return async ({ room = randomBytes(20).toString('hex') }: { room: string }, callback?: (payload: { room: string, recoveryToken: string }) => void) => {
      console.info(`assign ${socket.id} as broadcaster of ${room}`)
      socket.join(room)
      broadcasts[room] = socket.id
      const roomMembers = await websocket.in(room).allSockets()
      roomMembers.forEach((roomMember) => {
        if (roomMember !== socket.id) {
          socket.emit('new member', { room, from: roomMember })
        }
      })
      const recoveryToken = jwt.sign({ room, broadcaster: socket.id }, JWT_SECRET)
      callback && callback({ room, recoveryToken })
    }
  }

  function attemptRecoverRoom(recoveryToken: string, socket: Socket) {
    try {
      const { room, broadcaster } = jwt.verify(recoveryToken as string || '', JWT_SECRET) as { room: string, broadcaster?: string }
      if (broadcaster && broadcasts[room] && broadcasts[room] !== broadcaster) {
        throw new Error(`${broadcasts[room]} took over the broadcast while you (${broadcaster}) were not connected`)
      }
      broadcaster ? assignBroadcaster(socket)({ room }) : joinRoom(socket)({ room })
    } catch (e) {
      // room cannot be recovered
      typeof recoveryToken !== 'undefined' && recoveryToken !== 'undefined' && console.info('could not recover from token:', recoveryToken, e)
    }
  }
}

export default applyPeerDiscoveryMiddleware
