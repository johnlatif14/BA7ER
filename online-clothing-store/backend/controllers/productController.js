const fs = require("fs");
const path = require("path");
const productsPath = path.join(__dirname, "../data/products.json");

function getProducts(req, res) {
  const data = JSON.parse(fs.readFileSync(productsPath));
  res.json(data);
}

function addProduct(req, res) {
  const products = JSON.parse(fs.readFileSync(productsPath));
  const newProduct = req.body;
  newProduct.id = Date.now().toString();
  products.push(newProduct);
  fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
  res.json({ message: "Product added", product: newProduct });
}

module.exports = { getProducts, addProduct };
