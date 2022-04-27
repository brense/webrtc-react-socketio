import { CircularProgress, DialogActions, DialogContent, DialogTitle, Icon, IconButton, Typography } from '@mui/material'
import { useCallback, useRef, useState } from 'react'
import { Room as WebRTCRoom, useOnChannelClose, useOnChannelOpen } from '../webrtc/webRTC'

function PrivateCall({ caller, room, onEndCall }: { room?: WebRTCRoom, caller?: { answered?: boolean, room: string, from: string, name: string | undefined }, onEndCall: () => void }) {
  const [connected, setConnected] = useState(false)
  const [hasLeft, setHasLeft] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const streamRef = useRef<MediaStream>()

  const startRecording = useCallback(async () => {
    setIsRecording(true)
    const stream = await navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false
      })
    streamRef.current = stream
    stream.getTracks().forEach(track => room?.addTrack(track, stream))
  }, [room])

  const stopRecording = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = undefined
      room?.removeTrack()
      setIsRecording(false)
    }
  }, [room])

  useOnChannelOpen(room?.name || '', () => {
    setConnected(true)
    startRecording()
  })
  useOnChannelClose(room?.name || '', () => {
    setConnected(false)
    setHasLeft(true)
    stopRecording()
  })

  const handleOnClose = useCallback(() => {
    stopRecording()
    room?.leaveRoom()
    onEndCall()
  }, [stopRecording, onEndCall, room])

  return <>
    <DialogTitle>{connected ? 'In call with' : 'Calling'} {caller?.name}</DialogTitle>
    <audio ref={audioRef} autoPlay />
    {connected ? null : hasLeft ? <DialogContent><Typography>{caller?.name} has left the call</Typography></DialogContent> : <DialogContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <Typography gutterBottom>Waiting for {caller?.name} to answer</Typography>
      <CircularProgress variant="indeterminate" />
    </DialogContent>}
    <DialogActions sx={{ justifyContent: 'space-between' }}>
      <IconButton onClick={isRecording ? stopRecording : startRecording}><Icon color={isRecording ? 'success' : 'inherit'}>{isRecording ? 'mic' : 'mic_off'}</Icon></IconButton>
      <IconButton onClick={handleOnClose}><Icon color="error" fontSize="large">phone</Icon></IconButton>
    </DialogActions>
  </>
}

export default PrivateCall
