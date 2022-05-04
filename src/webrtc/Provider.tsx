import React, { useContext } from 'react'
import { WebRTCClient } from './types'

const WebRTCClientContext = React.createContext<WebRTCClient>(undefined as unknown as WebRTCClient)

function WebRTCClientProvider({ children, client }: React.PropsWithChildren<{ client: WebRTCClient }>) {
  return <WebRTCClientContext.Provider value={client}>{children}</WebRTCClientContext.Provider>
}

export default WebRTCClientProvider

export function useWebRTC() {
  const webRTCClient = useContext(WebRTCClientContext)
  return webRTCClient
}
