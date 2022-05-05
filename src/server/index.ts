import { Server } from 'socket.io'
import registerRoomEvents from './registerRoomEvents'
import registerSignalingEvents from './registerSignalingEvents'

export function applySignalingMiddleware(io: Server) {
  io.use(registerRoomEvents(io))
  io.use(registerSignalingEvents(io))
}
