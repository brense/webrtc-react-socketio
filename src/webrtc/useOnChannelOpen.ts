import { useEffect } from 'react'
import { ChannelEventPayload } from './types'
import { subjects } from './webRTCClient'

function useOnChannelOpen(room: string, eventListener: (payload: ChannelEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onChannelOpen.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export default useOnChannelOpen
