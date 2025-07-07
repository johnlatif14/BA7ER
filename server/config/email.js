const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1) Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  // 2) Define email options
  const mailOptions = {
    from: 'E-Commerce App <admin@ecommerce.com>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    // html: options.html
  };

  // 3) Send email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;