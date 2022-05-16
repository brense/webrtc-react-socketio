import { Button } from '@mui/material'
import { PropsWithChildren, useCallback } from 'react'
import { usePeerConnection } from './webrtc'

function Room({ room, configuration }: PropsWithChildren<{ room: string, configuration?: RTCConfiguration }>) {
  const { addTrack } = usePeerConnection({
    room,
    onTrack: track => console.log('received track!', track),
    ...configuration
  })

  const handleBroadcast = useCallback(async () => {
    const stream = await navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false
      })
    stream.getTracks().forEach(track => addTrack(track, stream))
  }, [addTrack])

  return <Button onClick={handleBroadcast}>broadcast</Button>
}

export default Room
