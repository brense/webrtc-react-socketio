#!/usr/bin/env node

import yargs from 'yargs'
import express from 'express'
import http from 'http'
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

// socket listeners (https://socket.io/docs/v3/emit-cheatsheet/)
websocket.on('connection', socket => {
  console.log(`peer ${socket.id} connected`)
  socket.broadcast.emit('signal', { from: socket.id })

  socket.on('desc', payload => websocket.to(payload.to).emit('desc', payload))
  socket.on('candidate', payload => websocket.to(payload.to).emit('candidate', payload))

  socket.on('disconnect', () => {
    socket.broadcast.emit('disconnected', socket.id)
    console.log(`peer ${socket.id} disconnected`)
  })
})

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
