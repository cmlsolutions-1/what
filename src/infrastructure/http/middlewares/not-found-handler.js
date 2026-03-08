function notFoundHandler(_req, res) {
  return res.status(404).json({
    message: "Endpoint not found",
  });
}

module.exports = notFoundHandler;

