# استخدم بيئة node الرسمية
FROM node:18

# أنشئ مجلد التطبيق
WORKDIR /app

# انسخ ملفات الباك فقط
COPY backend/ ./backend/

# ادخل مجلد الباك
WORKDIR /app/backend

# ثبت الاعتمادات
RUN npm install

# شغّل السيرفر
CMD ["npm", "start"]
