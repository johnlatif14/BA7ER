const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'اسم المنتج مطلوب'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'السعر مطلوب'],
    min: [0, 'السعر لا يمكن أن يكون أقل من الصفر']
  },
  images: [{
    type: String,
    required: [true, 'صورة المنتج مطلوبة']
  }],
  sizes: {
    S: { type: Number, default: 0 },
    M: { type: Number, default: 0 },
    L: { type: Number, default: 0 },
    XL: { type: Number, default: 0 },
    OS: { type: Number, default: 0 }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Middleware للتأكد من وجود مقاس واحد على الأقل
productSchema.pre('save', function(next) {
  const hasSize = Object.values(this.sizes).some(qty => qty > 0);
  if (!hasSize) {
    throw new Error('يجب أن يحتوي المنتج على كمية واحدة على الأقل في أي مقاس');
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);