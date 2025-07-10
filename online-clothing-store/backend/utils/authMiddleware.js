function verifyAdmin(req, res, next) {
  const token = req.headers.authorization;
  if (token === "Bearer admin123") {
    next();
  } else {
    res.status(403).json({ error: "Unauthorized" });
  }
}

module.exports = { verifyAdmin };
