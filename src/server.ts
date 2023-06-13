import http from 'http'
import express from 'express'
import initSocketServer from './socketServer'

const { PORT = '3000' } = process.env

const app = express()
const httpServer = http.createServer(app)
initSocketServer(httpServer)

// TODO: serve static...

httpServer.listen(Number(PORT), '0.0.0.0', () => console.log(`Server ready at http://0.0.0.0:${PORT}`))
