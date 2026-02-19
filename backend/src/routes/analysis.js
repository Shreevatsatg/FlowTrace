const express = require('express')
const AnalysisController = require('../controllers/analysisController')
const upload = require('../middleware/upload')

const router = express.Router()

router.get('/', AnalysisController.health)
router.post('/analyze', upload.single('file'), AnalysisController.analyze)

module.exports = router