import config from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const DUPLICATE_MESSAGES = {
  phone: 'This phone number is already registered.',
  email: 'This email address is already registered.',
  nid: 'This NID number is already registered.',
  code: 'This code is already in use.',
  accountNo: 'This account number already exists.',
  txnNo: 'This transaction number already exists.',
  user: 'This record already exists.',
};

function normalise(error) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error?.name === 'ValidationError' && error.errors) {
    const details = Object.entries(error.errors).map(([field, issue]) => ({
      field,
      message: issue.message,
    }));
    return {
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Some fields are invalid.',
      details,
    };
  }

  if (error?.name === 'CastError') {
    return {
      status: 400,
      code: 'INVALID_IDENTIFIER',
      message: `Invalid value for ${error.path}.`,
    };
  }

  if (error?.code === 11000) {
    const fields = Object.keys(error.keyValue || error.keyPattern || {});
    const details = fields.map((field) => ({
      field,
      message: 'validation.unique',
    }));
    return {
      status: 409,
      code: 'DUPLICATE_KEY',
      message: DUPLICATE_MESSAGES[fields[0]] || 'A record with these details already exists.',
      details,
    };
  }

  if (error?.name === 'MulterError') {
    const messages = {
      LIMIT_FILE_SIZE: 'The file is larger than the allowed limit.',
      LIMIT_FILE_COUNT: 'Only one file can be uploaded at a time.',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
    };
    return {
      status: 400,
      code: error.code,
      message: messages[error.code] || 'File upload failed.',
    };
  }

  if (error?.type === 'entity.parse.failed') {
    return { status: 400, code: 'INVALID_JSON', message: 'Request body is not valid JSON.' };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong on our side. Please try again.',
  };
}

export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found.`, 'ROUTE_NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, _next) {
  const isExpected = error instanceof ApiError || error?.isOperational;
  const normalised = normalise(error);

  if (!isExpected || normalised.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  if (res.headersSent) return;

  const body = {
    success: false,
    error: {
      code: normalised.code,
      message: normalised.message,
    },
  };

  if (normalised.details) body.error.details = normalised.details;
  if (!config.isProduction && normalised.status >= 500) {
    body.error.stack = error?.stack;
  }

  res.status(normalised.status).json(body);
}

export default errorHandler;
