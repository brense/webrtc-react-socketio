import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { ViteDevServer } from 'vite'

const httpMiddlewarePlugin = (onInit: (http: ViteDevServer['httpServer']) => void) => ({
  name: 'http-middleware-plugin',
  async configureServer(server: ViteDevServer) {
    onInit(server.httpServer)
  }
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), httpMiddlewarePlugin(() => { console.log('middleware')})],
})
