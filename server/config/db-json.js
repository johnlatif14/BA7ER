const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '../db.json');

// تأكد من وجود الملف عند التشغيل
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify({
    products: [],
    orders: [],
    users: []
  }, null, 2));
}

// قراءة قاعدة البيانات
const readDB = () => {
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('خطأ في قراءة الملف:', err);
    return { products: [], orders: [], users: [] };
  }
};

// حفظ التغييرات
const saveDB = (data) => {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('خطأ في حفظ الملف:', err);
  }
};

// عمليات المنتجات
const productOperations = {
  getAll: () => readDB().products,
  
  getById: (id) => {
    const products = readDB().products;
    return products.find(p => p.id === id);
  },
  
  create: (product) => {
    const db = readDB();
    const newProduct = {
      id: Date.now().toString(),
      ...product,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.products.push(newProduct);
    saveDB(db);
    return newProduct;
  },
  
  update: (id, updates) => {
    const db = readDB();
    const index = db.products.findIndex(p => p.id === id);
    if (index !== -1) {
      db.products[index] = {
        ...db.products[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      saveDB(db);
      return db.products[index];
    }
    return null;
  },
  
  delete: (id) => {
    const db = readDB();
    const index = db.products.findIndex(p => p.id === id);
    if (index !== -1) {
      const deleted = db.products.splice(index, 1);
      saveDB(db);
      return deleted[0];
    }
    return null;
  },
  
  getByCategory: (category) => {
    const products = readDB().products;
    return products.filter(p => p.category === category);
  }
};

// عمليات المستخدمين
const userOperations = {
  // ... (نفس هيكل productOperations مع تعديلات حسب حاجة المستخدمين)
};

// عمليات الطلبات
const orderOperations = {
  // ... (نفس هيكل productOperations مع تعديلات حسب حاجة الطلبات)
};

module.exports = {
  products: productOperations,
  users: userOperations,
  orders: orderOperations,
  
  // دالة مساعدة لإنشاء مستخدم مسؤول افتراضي
  initAdminUser: async () => {
    const db = readDB();
    const adminExists = db.users.some(u => u.isAdmin);
    
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      db.users.push({
        id: 'admin-001',
        name: 'المشرف الرئيسي',
        email: 'admin@example.com',
        password: hashedPassword,
        isAdmin: true,
        createdAt: new Date().toISOString()
      });
      saveDB(db);
      console.log('تم إنشاء مستخدم مسؤول افتراضي');
    }
  }
};