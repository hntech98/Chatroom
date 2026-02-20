# 🚀 راهنمای نصب روی سرور اوبونتو

## روش 1: نصب خودکار (پیشنهادی)

### مرحله 1: فایل‌ها را به سرور منتقل کنید

```bash
# با استفاده از scp
scp -r /path/to/chatroom user@your-server:/tmp/chatroom

# یا با rsync
rsync -avz /path/to/chatroom user@your-server:/tmp/
```

### مرحله 2: اسکریپت نصب را اجرا کنید

```bash
cd /tmp/chatroom
chmod +x install-ubuntu.sh
sudo ./install-ubuntu.sh
```

### مرحله 3: تمام! 🎉

سایت شما آماده است:
- **آدرس**: `http://YOUR_SERVER_IP:3000`
- **نام کاربری**: `admin`
- **رمز عبور**: `admin123`

---

## روش 2: نصب دستی (گام به گام)

### 1. به‌روزرسانی سیستم

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. نصب وابستگی‌ها

```bash
sudo apt install -y curl wget git build-essential python3 sqlite3
```

### 3. نصب Bun.js

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 4. کپی پروژه

```bash
sudo mkdir -p /opt/chatroom
sudo chown $USER:$USER /opt/chatroom
# فایل‌های پروژه را در /opt/chatroom کپی کنید
```

### 5. نصب وابستگی‌ها

```bash
cd /opt/chatroom
bun install
cd mini-services/chat-service
bun install
cd ../..
```

### 6. راه‌اندازی دیتابیس

```bash
bun run db:push
```

### 7. ایجاد سرویس Systemd

```bash
sudo nano /etc/systemd/system/chatroom.service
```

محتوای زیر را قرار دهید:

```ini
[Unit]
Description=Chat Room Application
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chatroom
Environment="NODE_ENV=production"
ExecStart=/root/.bun/bin/bun run start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

سرویس WebSocket:

```bash
sudo nano /etc/systemd/system/chatroom-ws.service
```

```ini
[Unit]
Description=Chat Room WebSocket Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/chatroom/mini-services/chat-service
ExecStart=/root/.bun/bin/bun run index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 8. شروع سرویس‌ها

```bash
sudo systemctl daemon-reload
sudo systemctl enable chatroom chatroom-ws
sudo systemctl start chatroom-ws
sudo systemctl start chatroom
```

---

## روش 3: نصب با Docker

### Dockerfile

```dockerfile
FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run db:push

EXPOSE 3000 3003

CMD ["sh", "-c", "bun run start & cd mini-services/chat-service && bun run index.ts"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  chatroom:
    build: .
    ports:
      - "3000:3000"
      - "3003:3003"
    volumes:
      - ./db:/app/db
      - ./public/uploads:/app/public/uploads
    restart: always
```

### اجرا

```bash
docker-compose up -d
```

---

## 🔒 تنظیم SSL با Nginx (اختیاری)

### 1. نصب Nginx

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. ایجاد کانفیگ Nginx

```bash
sudo nano /etc/nginx/sites-available/chatroom
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /socket.io/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 3. فعال‌سازی سایت

```bash
sudo ln -s /etc/nginx/sites-available/chatroom /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. دریافت SSL

```bash
sudo certbot --nginx -d your-domain.com
```

---

## 📋 دستورات مدیریت

| عملیات | دستور |
|--------|-------|
| مشاهده وضعیت | `sudo systemctl status chatroom` |
| راه‌اندازی مجدد | `sudo systemctl restart chatroom` |
| توقف سرویس | `sudo systemctl stop chatroom` |
| مشاهده لاگ | `sudo journalctl -u chatroom -f` |
| وضعیت WebSocket | `sudo systemctl status chatroom-ws` |

---

## 🔧 عیب‌یابی

### مشکل: سرویس اجرا نمی‌شود

```bash
# بررسی لاگ‌ها
sudo journalctl -u chatroom -n 50

# بررسی پورت
sudo netstat -tlnp | grep 3000
```

### مشکل: WebSocket وصل نمی‌شود

```bash
# بررسی سرویس WebSocket
sudo systemctl status chatroom-ws

# بررسی پورت 3003
sudo netstat -tlnp | grep 3003
```

### مشکل: دیتابیس خطا می‌دهد

```bash
# بررسی مجوزها
sudo chmod -R 777 /opt/chatroom/db

# بازسازی دیتابیس
cd /opt/chatroom
bun run db:push
```

---

## 📱 پورت‌های مورد نیاز

| پورت | کاربرد |
|------|--------|
| 3000 | برنامه اصلی |
| 3003 | WebSocket |
| 80 | HTTP (Nginx) |
| 443 | HTTPS (Nginx) |

---

## ⚠️ نکات امنیتی

1. **رمز عبور پیش‌فرض را تغییر دهید**
2. **فایروال را فعال کنید**: `sudo ufw enable`
3. **SSL را نصب کنید**
4. **به‌روزرسانی‌های منظم انجام دهید**: `sudo apt update && sudo apt upgrade`
