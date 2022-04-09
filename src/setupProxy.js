const { createProxyMiddleware } = require('http-proxy-middleware')

module.exports = (app) => {
  app.use(
    createProxyMiddleware(['/socket.io'], {
      ws: true,
      changeOrigin: true,
      autoRewrite: true,
      target: 'http://localhost:3001',
    }),
  )
}
