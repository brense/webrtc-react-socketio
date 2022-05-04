#!/usr/bin/env node

import jwt from 'jsonwebtoken'
import { iceServers, port, broadcasts } from './server/config'
import { websocket, httpServer, handleCall, handleJoin, handleLeave, removeAbandonedBroadcasts, handleDescription, handleCandidate, attemptRejoinRoom } from './server'

// create websocket connection
websocket.on('connection', socket => {
  console.info(`peer ${socket.id} connected`)

  // rejoin room and re-assign broadcast owner socket id
  const { recoveryToken } = socket.handshake.query
  if (recoveryToken) {
    jwt.verify(recoveryToken as string || '', 'secret', attemptRejoinRoom(socket))
  }

  // emit connected peer event and send broadcasts and configuration
  socket.broadcast.emit('peer', { from: socket.id })
  socket.emit('broadcasts', broadcasts)
  socket.emit('config', iceServers)

  // handle room events
  socket.on('call', handleCall(socket)) // handle calls from peers (create room)
  socket.on('join', handleJoin(socket)) // peer joining a room
  socket.on('leave', handleLeave(socket)) // peer leaving a room

  // handle signaling events
  socket.on('desc', handleDescription(socket))
  socket.on('candidate', handleCandidate(socket))

  // handle socket disconnecting
  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
      socket.broadcast.to(room).emit('leave', { from: socket.id, room })
      removeAbandonedBroadcasts(socket)
    })
  })

  // handle socket disconnected
  socket.on('disconnect', () => {
    socket.broadcast.emit('leave', { from: socket.id })
    console.info(`peer ${socket.id} disconnected`)
  })
})

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
