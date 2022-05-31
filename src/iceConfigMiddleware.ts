import { Server } from 'socket.io'

const iceServers = [
  { urls: ['stun.gmx.de:3478', 'stun.gmx.net:3478'] },
  { urls: 'stun.hosteurope.de:3478' },
  { urls: 'stun.avigora.fr:3478' },
  { urls: 'stun.liveo.fr:3478' },
  { urls: 'stun.nottingham.ac.uk:3478' },
  { urls: 'stun.cope.es:3478' },
  { urls: 'stun.acrobits.cz:3478' },
  { urls: 'stun.altar.com.pl:3478' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun.faktortel.com.au:3478' },
  { urls: 'stun.freecall.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80', },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:turn01.hubl.in?transport=udp' },
  { urls: 'turn:turn02.hubl.in?transport=tcp' },
  { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', credential: 'webrtc', username: 'webrtc' }
]

console.info('configured ice servers:', iceServers)

function applyIceConfigMiddleware(websocket: Server) {
  websocket.use(async (socket, next) => {
    socket.emit('config', iceServers)
    next()
  })
}

export default applyIceConfigMiddleware
