#!/bin/bash

#######################################################
#                                                     #
#       چت‌روم - نصب سریع یک خطی                      #
#       Chat Room - One-Line Quick Install            #
#                                                     #
#######################################################

# روش 1: اگر فایل‌ها آماده هستند
# کپی کنید و در سرور اجرا کنید

echo "🚀 در حال نصب چت‌روم..."

# به‌روزرسانی
apt-get update -qq && apt-get upgrade -y -qq

# نصب وابستگی‌ها
apt-get install -y -qq curl wget git build-essential python3 sqlite3

# نصب Bun
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# ایجاد دایرکتوری
mkdir -p /opt/chatroom
cd /opt/chatroom

# نصب وابستگی‌ها
bun install
cd mini-services/chat-service && bun install && cd ../..

# راه‌اندازی دیتابیس
bun run db:push

# ایجاد سرویس‌ها
cat > /etc/systemd/system/chatroom.service << 'EOF'
[Unit]
Description=Chat Room Application
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/chatroom
ExecStart=/root/.bun/bin/bun run start
Restart=always

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/chatroom-ws.service << 'EOF'
[Unit]
Description=Chat Room WebSocket
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/chatroom/mini-services/chat-service
ExecStart=/root/.bun/bin/bun run index.ts
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# شروع سرویس‌ها
systemctl daemon-reload
systemctl enable chatroom chatroom-ws
systemctl start chatroom-ws
systemctl start chatroom

echo "✅ نصب کامل شد!"
echo "🌐 آدرس: http://$(curl -s ifconfig.me || hostname -I | awk '{print $1}'):3000"
echo "🔑 ورود: admin / admin123"
