import { Dialog } from '@mui/material'

function PrivateCall({ open, onClose, room }: { open: boolean, room?: string, onClose?: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void }) {
  return <Dialog open={open} onClose={onClose}>
    <span>making a call...</span>
  </Dialog>
}

export default PrivateCall
