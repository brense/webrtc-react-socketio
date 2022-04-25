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
  console.log(`peer ${socket.id} connected`)
  // TODO: use handshake query to reassign a socket.id to an existing broadcast room? https://socket.io/docs/v4/client-options/#query
  socket.broadcast.emit('peer', { from: socket.id })

  // handle calls from peers (create room)
  socket.on('call', (payload?: { to?: string, isBroadcast?: boolean, [key: string]: any }) => {
    const room = randomBytes(20).toString('hex')
    console.log(`peer ${socket.id} joined room ${room}`)
    socket.join(room)
    if (payload?.isBroadcast) {
      broadcasts[room] = socket.id // TODO: need to keep track of this when the socket disconnects and comes back this needs to change...
    }
    if (payload?.to) {
      websocket.to(payload.to).emit('call', { ...payload, room, from: socket.id })
    }
    socket.emit('call', { ...payload, room, from: socket.id }) // TODO: emit jwt secret to reassign broadcast owner if the server disconnects
  })

  // peer joining a room
  socket.on('join', payload => {
    socket.join(payload.room)
    const broadcaster = broadcasts[payload.room]
    console.log(`peer ${socket.id} joined ${broadcaster ? 'broadcast' : 'call'} ${payload.room}`)
    if (broadcaster && socket.id !== broadcaster) {
      websocket.to(broadcaster).emit('join', { ...payload, from: socket.id })
    } else if (!broadcaster || broadcaster === socket.id) {
      // TODO: double check that join event is received by peers when a broadcaster returns to a previous broadcast
      socket.broadcast.to(payload.room).emit('join', { ...payload, from: socket.id })
    }
  })

  // peer leaving a room
  socket.on('leave', payload => {
    socket.leave(payload.room)
    socket.broadcast.to(payload.room).emit('leave', { ...payload, from: socket.id })
    const match = findAbandonedBroadcasts(socket.id)
    if (match) {
      delete broadcasts[match]
    }
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
      const match = findAbandonedBroadcasts(socket.id)
      if (match) {
        delete broadcasts[match]
      }
    })
  })

  // handle socket disconnected
  socket.on('disconnect', () => {
    socket.broadcast.emit('leave', { from: socket.id })
    console.log(`peer ${socket.id} disconnected`)
  })
})

function findAbandonedBroadcasts(broadcaster: string) {
  return Object.keys(broadcasts).find(r => broadcasts[r] === broadcaster)
}

// start the server
httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
