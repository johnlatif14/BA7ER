const fs = require("fs");
const path = require("path");
const ordersPath = path.join(__dirname, "../data/orders.json");

function createOrder(req, res) {
  const orders = JSON.parse(fs.readFileSync(ordersPath));
  const order = req.body;
  order.id = Date.now().toString();
  order.status = "new";
  orders.push(order);
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
  res.json({ message: "Order received", order });
}

module.exports = { createOrder };
