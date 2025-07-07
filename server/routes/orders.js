const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  addOrderItems,
  getOrderById,
  getMyOrders
} = require('../controllers/orderController');

router.route('/')
  .post(protect, addOrderItems);

router.route('/myorders')
  .get(protect, getMyOrders);

router.route('/:id')
  .get(protect, getOrderById);

module.exports = router;