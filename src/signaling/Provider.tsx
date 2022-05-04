import React, { useContext, useEffect, useState } from 'react'
import { Subscription } from 'rxjs'
import { SignalingChanel } from '.'

const SignalingChanelContext = React.createContext<SignalingChanel>(undefined as unknown as SignalingChanel)

function SignalingChannelProvider({ children, signalingChannel }: React.PropsWithChildren<{ signalingChannel: SignalingChanel }>) {
  return <SignalingChanelContext.Provider value={signalingChannel}>{children}</SignalingChanelContext.Provider>
}

export default SignalingChannelProvider

export function useSignalingChannel() {
  const [isConnected, setIsConnected] = useState(false)
  const signalingChannel = useContext(SignalingChanelContext)
  useEffect(() => {
    const subscriptions: Subscription[] = []
    subscriptions.push(signalingChannel.onConnect.subscribe(() => setIsConnected(true)))
    subscriptions.push(signalingChannel.onDisconnect.subscribe(() => setIsConnected(false)))
    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
  return { isConnected, ...signalingChannel }
}
