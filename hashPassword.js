const bcrypt = require('bcrypt');

const plainPassword = 'Fahd'; // الباسورد الذي تريد تشفيره
const saltRounds = 10; // عدد جولات التشفير (10 هو رقم آمن)

bcrypt.hash(plainPassword, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Hashed Password:', hash);
  
  // النسخ الاحتياطي للباسورد المشفر (اختياري)
  // fs.writeFileSync('hashed-password.txt', hash);
});