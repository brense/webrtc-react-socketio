import { Dialog } from '@mui/material'
import { useEffect } from 'react'
import { useWebRTC } from '../webrtc'

function PrivateCall({ open, onClose, room }: { open: boolean, room?: string, onClose?: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void }) {
  const { call: join } = useWebRTC()

  useEffect(() => {
    if (room) {
      console.log('joining room', room)
      join(room)
    }
  }, [join, room])

  return <Dialog open={open} onClose={onClose}>
    <span>making a call...</span>
  </Dialog>
}

export default PrivateCall
