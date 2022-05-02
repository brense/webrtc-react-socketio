import yargs from 'yargs'
import dotenv from 'dotenv'

dotenv.config()

// TURN server config object for client
const {
  ICE_ADDRESS = 'openrelay.metered.ca',
  ICE_PORT = '80',
  ICE_SSH_PORT = '443',
  ICE_USER = 'openrelayproject',
  ICE_CREDENTIAL = 'openrelayproject'
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
    default: 3001
  }
}).argv

export const broadcasts: { [key: string]: string } = {}
