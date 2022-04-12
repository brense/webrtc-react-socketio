import React from 'react'
import { createRoot } from 'react-dom/client'
import reportWebVitals from './reportWebVitals'
import { createWebRTCClient, createIoSignalingChanel, WebRTCClientProvider, SignalingChannelProvider } from './webRTC'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { pink, teal } from '@mui/material/colors'
import './index.css'
import App from './App'

const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
const socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`

const signalingChannel = createIoSignalingChanel(socketUrl, { autoConnect: false })
const webRTCClient = createWebRTCClient(signalingChannel)

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: teal,
    secondary: pink
  }
})

const root = createRoot(document.getElementById('root') as HTMLElement)
root.render(<React.StrictMode>
  <SignalingChannelProvider signalingChannel={signalingChannel}>
    <WebRTCClientProvider client={webRTCClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </WebRTCClientProvider>
  </SignalingChannelProvider>
</React.StrictMode>)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
