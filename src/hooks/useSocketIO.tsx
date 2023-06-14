import React, { useContext, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'

const SocketIOContext = React.createContext(undefined as undefined | Socket)

export default function useSocketIO() {
  const socket = useContext(SocketIOContext)
  if (!socket) {
    throw new Error('Did you forget to add SocketIOProvider?')
  }
  return socket as unknown as Socket
}

export function SocketIOProvider({ children, socket: customSocket }: React.PropsWithChildren<{ socket?: Socket }>) {
  const socketRef = useRef(customSocket)
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io()
    }
  }, [])
  return <SocketIOContext.Provider value={socketRef.current}>
    {children}
  </SocketIOContext.Provider>
}
