import { Button, Card, CardHeader, Divider, Box, List, ListItem, ListItemText, ListItemSecondaryAction } from '@mui/material'

function CreateOrJoinRoom({ broadcasts, onJoin, onCall, isConnected }: { isConnected: boolean, broadcasts: { [key: string]: string }, onJoin: (room: string) => void, onCall: (payload: { isBroadcast: boolean }) => void }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <Card sx={{ marginBottom: 2 }}>
      <CardHeader title="Available broadcasts" />
      <Divider />
      <List disablePadding>
        {Object.keys(broadcasts).map(k => <ListItem key={k}>
          <ListItemText primary="Room ID" secondary={k} secondaryTypographyProps={{ component: 'code', sx: { fontFamily: '\'Roboto Mono\', monospace', fontWeight: 200 } }} />
          <ListItemSecondaryAction>
            <Button size="small" onClick={() => onJoin(k)}>Join</Button>
          </ListItemSecondaryAction>
        </ListItem>)}
        {Object.keys(broadcasts).length === 0 && <ListItem><ListItemText primary="None" /></ListItem>}
      </List>
    </Card>
    <Button onClick={() => onCall({ isBroadcast: true })} size="large" variant="contained" disabled={!isConnected}>Create room</Button>
  </Box>
}

export default CreateOrJoinRoom
