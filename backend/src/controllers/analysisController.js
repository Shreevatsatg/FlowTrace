const AnalysisService = require('../services/analysisService')

class AnalysisController {
  static async analyze(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded. Use field name "file".' })
      }

      const result = await AnalysisService.analyze(req.file.buffer)
      res.json(result)
    } catch (error) {
      if (error.message.includes('CSV')) {
        return res.status(422).json({ error: error.message })
      }
      next(error)
    }
  }

  static health(req, res) {
    res.json({ status: 'ok', message: 'Money Muling Detection API is running.' })
  }
}

module.exports = AnalysisController