const express = require("express");
const router = express.Router();
const { getProducts, addProduct } = require("../controllers/productController");
const { verifyAdmin } = require("../utils/authMiddleware");

router.get("/", getProducts);
router.post("/", verifyAdmin, addProduct);

module.exports = router;
