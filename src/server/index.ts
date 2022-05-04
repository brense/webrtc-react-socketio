import express from 'express'
import http from 'http'
import { Server as WebSocketServer } from 'socket.io'
import serveStatic from './serveStatic'

const app = express()
export const httpServer = http.createServer(app)
export const websocket = new WebSocketServer(httpServer)

serveStatic(app)

export { default as removeAbandonedBroadcasts } from './removeAbandonedBroadcasts'
export { default as attemptRejoinRoom } from './attemptRejoinRoom'

export { default as handleCall } from './handleCall'
export { default as handleJoin } from './handleJoin'
export { default as handleLeave } from './handleLeave'

export { default as handleDescription } from './handleDescription'
export { default as handleCandidate } from './handleCandidate'
