const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');
const { protect, admin } = require('../middleware/auth');

// @desc    جلب جميع المنتجات
// @route   GET /api/products
// @access  عام
router.route('/')
  .get(getProducts)
  .post(protect, admin, createProduct);

// @desc    جلب/تحديث/حذف منتج معين
// @route   GET/PUT/DELETE /api/products/:id
// @access  عام/خاص بالمشرف
router.route('/:id')
  .get(getProductById)
  .put(protect, admin, updateProduct)
  .delete(protect, admin, deleteProduct);

// @desc    جلب منتجات حسب الفئة
// @route   GET /api/products/category/:category
// @access  عام
router.get('/category/:category', getProductsByCategory);

module.exports = router;