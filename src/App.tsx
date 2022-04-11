import { Box, Button, Card, CardContent, CardHeader } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import useWebRTC from './useWebRTC'

function App() {
  const [connected, setConnected] = useState(false)
  const webRTCClient = useWebRTC()

  useEffect(() => {
    webRTCClient.onConnect.subscribe(() => setConnected(true))
    webRTCClient.onDisconnect.subscribe(() => setConnected(false))
  }, [webRTCClient])

  const handleConnect = useCallback(() => {
    webRTCClient.connect()
  }, [webRTCClient])

  return <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Card>
      <CardHeader title="Hello World" />
      <CardContent>
        <Button variant="contained" onClick={handleConnect} disabled={connected}>{connected ? 'Connected' : 'Connect'}</Button>
      </CardContent>
    </Card>
  </Box>
}

export default App
