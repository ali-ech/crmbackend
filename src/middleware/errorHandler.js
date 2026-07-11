export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorHandler(err, req, res, _next) {
  console.error(err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large (max 10 MB)' });
  }

  if (err.message?.includes('Unsupported file type')) {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message || 'File upload failed' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ error: `Duplicate ${field}` });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}
