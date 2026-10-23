/**
 * Wraps async route handlers so rejected promises reach the Express error middleware.
 * Express 5 does this natively, but the explicit wrapper keeps controllers uniform.
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
