import React from 'react'
import { createRoot } from 'react-dom/client'
import reportWebVitals from './reportWebVitals'
import { createWebRTCClient, createIoSignalingChanel, WebRTCClientProvider, SignalingChannelProvider } from './webrtc'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { pink, teal } from '@mui/material/colors'
import moment from 'moment'
import 'moment/locale/nl'
import './index.css'
import App from './App'

moment.locale('nl')

const urlParams = new URLSearchParams(window.location.search)
const iceAddress = urlParams.get('iceaddress') || 'openrelay.metered.ca'
const icePort = urlParams.get('iceport') || '80'
const iceSshPort = urlParams.get('icesshport') || '443'
const iceUser = urlParams.get('iceuser') || 'openrelayproject'
const icePassword = urlParams.get('icepassword') || 'openrelayproject'

const iceServers = [
  {
    urls: `stun:${iceAddress}:${icePort}`
  },
  {
    urls: `turn:${iceAddress}:${icePort}`,
    username: iceUser,
    credential: icePassword
  },
  {
    urls: `turn:${iceAddress}:${iceSshPort}`,
    username: iceUser,
    credential: icePassword
  },
  {
    urls: `turn:${iceAddress}:${iceSshPort}?transport=tcp`,
    username: iceUser,
    credential: icePassword
  }
]

const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
const socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`

const signalingChannel = createIoSignalingChanel(socketUrl, { autoConnect: true })
const webRTCClient = createWebRTCClient({ signalingChannel, iceServers })

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
