import { Request, Response, NextFunction } from 'express';

/**
 * Global error handler middleware.
 * Catches unhandled errors from route handlers and returns structured error responses.
 * Must be registered as the LAST middleware in Express.
 */
export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction): void {
  // Log error details (not exposed to client)
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message || err);

  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma known errors
  if (err.code === 'P2002') {
    res.status(409).json({
      error: 'A record with this unique value already exists.',
      field: err.meta?.target,
    });
    return;
  }

  if (err.code === 'P2025') {
    res.status(404).json({
      error: 'Record not found.',
    });
    return;
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'File too large. Maximum size exceeded.',
    });
    return;
  }

  // Generic server error
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: statusCode === 500
      ? 'An internal server error occurred. Please try again.'
      : err.message || 'An error occurred.',
  });
}
