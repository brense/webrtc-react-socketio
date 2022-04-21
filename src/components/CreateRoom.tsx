import { CircularProgress, Dialog, DialogContent, FormControlLabel, Link, Switch, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSignalingEvent, useSignalingChannel } from '../webrtc/signalingChannel'

function CreateRoom({ open, onClose, onJoinRoom }: { open: boolean, onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void, onJoinRoom: (room: string) => void }) {
  const [receivedRoom, setReceivedRoom] = useState<string>()
  const [isBroadcast, setIsBroadcast] = useState(false)
  const href = useMemo(() => `${window.location.protocol}//${window.location.host}/?room=${receivedRoom}`, [receivedRoom])
  const { call } = useSignalingChannel()
  useSignalingEvent('onCall', ({ from, room }) => from === 'self' && setReceivedRoom(room))

  const handleJoinRoom = useCallback(() => {
    if (receivedRoom) {
      // window.history.pushState('', '', href)
      onJoinRoom(receivedRoom)
    }
  }, [receivedRoom, onJoinRoom])

  useEffect(() => {
    call({ isBroadcast })
  }, [call, isBroadcast])

  return <Dialog open={open} onClose={onClose} PaperProps={{ sx: { maxWidth: 'none' } }}>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {receivedRoom ? <>
        <Typography>This is your room url:</Typography>
        <Link onClick={handleJoinRoom} sx={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>{href}</Link>
        <FormControlLabel control={<Switch checked={isBroadcast} onChange={() => setIsBroadcast(checked => !checked)} />} label="Create broadcast" />
      </> : <CircularProgress variant="indeterminate" />}
    </DialogContent>
  </Dialog>
}

export default CreateRoom
