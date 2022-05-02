#!/usr/bin/env node

import yargs from 'yargs'
import express from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { Server as WebSocketServer, Socket } from 'socket.io'
import { randomBytes } from 'crypto'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'

dotenv.config()

// parse process args
const { port } = yargs.options({
  port: {
    alias: "p",
    type: "number",
    default: parseInt(process.env.PORT || '3001'),
  },
}).argv;

// turn server config object for client
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

console.info('configured ice servers', iceServers)

// prepare websocket server
const app = express()
const httpServer = http.createServer(app)
const websocket = new WebSocketServer(httpServer)

// serve static files
app.use('/static', express.static(path.resolve(__dirname, 'static')))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get(/^(?!\/socket.io).*$/, (req, res) => {
  if (path.extname(req.path) !== '') {
    const resolvedPath = path.resolve(__dirname, `.${req.path}`)
    if (fs.existsSync(resolvedPath)) {
      res.sendFile(resolvedPath)
    } else {
      res.sendStatus(404)
    }
  } else {
    const index = path.resolve(__dirname, 'index.html')
    res.sendFile(index)
  }
})

const broadcasts: { [key: string]: string } = {}

// create websocket connection
websocket.on('connection', socket => {
  console.info(`peer ${socket.id} connected`)

  // re-assign broadcast owner socket id
  const { recoveryToken } = socket.handshake.query
  if (recoveryToken) {
    jwt.verify(recoveryToken as string || '', 'secret', attemptRejoinRoom(socket))
  }

  // emit connected peer event and send broadcasts and configuration
  socket.broadcast.emit('peer', { from: socket.id })
  socket.emit('broadcasts', broadcasts)
  socket.emit('config', iceServers)

  // handle calls from peers (create room)
  socket.on('call', (payload?: { to?: string, isBroadcast?: boolean, [key: string]: any }) => {
    const room = randomBytes(20).toString('hex')
    console.info(`peer ${socket.id} joined room ${room}`)
    socket.join(room)
    if (payload?.isBroadcast) {
      broadcasts[room] = socket.id
      websocket.emit('broadcasts', broadcasts)
    }
    if (payload?.to) {
      websocket.to(payload.to).emit('call', { ...payload, room, from: socket.id })
    }
    const recoveryToken = jwt.sign({ room, peerId: payload?.isBroadcast ? socket.id : undefined }, 'secret')
    socket.emit('recovery', recoveryToken)
    socket.emit('call', { ...payload, room, from: socket.id })
  })

  // peer joining a room
  socket.on('join', payload => {
    socket.join(payload.room)
    const recoveryToken = jwt.sign({ room: payload.room }, 'secret')
    socket.emit('recovery', recoveryToken)
    const broadcaster = broadcasts[payload.room]
    console.info(`peer ${socket.id} joined ${broadcaster ? 'broadcast' : 'call'} ${payload.room}`)
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('join', { ...payload, from: socket.id })
    } else if (!broadcaster || broadcaster === socket.id) {
      socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
    }
  })

  // peer leaving a room
  socket.on('leave', payload => {
    removeAbandonedBroadcasts(socket)
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
  })

  // signaling offer/answer event
  socket.on('desc', payload => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('desc', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id })
    }
  })

  // signaling candidate event
  socket.on('candidate', payload => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('candidate', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id })
    }
  })

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

function attemptRejoinRoom(socket: Socket) {
  return (error: jwt.VerifyErrors | null, decoded?: string | jwt.JwtPayload) => {
    if (!error && decoded) {
      const { room, peerId } = decoded as { room: string, peerId?: string }
      if (peerId && (!broadcasts[room] || broadcasts[room] === peerId)) {
        broadcasts[room] = socket.id
      }
      socket.join(room)
    }
  }
}

function removeAbandonedBroadcasts(socket: Socket) {
  socket.rooms.forEach(roomName => {
    const room = websocket.sockets.adapter.rooms.get(roomName)
    if (room && room.size === 1 && broadcasts[roomName]) {
      console.info('removing broadcast room', roomName)
      delete broadcasts[roomName]
      websocket.emit('broadcasts', broadcasts)
    }
  })
}

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
