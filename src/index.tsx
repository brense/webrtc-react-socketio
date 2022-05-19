import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import reportWebVitals from './reportWebVitals'
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material'
import { pink, teal } from '@mui/material/colors'
import createIoSignalingChannel, { SignalingChannelProvider } from './signaling'
import App from './App'
import moment from 'moment'
import 'moment/locale/nl'
import { SnackbarProvider } from './useSnackbar'
import { UsernameDialogProvider } from './useUsernameDialog'

moment.locale('nl')

const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
const socketUrl = `${window.location.protocol}//${window.location.hostname}:${port}`

const signalingChannel = createIoSignalingChannel(socketUrl, { autoConnect: true })

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: teal,
    secondary: pink
  }
})

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <React.StrictMode>
    <SignalingChannelProvider signalingChannel={signalingChannel}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <UsernameDialogProvider>
            <CssBaseline />
            <App />
          </UsernameDialogProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </SignalingChannelProvider>
  </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
