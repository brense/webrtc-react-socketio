import { CircularProgress, Dialog, DialogContent, Link, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSignalingEvent, useSignalingChannel } from '../webrtc/signalingChannel'

function CreateRoom({ open, onClose, onJoinRoom }: { open: boolean, onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void, onJoinRoom: (room: string) => void }) {
  const [receivedRoom, setReceivedRoom] = useState<string>()
  const href = useMemo(() => `${window.location.protocol}//${window.location.host}/?room=${receivedRoom}`, [receivedRoom])
  const { call } = useSignalingChannel()
  useSignalingEvent('onCall', ({ from, room }) => from === 'self' && setReceivedRoom(room))

  const handleJoinRoom = useCallback(() => {
    if (receivedRoom) {
      window.history.pushState('', '', href)
      onJoinRoom(receivedRoom)
    }
  }, [href, receivedRoom, onJoinRoom])

  useEffect(() => {
    call()
  }, [call])

  return <Dialog open={open} onClose={onClose} PaperProps={{ sx: { maxWidth: 'none' } }}>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {receivedRoom ? <>
        <Typography>This is your room url:</Typography>
        <Link onClick={handleJoinRoom} sx={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>{href}</Link>
      </> : <CircularProgress variant="indeterminate" />}
    </DialogContent>
  </Dialog>
}

export default CreateRoom
