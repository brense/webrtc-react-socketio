import { Dialog, DialogContent, Typography } from '@mui/material'
import { useMemo } from 'react'

function RoomLink({ open, onClose, room }: { open: boolean, room?: string, onClose?: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void }) {
  const link = useMemo(() => `${window.location.protocol}//${window.location.host}?room=${room}`, [room])
  return <Dialog open={open} onClose={onClose}>
    <DialogContent>
      <Typography sx={{ whiteSpace: 'nowrap' }}>{link}</Typography>
    </DialogContent>
  </Dialog>
}

export default RoomLink
