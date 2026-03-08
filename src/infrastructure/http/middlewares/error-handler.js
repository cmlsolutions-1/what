const AppError = require("../../../shared/errors/app-error");

function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
  }

  return res.status(500).json({
    message: "Internal server error",
  });
}

module.exports = errorHandler;


