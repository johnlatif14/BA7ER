const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/auth');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct
} = require('../controllers/productController');
const {
  getOrders
} = require('../controllers/orderController');

// Products
router.route('/products')
  .get(protect, admin, getProducts)
  .post(protect, admin, createProduct);

router.route('/products/:id')
  .get(protect, admin, getProductById)
  .put(protect, admin, updateProduct);

// Orders
router.route('/orders')
  .get(protect, admin, getOrders);

module.exports = router;