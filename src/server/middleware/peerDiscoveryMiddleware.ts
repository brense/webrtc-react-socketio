import { randomBytes } from 'crypto'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

type Room = { name?: string, id: string, broadcaster?: string }

type Options = {
  rooms?: Room[],
  onRoomsChanged?: (rooms: Room[]) => void,
  jwtSecret: string
}

function applyPeerDiscoveryMiddleware(websocket: Server, { rooms = [], jwtSecret, onRoomsChanged }: Options) {
  websocket.use((socket, next) => {
    attemptRecoverRoom(socket.handshake.query.recoveryToken as string || '', socket)
    socket.on('join', joinRoom(socket))
    socket.on('broadcast', assignBroadcaster(socket))
    socket.on('disconnecting', () => handleLeave(socket))
    socket.on('leave', ({ room }: { room: string }) => handleLeave(socket, room))
    next()
  })

  function joinRoom(socket: Socket) {
    return async ({ room = randomBytes(20).toString('hex'), name }: { room?: string, name?: string }, callback?: (payload: { room: string, recoveryToken: string }) => void) => {
      console.info(`socket ${socket.id} joining room ${room}`)
      socket.join(room)
      const match = rooms.find(r => r.id === room)
      if (match && match.broadcaster) {
        websocket.to(match.broadcaster).emit('new member', { room, from: socket.id })
      } else {
        if (!match) {
          rooms.push({ id: room, name })
          onRoomsChanged && onRoomsChanged(rooms)
        }
        socket.to(room).emit('new member', { room, from: socket.id })
      }
      const recoveryToken = jwt.sign({ room, name }, jwtSecret)
      callback && callback({ room, recoveryToken })
    }
  }

  function assignBroadcaster(socket: Socket) {
    return async ({ room = randomBytes(20).toString('hex'), name }: { room?: string, name?: string }, callback?: (payload: { room: string, recoveryToken: string }) => void) => {
      console.info(`assign ${socket.id} as broadcaster of ${room}`)
      socket.join(room)
      const matchIndex = rooms.findIndex(r => r.id === room)
      if (matchIndex >= 0) {
        rooms[matchIndex].broadcaster = socket.id
      } else {
        rooms.push({ id: room, broadcaster: socket.id, name })
        onRoomsChanged && onRoomsChanged(rooms)
      }
      const roomMembers = await websocket.in(room).allSockets()
      roomMembers.forEach((roomMember) => {
        if (roomMember !== socket.id) {
          socket.emit('new member', { room, from: roomMember })
        }
      })
      const recoveryToken = jwt.sign({ room, name, broadcaster: socket.id }, jwtSecret)
      callback && callback({ room, recoveryToken })
    }
  }

  function attemptRecoverRoom(recoveryToken: string, socket: Socket) {
    try {
      const { room, name, broadcaster } = jwt.verify(recoveryToken as string || '', jwtSecret) as { room: string, broadcaster?: string, name?: string }
      const match = rooms.find(r => r.id === room)
      if (broadcaster && match && match.broadcaster !== broadcaster) {
        throw new Error(`${match.broadcaster} took over the broadcast while you (${broadcaster}) were not connected`)
      }
      broadcaster ? assignBroadcaster(socket)({ room, name }) : joinRoom(socket)({ room, name })
    } catch (e) {
      // room cannot be recovered
      typeof recoveryToken !== 'undefined' && recoveryToken !== 'undefined' && console.info('could not recover from token:', recoveryToken, e)
    }
  }

  function handleLeave(socket: Socket, roomId?: string) {
    (roomId ? [roomId] : socket.rooms).forEach(room => {
      const matchIndex = rooms.findIndex(r => r.id === room)
      const match = rooms[matchIndex]
      match && match.broadcaster ? websocket.to(match.broadcaster).emit('leave', { from: socket.id, room }) : socket.to(room).emit('leave', { from: socket.id, room })
      const members = websocket.sockets.adapter.rooms.get(room)
      if (members && members.size <= 1 && matchIndex >= 0) {
        rooms.splice(matchIndex, 1)
        onRoomsChanged && onRoomsChanged(rooms)
      }
    })
    roomId && socket.leave(roomId)
  }
}

export default applyPeerDiscoveryMiddleware
