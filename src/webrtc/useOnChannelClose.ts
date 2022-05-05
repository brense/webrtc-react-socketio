import { useEffect } from 'react'
import { ChannelEventPayload } from './types'
import { subjects } from './webRTCClient'

function useOnChannelClose(room: string, eventListener: (payload: ChannelEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onChannelClose.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export default useOnChannelClose
