import { Button, Card, Box, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material'

function CreateOrJoinRoom({ broadcasts, onJoin, onCall, isConnected }: { isConnected: boolean, broadcasts: { [key: string]: string }, onJoin: (room: string) => void, onCall: (payload: { isBroadcast: boolean }) => void }) {
  return <Box>
    <Card>
      <List disablePadding>
        {Object.keys(broadcasts).map(k => <ListItem key={k}>
          <ListItemText primary={k} />
          <ListItemSecondaryAction>
            <Button size="small" onClick={() => onJoin(k)}>Join</Button>
          </ListItemSecondaryAction>
        </ListItem>)}
      </List>
    </Card>
    <Button onClick={() => onCall({ isBroadcast: true })} size="large" variant="contained" disabled={!isConnected}>Create room</Button>
  </Box>
}

export default CreateOrJoinRoom
