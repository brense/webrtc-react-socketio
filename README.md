# WebRTC React hooks
WebRTC client, [socket.io](https://socket.io/) signaling channel and hooks for react + signaling server middleware

## Installation
```bash
npm install webrtc-react-socketio
```

## Usage
This package contains a WebRTC client, signalling channel and signaling server middleware.

### Signaling server
```typescript
import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import { applySignalingMiddleware } from 'webrtc-react-socketio/server'

const PORT = 3001

// init websocket server
const app = express()
export const httpServer = http.createServer(app)
export const websocket = new WebSocketServer(httpServer)

applySignalingMiddleware(websocket)

websocket.on('connection', socket => {
  console.info(`peer ${socket.id} connected`)
})

httpServer.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${PORT}`))
```

### WebRTC Client and signaling channel
```jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import { createWebRTCClient, WebRTCClientProvider } from 'webrtc-react-socketio'
import { createIoSignalingChannel, SignalingChannelProvider } from 'webrtc-react-socketio/signaling'
import App from './App'

const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
const socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`

const signalingChannel = createIoSignalingChannel(socketUrl, { autoConnect: true })
const webRTCClient = createWebRTCClient({ signalingChannel })

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<React.StrictMode>
  <SignalingChannelProvider signalingChannel={signalingChannel}>
    <WebRTCClientProvider client={webRTCClient}>
        <App />
    </WebRTCClientProvider>
  </SignalingChannelProvider>
</React.StrictMode>)
```

### WebRTC client React hooks
```jsx
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useCall, useOnCall } from './webrtc'

function App() {
  const [hasCall, setHasCall] = useState<{ room: string }>()
  const { makeCall, answerCall, room } = useCall()

  useOnCall(payload => setHasCall(payload))

  const handleCall = useCallback(({ remotePeerId }: { remotePeerId?: string }) => {
    if (room) {
      room.leaveRoom()
    }
    makeCall(remotePeerId || null)
  }, [makeCall, name, room])

  const handleAnswerCall = useCallback(() => {
    if (hasCall) {
      room.leaveRoom()
      answerCall({ room: hasCall.room })
      setHasCall(undefined)
    }
  }, [answerCall, hasCall, room])

  const handleEndCall = useCallback(() => {
    setHasCall(undefined)
    if (room) {
      room.leaveRoom()
    }
  }, [room])

  return <div>...</div>
}

export default App
```
