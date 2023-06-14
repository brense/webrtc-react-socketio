import { Server, Socket } from 'socket.io'
import { ViteDevServer } from 'vite'
import { v4 as uuid } from 'uuid'

type Participant = {
  peerId: string,
  username: string
}

type Room = {
  roomId: string,
  roomName: string,
  participants: Participant[],
  isBroadcast: boolean,
  isHidden: boolean
}

type JoinRoomPayload = {
  roomId?: string,
  roomName?: string,
  username: string,
  isBroadcast?: boolean,
  isHidden?: boolean
}

const rooms: Room[] = []

export default function initSocketServer(httpServer: ViteDevServer['httpServer']) {
  const io = new Server(httpServer, { serveClient: false })
  io.on('connect', socket => console.log('new peer', socket.handshake.query))
  io.use(peerDiscoveryMiddleware)

  function peerDiscoveryMiddleware(socket: Socket, next: (err?: { name: string, message: string }) => void) {
    const { peerId } = socket.handshake.query as { peerId: string }
    socket.emit('rooms', rooms.filter(r => !r.isHidden))
    socket.on('join', onJoin)
    socket.on('leave', onLeave)
    socket.on('disconnect', () => onLeave.bind(socket)())
    socket.on('description', payload => forwardToPeer('description', peerId, payload))
    socket.on('candidate', payload => forwardToPeer('candidate', peerId, payload))
    next()
  }

  function forwardToPeer(eventType: 'description' | 'candidate', remotePeerId: string, { to, ...payload }: { to: string }) {
    io.to(to).emit(eventType, { remotePeerId, ...payload })
  }

  function onJoin(this: Socket, { roomId = createRoomHash(), username, ...payload }: JoinRoomPayload, ack?: (roomId: string) => void) {
    const { peerId } = this.handshake.query as { peerId: string }
    this.join(roomId)
    joinOrCreateRoom(roomId, peerId, { username, ...payload })
    ack && ack(roomId)
    this.to(roomId).emit('new peer', { peerId, username })
    io.emit('rooms', rooms.filter(r => !r.isHidden))
  }

  function onLeave(this: Socket, payload?: { roomId: string }) {
    const { peerId } = this.handshake.query as { peerId: string }
    payload?.roomId && this.leave(payload.roomId)
    removeParticipantFromRooms(peerId, payload?.roomId)
    io.emit('rooms', rooms.filter(r => !r.isHidden))
  }
}

function joinOrCreateRoom(roomId: string, peerId: string, { roomName, username, isBroadcast, isHidden }: Omit<JoinRoomPayload, 'roomId'>) {
  const roomIndex = rooms.findIndex(r => r.roomId === roomId)
  if (roomIndex === -1) {
    rooms.push({ roomId, roomName, participants: [{ peerId, username, ...isBroadcast ? { isBroadcaster: true } : {} }], isBroadcast, isHidden })
  } else if (rooms[roomIndex].participants.find(p => p.peerId === peerId)) {
    const participantIndex = rooms[roomIndex].participants.findIndex(p => p.peerId === peerId)
    rooms[roomIndex].participants[participantIndex] = { peerId, username }
  } else {
    rooms[roomIndex].participants.push({ peerId, username })
  }
}

function removeParticipantFromRooms(peerId: string, roomId?: string) {
  rooms.forEach((room, roomIndex) => {
    if ((!roomId || room.roomId === roomId) && room.participants.find(p => p.peerId === peerId)) {
      const participantIndex = rooms[roomIndex].participants.findIndex(p => p.peerId === peerId)
      if (participantIndex >= 0) {
        rooms[roomIndex].participants.splice(participantIndex, 1)
      }
    }
    if (rooms[roomIndex].participants.length === 0) {
      rooms.splice(roomIndex, 1)
    }
  })
}

function createRoomHash() {
  return Buffer.from(uuid(), 'utf8').toString('base64')
}
