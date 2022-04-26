import { CircularProgress, DialogActions, DialogContent, DialogTitle, Icon, IconButton, Typography } from '@mui/material'
import { useCallback, useRef, useState } from 'react'
import { Room as WebRTCRoom, useOnChannelClose, useOnChannelOpen, useOnTrack } from '../webrtc/webRTC'

function PrivateCall({ name, caller, room, onEndCall }: { name: string, room?: WebRTCRoom, caller?: { answered?: boolean, room: string, from: string, name: string | undefined }, onEndCall: () => void }) {
  const [connected, setConnected] = useState(false)
  const [hasLeft, setHasLeft] = useState(false)
  const [muted, setMuted] = useState(false)
  const [hasAudio, setHasAudio] = useState(false)
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

  useOnTrack(room?.name || '', ({ remotePeerId, track }) => {
    if (audioRef.current) {
      audioRef.current.srcObject = track.streams[0]
      setHasAudio(true)
      track.streams[0].onremovetrack = () => {
        if (audioRef.current) {
          setHasAudio(false)
          audioRef.current.srcObject = null
        }
      }
    }
  })

  useOnChannelOpen(room?.name || '', () => {
    setMuted(false)
    setConnected(true)
    startRecording()
  })
  useOnChannelClose(room?.name || '', () => {
    setMuted(true)
    setConnected(false)
    setHasLeft(true)
    stopRecording()
  })

  const handleOnClose = useCallback(() => {
    room?.leaveRoom()
    setMuted(true)
    stopRecording()
    onEndCall()
  }, [stopRecording, onEndCall, room])

  const toggleAudioMuted = useCallback(() => {
    setMuted(muted => !muted)
  }, [])

  return <>
    <DialogTitle>{connected ? 'In call with' : 'Calling'} {caller?.name}</DialogTitle>
    <audio ref={audioRef} autoPlay />
    {connected ? null : hasLeft ? <DialogContent><Typography>{caller?.name} has left the call</Typography></DialogContent> : <DialogContent sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <Typography gutterBottom>Waiting for {caller?.name} to answer</Typography>
      <CircularProgress variant="indeterminate" />
    </DialogContent>}
    <DialogActions sx={{ justifyContent: 'space-between' }}>
      <IconButton onClick={isRecording ? stopRecording : startRecording}><Icon color={isRecording ? 'success' : 'inherit'}>{isRecording ? 'mic' : 'mic_off'}</Icon></IconButton>
      <IconButton onClick={toggleAudioMuted}><Icon color={hasAudio ? muted ? 'success' : 'inherit' : 'disabled'}>{hasAudio && !muted ? 'volume_up' : 'volume_off'}</Icon></IconButton>
      <IconButton onClick={handleOnClose}><Icon color="error">phone</Icon></IconButton>
    </DialogActions>
  </>
}

export default PrivateCall
