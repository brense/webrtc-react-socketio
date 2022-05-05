import { useEffect } from 'react'
import { TrackEventPayload } from './types'
import { subjects } from './webRTCClient'

function useOnTrack(room: string, eventListener: (payload: TrackEventPayload) => void) {
  useEffect(() => {
    const subscriber = subjects.onTrack.subscribe(payload => payload.room === room && eventListener(payload))
    return () => subscriber.unsubscribe()
  }, [room, eventListener])
}

export default useOnTrack
