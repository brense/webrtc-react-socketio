import { Button, Typography } from '@mui/material'
import { PropsWithChildren, useCallback, useRef } from 'react'
import { usePeerConnection } from './webrtc'

function Room({ room, configuration }: PropsWithChildren<{ room: string, configuration?: RTCConfiguration }>) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { addTrack } = usePeerConnection({
    room,
    onTrack: track => {
      if (audioRef.current) {
        audioRef.current.srcObject = track.streams[0]
      }
      track.streams[0].onremovetrack = () => {
        if (audioRef.current) {
          audioRef.current.srcObject = null
        }
      }
    },
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

  return <>
    <Typography component="code">{room}</Typography>
    <Button onClick={handleBroadcast}>broadcast</Button>
    <audio ref={audioRef} autoPlay />
  </>
}

export default Room
