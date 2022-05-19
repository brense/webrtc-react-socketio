#!/usr/bin/env node

import yargs from 'yargs'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import serveStatic from './serveStatic'
import { applySignalingMiddleware, applyPeerDiscoveryMiddleware, Room } from './server'
import applyIceConfigMiddleware from './iceConfigMiddleware'

dotenv.config()

const {
  PORT = '3001',
  JWT_SECRET = 'NOT_VERY_SECRET',
  CORS_ORIGIN = 'http://localhost:3000'
} = process.env

const rooms: Room[] = []
const peers: Array<{ socketId: string, peerId: string }> = []

// parse process args
const { port, jwtSecret } = yargs.options({
  port: { alias: 'p', type: 'number', default: Number(PORT) },
  jwtSecret: { type: 'string', default: JWT_SECRET }
}).argv

// init websocket server
const app = express()
const httpServer = http.createServer(app)
const websocket = new WebSocketServer(httpServer, { cors: { origin: CORS_ORIGIN } })

// serve static files
serveStatic(app)

applyIceConfigMiddleware(websocket)

applyPeerDiscoveryMiddleware(websocket, {
  peers, rooms, jwtSecret, onRoomsChanged: rooms => {
    websocket.emit('rooms', rooms)
  }
})

applySignalingMiddleware(websocket, { peers, rooms })

websocket.on('connection', socket => {
  console.info(`socket ${socket.handshake.query.peerId} connected`)
  socket.emit('rooms', rooms)
})

httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
