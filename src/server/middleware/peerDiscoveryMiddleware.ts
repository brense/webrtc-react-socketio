import { randomBytes } from 'crypto'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'

export type Room = {
  id: string,
  broadcaster?: string,
  hidden?: boolean,
  [key: string]: any
}

type Options = {
  peers: Array<{ socketId: string, peerId: string }>,
  rooms?: Room[],
  onRoomsChanged?: (rooms: Room[]) => void,
  jwtSecret: string
}

type JoinRoomCallback = (payload: { room: { id: string, name?: string, broadcaster?: string }, recoveryToken: string }) => void

function applyPeerDiscoveryMiddleware(websocket: Server, { peers, rooms = [], jwtSecret, onRoomsChanged }: Options) {
  websocket.use((socket, next) => {
    if (socket.handshake.query.peerId) {
      peers.push({ socketId: socket.id, peerId: socket.handshake.query.peerId as string })
    }
    attemptRecoverRoom(socket.handshake.query.recoveryToken as string || '', socket)
    socket.on('join', joinRoom(socket))
    socket.on('broadcast', assignBroadcaster(socket))
    socket.on('disconnecting', () => handleLeave(socket))
    socket.on('leave', ({ room }: { room: string }) => handleLeave(socket, room))
    next()
  })

  function joinRoom(socket: Socket) {
    const localPeerId = peers.find(p => p.socketId === socket.id)?.peerId || socket.id
    return async ({ id = randomBytes(20).toString('hex'), hidden = false, broadcaster, ...payload }: Room, callback?: JoinRoomCallback) => {
      console.info(`socket ${localPeerId} joining room ${id}`)
      socket.join(id)
      const matchIndex = rooms.findIndex(r => r.id === id)
      const room = rooms[matchIndex] || { id, hidden, ...payload }
      if (matchIndex >= 0 && room.broadcaster) {
        const broadcasterSocketId = peers.find(p => p.peerId === room.broadcaster)?.socketId || room.broadcaster
        websocket.to(broadcasterSocketId).emit('new member', { room: id, from: localPeerId, ...payload })
      } else {
        if (matchIndex < 0) {
          rooms.push(room)
          onRoomsChanged && onRoomsChanged(rooms.filter(r => !r.hidden))
        }
        socket.to(id).emit('new member', { room: id, from: localPeerId, ...payload })
      }
      const recoveryToken = jwt.sign(room, jwtSecret)
      callback && callback({ room, recoveryToken })
    }
  }

  function assignBroadcaster(socket: Socket) {
    const localPeerId = peers.find(p => p.socketId === socket.id)?.peerId || socket.id
    return async ({ id = randomBytes(20).toString('hex'), hidden = false, broadcaster, ...payload }: Room, callback?: JoinRoomCallback) => {
      console.info(`assign ${localPeerId} as broadcaster of ${id}`)
      socket.join(id)
      const matchIndex = rooms.findIndex(r => r.id === id)
      const room = matchIndex >= 0 ? rooms[matchIndex] : { id, broadcaster: localPeerId, hidden, ...payload }
      if (matchIndex >= 0) {
        rooms[matchIndex].broadcaster = localPeerId
      } else {
        rooms.push(room)
        onRoomsChanged && onRoomsChanged(rooms.filter(r => !r.hidden))
      }
      const roomMembers = await websocket.in(id).allSockets()
      roomMembers.forEach((roomMember) => {
        if (roomMember !== localPeerId) {
          socket.emit('new member', { room: id, from: roomMember, ...payload })
        }
      })
      const recoveryToken = jwt.sign(room, jwtSecret)
      callback && callback({ room, recoveryToken })
    }
  }

  function attemptRecoverRoom(recoveryToken: string, socket: Socket) {
    try {
      const { id, broadcaster, ...payload } = jwt.verify(recoveryToken as string || '', jwtSecret) as Room
      const match = rooms.find(r => r.id === id)
      if (broadcaster && match && match.broadcaster !== broadcaster) {
        throw new Error(`${match.broadcaster} took over the broadcast while you (${broadcaster}) were not connected`)
      }
      broadcaster ? assignBroadcaster(socket)({ id, ...payload }) : joinRoom(socket)({ id, ...payload })
    } catch (e) {
      // room cannot be recovered
      typeof recoveryToken !== 'undefined' && recoveryToken !== 'undefined' && console.info('could not recover from token:', recoveryToken, e)
    }
  }

  function handleLeave(socket: Socket, roomId?: string) {
    const peerIndex = peers.findIndex(p => p.socketId === socket.id)
    const remotePeerId = peers[peerIndex]?.peerId || socket.id
    peerIndex >= 0 && peers.splice(peerIndex, 1);
    (roomId ? [roomId] : socket.rooms).forEach(room => {
      const matchIndex = rooms.findIndex(r => r.id === room)
      const match = rooms[matchIndex]
      const broadcasterSocketId = peers.find(p => p.peerId === match?.broadcaster)?.socketId || match?.broadcaster
      match && broadcasterSocketId ? websocket.to(broadcasterSocketId).emit('leave', { from: remotePeerId, room }) : socket.to(room).emit('leave', { from: remotePeerId, room })
      const members = websocket.sockets.adapter.rooms.get(room)
      if (members && members.size <= 1 && matchIndex >= 0) {
        rooms.splice(matchIndex, 1)
        onRoomsChanged && onRoomsChanged(rooms.filter(r => !r.hidden))
      }
    })
    roomId && socket.leave(roomId)
  }
}

export default applyPeerDiscoveryMiddleware
