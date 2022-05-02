import express, { Express, Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

function serveStatic(app: Express) {
  app.use('/static', express.static(path.resolve(__dirname, 'static')))
  app.use(express.json())
  app.use(express.urlencoded({ extended: false }))
  app.get(/^(?!\/socket.io).*$/, serveStaticFiles)

  function serveStaticFiles(req: Request, res: Response) {
    if (path.extname(req.path) !== '') {
      const resolvedPath = path.resolve(__dirname, `.${req.path}`)
      if (fs.existsSync(resolvedPath)) {
        res.sendFile(resolvedPath)
      } else {
        res.sendStatus(404)
      }
    } else {
      const index = path.resolve(__dirname, 'index.html')
      res.sendFile(index)
    }
  }
}

export default serveStatic
