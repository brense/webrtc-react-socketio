import { Dialog, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Icon } from '@mui/material'

export type Member = {
  name: string
  remotePeerId: string
}

function RoomMembers({ open, members, onClose, onCall }: { open: boolean, members: Member[], onCall: (remotePeerId: string) => void, onClose?: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void }) {
  return <Dialog open={open} onClose={onClose}>
    <List>
      {members.map(({ name, remotePeerId }) => <ListItem key={remotePeerId}>
        <ListItemText primary={name} />
        <ListItemSecondaryAction>
          <IconButton onClick={() => onCall(remotePeerId)}><Icon>call</Icon></IconButton>
        </ListItemSecondaryAction>
      </ListItem>)}
    </List>
  </Dialog>
}

export default RoomMembers
