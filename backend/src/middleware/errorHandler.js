const errorHandler = (err, req, res, next) => {
  console.error(err.stack)

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' })
    }
    return res.status(400).json({ error: 'File upload error' })
  }

  if (err.message === 'Only CSV files are allowed') {
    return res.status(400).json({ error: 'Only CSV files are allowed' })
  }

  res.status(500).json({ error: 'Internal server error' })
}

module.exports = errorHandler