import { Dialog, List, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Icon, ListSubheader } from '@mui/material'

export type Member = {
  name: string
  remotePeerId: string
}

function RoomMembers({ open, members, onClose, onCall }: { open: boolean, members: Member[], onCall: (payload: { name: string, remotePeerId: string }) => void, onClose?: (event: {}, reason: "backdropClick" | "escapeKeyDown") => void }) {
  return <Dialog open={open} onClose={onClose}>
    <List subheader={<ListSubheader>Room members</ListSubheader>}>
      {members.map(({ name, remotePeerId }) => <ListItem key={remotePeerId}>
        <ListItemText primary={name} secondary={remotePeerId} secondaryTypographyProps={{ component: 'code', sx: { fontFamily: '\'Roboto Mono\', monospace', fontWeight: 200 } }} />
        <ListItemSecondaryAction>
          <IconButton onClick={() => onCall({ name, remotePeerId })}><Icon color="success">call</Icon></IconButton>
        </ListItemSecondaryAction>
      </ListItem>)}
    </List>
  </Dialog>
}

export default RoomMembers
