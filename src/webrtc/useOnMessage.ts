import { useEffect } from 'react'
import { MessageEventPayload } from './types'
import { subjects } from './webRTCClient'

function useOnMessage(room: string, eventListener: (payload: MessageEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onMessage.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export default useOnMessage
