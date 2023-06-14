import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SocketIOProvider } from './hooks/useSocketIO.tsx'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SocketIOProvider>
      <App />
    </SocketIOProvider>
  </React.StrictMode>,
)
