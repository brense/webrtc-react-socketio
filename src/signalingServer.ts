#!/usr/bin/env node

import yargs from 'yargs'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import serveStatic from './serveStatic'
import { applySignalingMiddleware } from './server'

dotenv.config()

const {
  ICE_ADDRESS = 'openrelay.metered.ca',
  ICE_PORT = '80',
  ICE_SSH_PORT = '443',
  ICE_USER = 'openrelayproject',
  ICE_CREDENTIAL = 'openrelayproject',
  PORT = '3001'
} = process.env

export const iceServers = [
  { urls: `stun:${ICE_ADDRESS}:${ICE_PORT}` },
  { urls: `turn:${ICE_ADDRESS}:${ICE_PORT}`, username: ICE_USER, credential: ICE_CREDENTIAL },
  { urls: `turn:${ICE_ADDRESS}:${ICE_SSH_PORT}`, username: ICE_USER, credential: ICE_CREDENTIAL },
  { urls: `turn:${ICE_ADDRESS}:${ICE_SSH_PORT}?transport=tcp`, username: ICE_USER, credential: ICE_CREDENTIAL }
]

console.info('configured ice servers:', iceServers)

// parse process args
export const { port } = yargs.options({
  'port': {
    alias: 'p',
    type: 'number',
    default: Number(PORT)
  }
}).argv

// init websocket server
const app = express()
export const httpServer = http.createServer(app)
export const websocket = new WebSocketServer(httpServer)

// serve static files
serveStatic(app)

// send ice server config to connected peer
websocket.use((socket, next) => {
  socket.emit('config', iceServers)
  next()
})

applySignalingMiddleware(websocket)

websocket.on('connection', socket => {
  console.info(`peer ${socket.id} connected`)
})

httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
