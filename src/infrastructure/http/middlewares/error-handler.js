import AppError from "../../../shared/errors/app-error.js";

function errorHandler(error, _req, res, _next) {

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details ?? null,
    });
  }

  // 👇 MUY IMPORTANTE
  console.error("UNEXPECTED ERROR:");
  console.error(error);
  console.error(error.stack);

  return res.status(500).json({
    message: "Internal server error",
  });
}

export default errorHandler;