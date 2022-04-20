#!/usr/bin/env node

import yargs from 'yargs'
import express from 'express'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { Server as WebSocketServer } from 'socket.io'

// parse process args
const { port } = yargs.options({
  'port': {
    alias: 'p',
    type: 'number',
    default: 3001
  }
}).argv

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

const rooms: Array<{ room: string, creator: string, isBroadcast: boolean }> = []

// socket listeners (https://socket.io/docs/v3/emit-cheatsheet/)
websocket.on('connection', socket => {
  console.log(`client ${socket.id} connected`)
  socket.broadcast.emit('client', { from: socket.id })
  socket.emit('rooms', rooms)

  // room join/leave events
  socket.on('join', payload => {
    const roomExists = !!websocket.sockets.adapter.rooms.get(payload.room)
    if (!roomExists) {
      rooms.push({ room: payload.room, creator: socket.id, isBroadcast: payload.isBroadcast || false })
    }
    socket.join(payload.room)
    console.log(`client ${socket.id} joined room ${payload.room}`)
    socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
  })
  socket.on('leave', payload => {
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
  })

  // webrtc signaling events
  socket.on('desc', payload => socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id }))
  socket.on('candidate', payload => socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id }))

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => {
      // detect abandoned rooms and remove them
      const r = websocket.sockets.adapter.rooms.get(room)
      const rIndex = rooms.findIndex(i => i.room === room)
      if (r?.size === 1 && r?.has(socket.id) && rIndex >= 0) {
        console.log(`room ${room} is removed because it is empty`)
        rooms.splice(rIndex, 1)
      }
      socket.broadcast.to(room).emit('leave', { from: socket.id, room })
    })
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('leave', { from: socket.id })
    console.log(`client ${socket.id} disconnected`)
  })
})

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
