const db = require('../config/db-json');
const asyncHandler = require('express-async-handler');

const addOrderItems = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress, paymentMethod, vodafoneCashNumber, vodafoneCashName, email, phone } = req.body;

  if (!orderItems || orderItems.length === 0) {
    res.status(400);
    throw new Error('لا توجد عناصر في الطلب');
  }

  // التحقق من توفر الكميات
  for (const item of orderItems) {
    const product = db.getProductById(item.productId);
    if (!product || product.sizes[item.size] < item.quantity) {
      res.status(400);
      throw new Error(`الكمية غير متوفرة للمنتج ${product ? product.name : ''} مقاس ${item.size}`);
    }
  }

  const orderData = {
    userId: req.user.id,
    orderItems: orderItems.map(item => ({
      productId: item.productId,
      name: item.name,
      size: item.size,
      quantity: item.quantity,
      price: item.price,
      image: item.image
    })),
    shippingAddress,
    paymentMethod,
    vodafoneCashNumber,
    vodafoneCashName,
    email,
    phone,
    totalPrice: orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  };

  const order = db.createOrder(orderData);
  
  // تخفيض الكميات في المخزن
  db.reduceProductQuantities(orderItems);

  res.status(201).json(order);
});

module.exports = { addOrderItems };