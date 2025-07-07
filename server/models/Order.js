const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  size: {
    type: String,
    required: true,
    enum: ['S', 'M', 'L', 'XL', 'OS']
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  price: {
    type: Number,
    required: true
  }
});

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderItems: [orderItemSchema],
  shippingAddress: {
    type: String,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['vodafone_cash', 'cash_on_delivery']
  },
  vodafoneCashNumber: {
    type: String,
    required: function() { return this.paymentMethod === 'vodafone_cash'; }
  },
  vodafoneCashName: {
    type: String,
    required: function() { return this.paymentMethod === 'vodafone_cash'; }
  },
  vodafoneCashImage: {
    type: String,
    required: function() { return this.paymentMethod === 'vodafone_cash'; }
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
  },
  trackingNumber: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Order', orderSchema);