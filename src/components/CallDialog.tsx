import { Dialog } from '@mui/material'
import { Room as WebRTCRoom } from '../webrtc/webRTC'
import PrivateCall from './PrivateCall'

function CallDialog({ caller, room, onEndCall }: { room?: WebRTCRoom, caller?: { answered?: boolean, room: string, from: string, name: string | undefined }, onEndCall: () => void }) {
  return <Dialog open={caller?.answered || false}>
    {caller?.answered && <PrivateCall caller={caller} room={room} onEndCall={onEndCall} />}
  </Dialog>
}

export default CallDialog
