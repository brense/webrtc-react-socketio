import { Box, Button, Card, CardContent, CardHeader } from '@mui/material'
import { useCallback } from 'react'
import useWebRTC from './useWebRTC'

function App() {
  const webRTCClient = useWebRTC()

  const handleConnect = useCallback(() => {
    webRTCClient.connect()
  }, [webRTCClient])

  return <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Card>
      <CardHeader title="Hello World" />
      <CardContent>
        <Button variant="contained" onClick={handleConnect}>Click me!</Button>
      </CardContent>
    </Card>
  </Box>
}

export default App
