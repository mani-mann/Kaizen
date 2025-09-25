export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function errorMiddleware(err, _req, res, _next) {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}

