import { defineConfig } from 'vite'
import reactRefresh from '@vitejs/plugin-react-refresh'
import envCompatible from 'vite-plugin-env-compatible'
import svgrPlugin from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/socket.io': {
        ws: true,
        changeOrigin: true,
        autoRewrite: true,
        target: 'http://localhost:3001'
      }
    }
  },
  build: {
    outDir: 'build',
  },
  plugins: [
    reactRefresh(),
    svgrPlugin({
      svgrOptions: {
        icon: true,
        // ...svgr options (https://react-svgr.com/docs/options/)
      },
    }),
    envCompatible()
  ],
})
