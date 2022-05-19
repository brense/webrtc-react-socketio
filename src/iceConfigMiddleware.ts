import { Server } from 'socket.io'

const {
  ICE_ADDRESS = 'openrelay.metered.ca',
  ICE_PORT = '80',
  ICE_SSH_PORT = '443',
  ICE_USER = 'openrelayproject',
  ICE_CREDENTIAL = 'openrelayproject'
} = process.env

const iceServers = [
  { urls: `stun:${ICE_ADDRESS}:${ICE_PORT}` },
  { urls: `turn:${ICE_ADDRESS}:${ICE_PORT}`, username: ICE_USER, credential: ICE_CREDENTIAL },
  { urls: `turn:${ICE_ADDRESS}:${ICE_SSH_PORT}`, username: ICE_USER, credential: ICE_CREDENTIAL },
  { urls: `turn:${ICE_ADDRESS}:${ICE_SSH_PORT}?transport=tcp`, username: ICE_USER, credential: ICE_CREDENTIAL }
]

console.info('configured ice servers:', iceServers)

function applyIceConfigMiddleware(websocket: Server) {
  websocket.use(async (socket, next) => {
    socket.emit('config', iceServers)
    next()
  })
}

export default applyIceConfigMiddleware
