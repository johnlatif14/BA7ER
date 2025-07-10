const { sendEmail } = require("../utils/emailService");

async function sendNotificationEmail(req, res) {
  const { to, subject, message } = req.body;
  try {
    await sendEmail(to, subject, `<p>${message}</p>`);
    res.json({ message: "Email sent successfully" });
  } catch (err) {
    res.status(500).json({ error: "Email sending failed" });
  }
}

module.exports = { sendNotificationEmail };
