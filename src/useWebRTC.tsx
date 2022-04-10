import React, { useContext } from 'react'
import { WebRTCClient } from './webRTCClient'

const WebRTCClientContext = React.createContext<WebRTCClient>(undefined as unknown as WebRTCClient)

export function WebRTCClientProvider({ children, client }: React.PropsWithChildren<{ client: WebRTCClient }>) {
  return <WebRTCClientContext.Provider value={client}>{children}</WebRTCClientContext.Provider>
}

export default function useWebRTC() {
  return useContext(WebRTCClientContext)
}
