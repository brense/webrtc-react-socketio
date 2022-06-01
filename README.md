# 3-in-1 WebRTC React Socket.io

This project aims to provide an all in one package to use [WebRTC features](https://webrtc.org/getting-started/overview) in React including signaling server middleware for a NodeJS/[Express](https://expressjs.com/) server.

### Table of Contents
- [Getting started](#getting-started)
  - [Installation](#installation)
  - [Client implementation (React)](#client-implementation-react)
    - [Step 1: Create a signaling channel](#step-1-create-a-signaling-channel)
    - [Step 2: Handle room creation](#step-2-handle-room-creation)
    - [Step 3: Create a room component](#step-3-create-a-room-component)
    - [Room example with data channels](#room-example-with-data-channels)
  - [Signaling server implementation (NodeJS)](#signaling-server-implementation-nodejs)
- [Reference](#reference)

## Getting started

### Installation
`npm i webrtc-react-socketio`

### Client implementation (React)

#### Step 1: Create a signaling channel
Import our package
```jsx
import createIoSignalingChannel, { SignalingChannelProvider } from 'webrtc-react-socketio/signaling'
```

Initialize the signaling channel
```jsx
const socketUrl = 'wss://your.domain.com'
const signalingChannel = createIoSignalingChannel(socketUrl, {
  autoConnect: true
})
```

Provide the signalling channel to your app
```jsx
root.render(<StrictMode>
  <SignalingChannelProvider signalingChannel={signalingChannel}>
    <App />
  </SignalingChannelProvider>
</StrictMode>)
```

#### Step 2: Handle room creation
Now we can use the signaling channel in our React components
```jsx
export default function App() {
  // use signaling channel
  const { isConnected, join, broadcast } = useSignalingChannel()
  const [room, setRoom] = useState<string>()
 
  // change the room when we get a room id from the server
  const onResponseCallback: OnResponseCallback = useCallback((response) => {
    setRoom(response.room.id)
  }, [])
 
  // create room callback
  const createRoom = useCallback((isBroadcast = true) => {
    const payload = { onResponseCallback }
    isBroadcast ? broadcast(payload) : join(payload)
  }, [broadcast, join, onResponseCallback])
 
  // show create broadcast button or render our Room
  return !isConnected ? (
    <span>loading...</span>
  ) : !room ? (
    <button onClick={() => createRoom()}>Create Broadcast</button>
  ) : (
    <AudioRoom room={room} />
  )
}
```

#### Step 3: Create a room component
Add some state and refs to facilitate audio tracks
```jsx
const [isRecording, setIsRecording] = useState(false)
const audioRef = useRef<HTMLAudioElement>(null)
const streamRef = useRef<MediaStream>()
```

Initialize peer connection and listen for audio tracks
```jsx
const { addTrack, removeTrack } = usePeerConnection(room, {
  onTrack: (track) => {
    if (audioRef.current) {
      audioRef.current.srcObject = track.streams[0]
    }
    track.streams[0].onremovetrack = () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null
      }
    }
  }
})
```

Toggle broadcast callback
```jsx
const toggleBroadcast = useCallback(async () => {
  if (!streamRef.current) {
    // get stream from user media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
    // add stream tracks to all peer connections in the room
    stream.getTracks().forEach((track) => addTrack(track, stream))
    streamRef.current = stream
    setIsRecording(true)
  } else {
    // stop all tracks in the stream
    streamRef.current.getTracks().forEach((track) => track.stop())
    streamRef.current = undefined
    // remove track from all peer connections in the room
    removeTrack()
    setIsRecording(false)
  }
}, [addTrack, removeTrack])
```

Render audio element and recording toggle button
```jsx
return (<div>
  <audio ref={audioRef} autoPlay />
  <button onClick={() => toggleBroadcast()}>
    {isRecording ? 'Stop' : 'Start'} recording
  </button>
</div>)
```

#### Room example with data channels
```jsx
	
import { useCallback, useEffect } from 'react'
import { usePeerConnection } from 'webrtc-react-socketio'
import { useSignalingChannel } from 'webrtc-react-socketio/signaling'
 
export default function TextRoom({ room }: { room: string }) {
  const { socket } = useSignalingChannel()
  const { createDataChannel, sendMessage } = usePeerConnection(room, {
    onNewPeerConnection: (conn, identifier) => createDataChannel(identifier)
    onMessage: (data) => console.log('new message', data) // do something with message data
  })
 
  // send a message
  return <button onClick={() => sendMessage({ message: 'randomstring' })}>Send</button>
}
```

### Signaling server implementation (NodeJS)
```ts
import yargs from 'yargs'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import { applySignalingMiddleware, applyPeerDiscoveryMiddleware, Room } from './server'

dotenv.config()

const {
  PORT = '3001',
  JWT_SECRET = 'NOT_VERY_SECRET',
  CORS_ORIGIN = 'http://localhost:3000'
} = process.env

const rooms: Room[] = []
const peers: Array<{ socketId: string, peerId: string }> = [];

(async () => {
  // parse process args
  const { port, jwtSecret } = await yargs.options({
    port: { alias: 'p', type: 'number', default: Number(PORT) },
    jwtSecret: { type: 'string', default: JWT_SECRET }
  }).argv

  // init websocket server
  const app = express()
  const httpServer = http.createServer(app)
  const websocket = new WebSocketServer(httpServer, { cors: { origin: CORS_ORIGIN } })

  applyPeerDiscoveryMiddleware(websocket, { peers, rooms, jwtSecret })

  applySignalingMiddleware(websocket, { peers, rooms })

  httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
})()
```

## Reference
Still to come.
