#!/usr/bin/env node

import yargs from 'yargs'
import express from 'express'
import http from 'http'
import { Server as WebSocketServer, Socket } from 'socket.io'

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

// socket listeners (https://socket.io/docs/v3/emit-cheatsheet/)
websocket.on('connection', socket => {
  console.log(`client ${socket.id} connected`)
  socket.broadcast.emit('client', { from: socket.id })

  socket.on('join', payload => {
    socket.join(payload.room)
    console.log('join room', payload.room, socket.id)
    socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
  })
  socket.on('leave', payload => {
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
  })
  socket.on('desc', payload => socket.broadcast.to(payload.to).emit('desc', { ...payload, from: socket.id }))
  socket.on('candidate', payload => socket.broadcast.to(payload.to).emit('candidate', { ...payload, from: socket.id }))

  socket.on('disconnecting', () => {
    socket.rooms.forEach(room => socket.broadcast.to(room).emit('leave', { from: socket.id, room }))
  })

  socket.on('disconnect', () => {
    socket.broadcast.emit('leave', { from: socket.id })
    console.log(`client ${socket.id} disconnected`)
  })
})

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
