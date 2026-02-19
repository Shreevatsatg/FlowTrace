const express = require('express')
const cors = require('cors')
const config = require('./src/config')
const routes = require('./src/routes')
const errorHandler = require('./src/middleware/errorHandler')

const app = express()

// Middleware
app.use(cors(config.cors))
app.use(express.json())

// Routes
app.use('/', routes)

// Error handling
app.use(errorHandler)

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Money Muling Detection API running on port ${config.port}`)
})

module.exports = app