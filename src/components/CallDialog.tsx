import { Dialog } from '@mui/material'
import { Room as WebRTCRoom } from '../webrtc/webRTC'
import PrivateCall from './PrivateCall'

function CallDialog({ name, caller, room, onEndCall }: { name: string, room?: WebRTCRoom, caller?: { answered?: boolean, room: string, from: string, name: string | undefined }, onEndCall: () => void }) {
  return <Dialog open={caller?.answered || false}>
    {caller?.answered && <PrivateCall name={name} caller={caller} room={room} onEndCall={onEndCall} />}
  </Dialog>
}

export default CallDialog
