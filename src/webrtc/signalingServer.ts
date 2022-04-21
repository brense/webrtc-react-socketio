#!/usr/bin/env node

import yargs from 'yargs'
import express from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { Server as WebSocketServer } from 'socket.io'
import { randomBytes } from 'crypto'

// parse process args
const { port } = yargs.options({
  port: {
    alias: "p",
    type: "number",
    default: parseInt(process.env.PORT || '3001'),
  },
}).argv;

// prepare websocket server
const app = express()
const httpServer = http.createServer(app)
const websocket = new WebSocketServer(httpServer)

// serve static files
app.use('/static', express.static(path.resolve(__dirname, 'static')))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.get(/^(?!\/socket.io).*$/, (req, res) => {
  console.log('http request')
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

// socket listeners (https://socket.io/docs/v3/emit-cheatsheet/)
websocket.on('connection', socket => {
  console.log(`client ${socket.id} connected`)
  socket.broadcast.emit('client', { from: socket.id })

  // room create/join/leave events
  socket.on('call', (payload?: { to?: string, isBroadcast?: boolean } & any) => {
    const room = randomBytes(20).toString('hex')
    socket.join(room)
    if (payload?.isBroadcast) {
      broadcasts[room] = socket.id
    }
    payload?.to ? websocket.to(payload.to).emit('call', { ...payload, room, from: socket.id }) : socket.emit('call', { ...payload, room, from: 'self' })
  })
  socket.on('join', payload => {
    socket.join(payload.room)
    console.log(`client ${socket.id} joined room ${payload.room}`)
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      console.log(`${socket.id} joining broadcast '${payload.room}'`)
      websocket.to(broadcaster).emit('join', { ...payload, from: socket.id })
    } else if (!broadcaster) {
      socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
    }
  })
  socket.on('leave', payload => {
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
    const match = findAbandonedBroadcasts(socket.id)
    if (match) {
      delete broadcasts[match]
    }
  })

  // webrtc signaling events
  socket.on('desc', payload => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('desc', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id })
    }
  })
  socket.on('candidate', payload => {
    const broadcaster = broadcasts[payload.room]
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('candidate', { ...payload, from: socket.id })
    } else {
      socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id })
    }
  })

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
      socket.broadcast.to(room).emit('leave', { from: socket.id, room })
      const match = findAbandonedBroadcasts(socket.id)
      if (match) {
        delete broadcasts[match]
      }
    })
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('leave', { from: socket.id })
    console.log(`client ${socket.id} disconnected`)
  })
})

function findAbandonedBroadcasts(broadcaster: string) {
  return Object.keys(broadcasts).find(r => broadcasts[r] === broadcaster)
}

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
