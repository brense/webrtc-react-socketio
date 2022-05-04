import { useEffect } from 'react'
import { RoomPayload, useSignalingChannel } from '../signaling'

function useOnCall(eventListener: (payload: RoomPayload & { [key: string]: any }) => void) {
  const { onCall, me } = useSignalingChannel()
  useEffect(() => {
    const subscriber = onCall.subscribe(payload => payload.from !== me() && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [onCall, me, eventListener])
}

export default useOnCall
