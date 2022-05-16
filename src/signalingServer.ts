#!/usr/bin/env node

import yargs from 'yargs'
import dotenv from 'dotenv'
import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import serveStatic from './serveStatic'
import { applySignalingMiddleware, applyPeerDiscoveryMiddleware } from './server'
import applyIceConfigMiddleware from './iceConfigMiddleware'

dotenv.config()

const { PORT = '3001' } = process.env

const broadcasts: { [key: string]: string } = {};

// parse process args
const { port } = yargs.options({ 'port': { alias: 'p', type: 'number', default: Number(PORT) } }).argv

// init websocket server
const app = express()
const httpServer = http.createServer(app)
const websocket = new WebSocketServer(httpServer, {
  cors: {
    origin: 'http://localhost:3000' // TODO: remove cors? or change hardcoded value
  }
})

// serve static files
serveStatic(app)

applyIceConfigMiddleware(websocket)

applyPeerDiscoveryMiddleware(websocket, broadcasts)

applySignalingMiddleware(websocket, broadcasts)

websocket.on('connection', socket => {
  console.info(`socket ${socket.id} connected`)
})

httpServer.listen(port, '0.0.0.0', () => console.log(`🚀 Server ready at ws://localhost:${port}`))
