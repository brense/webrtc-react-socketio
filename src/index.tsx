import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import reportWebVitals from './reportWebVitals'
import io from 'socket.io-client'
import createSocketIOSignalingChannel from './signalingChannel'
import createWebRTCClient from './webRTCClient'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { pink, teal } from '@mui/material/colors'
import { WebRTCClientProvider } from './useWebRTC'

const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
const socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`
const socket = io(socketUrl, { autoConnect: false })

const webRTCClient = createWebRTCClient(() => {
  return createSocketIOSignalingChannel(socket)
})

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: teal,
    secondary: pink
  }
})

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<React.StrictMode>
  <WebRTCClientProvider client={webRTCClient}>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </WebRTCClientProvider>
</React.StrictMode>)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
