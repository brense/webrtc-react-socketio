import { Server } from 'socket.io'

const iceServers = [
  { urls: ['stun:stun.gmx.de:3478', 'stun:stun.gmx.net:3478'] },
  { urls: 'stun:stun.hosteurope.de:3478' },
  { urls: 'stun:stun.avigora.fr:3478' },
  { urls: 'stun:stun.liveo.fr:3478' },
  { urls: 'stun:stun.nottingham.ac.uk:3478' },
  { urls: 'stun:stun.cope.es:3478' },
  { urls: 'stun:stun.acrobits.cz:3478' },
  { urls: 'stun:stun.altar.com.pl:3478' },
  { urls: 'stun:stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.faktortel.com.au:3478' },
  { urls: 'stun:stun.freecall.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80', },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject', },
  { urls: 'turn:turn.anyfirewall.com:443?transport=tcp', credential: 'webrtc', username: 'webrtc' },
  { urls: 'turn:192.158.29.39:3478?transport=udp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' }
]

console.info('configured ice servers:', iceServers)

function applyIceConfigMiddleware(websocket: Server) {
  websocket.use(async (socket, next) => {
    socket.emit('config', iceServers)
    next()
  })
}

export default applyIceConfigMiddleware
