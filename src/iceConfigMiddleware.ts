import { Server } from 'socket.io'

const iceServers = [
  //{ urls: 'stun:stun.hosteurope.de:3478' },
  //{ urls: 'stun:stun.avigora.fr:3478' },
  //{ urls: 'stun:stun.liveo.fr:3478' },
  //{ urls: 'stun:stun.nottingham.ac.uk:3478' },
  //{ urls: 'stun:stun.cope.es:3478' },
  //{ urls: 'stun:stun.acrobits.cz:3478' },
  //{ urls: 'stun:stun.altar.com.pl:3478' },
  //{ urls: 'stun:rfh-auction-coturn.staging.rfh-auction.com:3478' },
  //{ urls: 'turn:rfh-auction-coturn.staging.rfh-auction.com:3478', username: 'coturn', credential: 'coturn' },
  //{ urls: 'turn:rfh-auction-coturn.staging.rfh-auction.com:3478?transport=tcp', username: 'coturn', credential: 'coturn' },
  { urls: ['stun:stun.l.google.com:19302'] },
  //{ urls: 'stun:stun.faktortel.com.au:3478' },
  //{ urls: 'stun:stun.freecall.com:3478' },
  //{ urls: 'stun:stun.anyfirewall.com:3478' },
  //{ urls: 'stun:openrelay.metered.ca:80', },
  //{ urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject', },
  //{ urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject', },
  //{ urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject', },
  //{ urls: 'turn:turn.anyfirewall.com:443', credential: 'webrtc', username: 'webrtc' },
  //{ urls: 'turn:turn.anyfirewall.com:443?transport=tcp', credential: 'webrtc', username: 'webrtc' },
]

console.info('configured ice servers:', iceServers)

function applyIceConfigMiddleware(websocket: Server) {
  websocket.use(async (socket, next) => {
    socket.emit('config', iceServers)
    next()
  })
}

export default applyIceConfigMiddleware
