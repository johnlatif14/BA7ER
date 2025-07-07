const db = require('../config/db-json');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  const user = await db.findUserByEmail(email);
  
  if (user && (await bcrypt.compare(password, user.password))) {
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
      token: generateToken(user.id)
    });
  } else {
    res.status(401);
    throw new Error('بريد إلكتروني أو كلمة مرور غير صحيحة');
  }
});

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  
  const userExists = await db.findUserByEmail(email);
  if (userExists) {
    res.status(400);
    throw new Error('المستخدم موجود بالفعل');
  }
  
  const user = await db.createUser({ name, email, password });
  
  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
    token: generateToken(user.id)
  });
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

module.exports = { login, register };