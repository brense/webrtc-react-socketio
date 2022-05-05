import { useEffect } from 'react'
import { RoomPayload, useSignalingChannel } from '../signaling'

function useOnNewPeer(room: string, eventListener: (payload: RoomPayload) => void) {
  const { onJoin } = useSignalingChannel()
  useEffect(() => {
    const subscriber = onJoin.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener, onJoin])
}

export default useOnNewPeer
