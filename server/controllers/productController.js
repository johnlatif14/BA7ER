const db = require('../config/db-json');
const asyncHandler = require('express-async-handler');

// @desc    جلب جميع المنتجات
// @route   GET /api/products
// @access  Public
const getProducts = asyncHandler(async (req, res) => {
  const products = db.getProducts();
  res.json(products);
});

// @desc    جلب منتج واحد
// @route   GET /api/products/:id
// @access  Public
const getProductById = asyncHandler(async (req, res) => {
  const product = db.getProductById(req.params.id);
  
  if (product) {
    res.json(product);
  } else {
    res.status(404);
    throw new Error('المنتج غير موجود');
  }
});

// @desc    إنشاء منتج جديد
// @route   POST /api/products
// @access  Private/Admin
const createProduct = asyncHandler(async (req, res) => {
  const { name, price, description, images, sizes } = req.body;
  
  // التحقق من وجود مقاس واحد على الأقل
  const hasSize = Object.values(sizes).some(qty => qty > 0);
  if (!hasSize) {
    res.status(400);
    throw new Error('يجب أن يحتوي المنتج على كمية واحدة على الأقل في أي مقاس');
  }

  const productData = {
    name,
    price,
    description,
    images,
    sizes
  };

  const product = db.createProduct(productData);
  res.status(201).json(product);
});

// @desc    تحديث منتج
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = asyncHandler(async (req, res) => {
  const { name, price, description, images, sizes } = req.body;
  
  const product = db.getProductById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('المنتج غير موجود');
  }

  const updatedProduct = db.updateProduct(req.params.id, {
    name: name || product.name,
    price: price || product.price,
    description: description || product.description,
    images: images || product.images,
    sizes: sizes || product.sizes
  });

  res.json(updatedProduct);
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct
};