import { Button, CircularProgress, Dialog, DialogContent, Link, Tooltip, Typography } from '@mui/material'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSignalingEvent, useSignalingChannel } from '../webrtc/signalingChannel'

function CreateRoom({ open, onClose, onJoinRoom }: { open: boolean, onClose?: (event: {}, reason: 'backdropClick' | 'escapeKeyDown') => void, onJoinRoom: (room: string) => void }) {
  const [receivedRoom, setReceivedRoom] = useState<string>()
  const [showCopied, setShowCopied] = useState(false)
  const url = useMemo(() => `${window.location.protocol}//${window.location.host}/?room=${receivedRoom}`, [receivedRoom])
  const { createRoom } = useSignalingChannel()
  const { me } = useSignalingChannel()
  useSignalingEvent('onCall', ({ from, room }) => from === me() && setReceivedRoom(room))

  const handleJoinRoom = useCallback(() => {
    if (receivedRoom) {
      // window.history.pushState('', '', url)
      onJoinRoom(receivedRoom)
    }
  }, [receivedRoom, onJoinRoom])

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url)
      setShowCopied(true)
    } catch (e) {
      console.error('failed to copy to clipboard')
    }
  }, [url])

  useEffect(() => {
    createRoom({ isBroadcast: true })
  }, [createRoom])

  return <Dialog open={open} onClose={onClose} PaperProps={{ sx: { maxWidth: 'none' } }}>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {receivedRoom ? <>
        <Typography>This is your broadcast url (click to copy):</Typography>
        <Tooltip open={showCopied} onClose={() => setShowCopied(false)} title="Copied to clipboard!">
          <Link onClick={handleCopyUrl} sx={{ whiteSpace: 'nowrap', cursor: 'pointer' }}>{url}</Link>
        </Tooltip>
        <Button onClick={handleJoinRoom} sx={{ marginTop: 2 }} variant="contained">Join broadcast</Button>
      </> : <CircularProgress variant="indeterminate" />}
    </DialogContent>
  </Dialog>
}

export default CreateRoom
