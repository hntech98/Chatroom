#!/bin/bash

#######################################################
#                                                     #
#     چت‌روم - اسکریپت نصب خودکار برای اوبونتو       #
#                                                     #
#     Chat Room - Ubuntu Auto Installation Script     #
#                                                     #
#######################################################

set -e

# رنگ‌ها برای نمایش بهتر
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# تنظیمات
APP_NAME="chatroom"
APP_DIR="/opt/chatroom"
APP_PORT=3000
WS_PORT=3003
APP_USER="chatroom"
APP_GROUP="chatroom"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║          🚀 چت‌روم - نصب‌کننده خودکار               ║"
echo "║          Chat Room - Auto Installer                   ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# بررسی اجرا با دسترسی ریشه
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}❌ لطفاً با دستور sudo اجرا کنید${NC}"
    echo "   Please run with sudo"
    exit 1
fi

# تابع برای نمایش وضعیت
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[►]${NC} $1"
}

# مرحله 1: به‌روزرسانی سیستم
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 1: به‌روزرسانی سیستم${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
print_step "به‌روزرسانی لیست پکیج‌ها..."
apt-get update -qq

print_step "ارتقای پکیج‌های نصب شده..."
apt-get upgrade -y -qq

print_status "سیستم به‌روزرسانی شد"

# مرحله 2: نصب وابستگی‌های سیستمی
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 2: نصب وابستگی‌های سیستمی${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

print_step "نصب پکیج‌های ضروری..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    sqlite3 \
    libsqlite3-dev \
    ca-certificates \
    gnupg

print_status "وابستگی‌های سیستمی نصب شدند"

# مرحله 3: نصب Bun.js
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 3: نصب Bun.js Runtime${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v bun &> /dev/null; then
    print_status "Bun.js قبلاً نصب شده است"
else
    print_step "در حال نصب Bun.js..."
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
    
    # اضافه کردن به bashrc برای همه کاربران
    echo 'export BUN_INSTALL="$HOME/.bun"' >> /etc/bash.bashrc
    echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /etc/bash.bashrc
    print_status "Bun.js نصب شد"
fi

# مرحله 4: ایجاد کاربر سیستمی
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 4: ایجاد کاربر سیستمی${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if id "$APP_USER" &>/dev/null; then
    print_status "کاربر $APP_USER قبلاً وجود دارد"
else
    print_step "ایجاد کاربر سیستمی $APP_USER..."
    useradd -r -s /bin/bash -d $APP_DIR $APP_USER
    print_status "کاربر $APP_USER ایجاد شد"
fi

# مرحله 5: کپی پروژه
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 5: نصب فایل‌های برنامه${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# بررسی اینکه آیا فایل‌ها در مسیر فعلی هستند یا باید دانلود شوند
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/package.json" ]; then
    print_step "کپی فایل‌ها از مسیر فعلی..."
    mkdir -p $APP_DIR
    cp -r $SCRIPT_DIR/* $APP_DIR/
else
    print_warning "فایل‌های برنامه یافت نشد!"
    print_step "لطفاً فایل‌های پروژه را در $APP_DIR کپی کنید"
    mkdir -p $APP_DIR
    exit 1
fi

print_status "فایل‌های برنامه کپی شدند"

# مرحله 6: نصب وابستگی‌های Node.js
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 6: نصب وابستگی‌های برنامه${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

cd $APP_DIR

print_step "نصب وابستگی‌های اصلی..."
sudo -u $APP_USER bash -c "source /etc/bash.bashrc; cd $APP_DIR && bun install"

print_step "نصب وابستگی‌های سرویس WebSocket..."
sudo -u $APP_USER bash -c "source /etc/bash.bashrc; cd $APP_DIR/mini-services/chat-service && bun install"

print_status "وابستگی‌ها نصب شدند"

# مرحله 7: راه‌اندازی دیتابیس
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 7: راه‌اندازی دیتابیس${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

print_step "ایجاد دایرکتوری دیتابیس..."
mkdir -p $APP_DIR/db
chmod 755 $APP_DIR/db

print_step "اجرای migrations..."
sudo -u $APP_USER bash -c "source /etc/bash.bashrc; cd $APP_DIR && bun run db:push"

print_status "دیتابیس راه‌اندازی شد"

# مرحله 8: تنظیم مجوزها
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 8: تنظیم مجوزها${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

print_step "تنظیم مالکیت فایل‌ها..."
chown -R $APP_USER:$APP_GROUP $APP_DIR
chmod -R 755 $APP_DIR
chmod -R 777 $APP_DIR/db
mkdir -p $APP_DIR/public/uploads
chmod -R 777 $APP_DIR/public/uploads

print_status "مجوزها تنظیم شدند"

# مرحله 9: ایجاد systemd services
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 9: ایجاد سرویس‌های سیستمی${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# سرویس اصلی Next.js
print_step "ایجاد سرویس Next.js..."
cat > /etc/systemd/system/chatroom.service << 'EOF'
[Unit]
Description=Chat Room - Next.js Application
After=network.target

[Service]
Type=simple
User=chatroom
Group=chatroom
WorkingDirectory=/opt/chatroom
Environment="NODE_ENV=production"
Environment="PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/root/.bun/bin/bun run start
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=chatroom

[Install]
WantedBy=multi-user.target
EOF

# سرویس WebSocket
print_step "ایجاد سرویس WebSocket..."
cat > /etc/systemd/system/chatroom-ws.service << 'EOF'
[Unit]
Description=Chat Room - WebSocket Service
After=network.target

[Service]
Type=simple
User=chatroom
Group=chatroom
WorkingDirectory=/opt/chatroom/mini-services/chat-service
Environment="PATH=/root/.bun/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=/root/.bun/bin/bun run index.ts
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=chatroom-ws

[Install]
WantedBy=multi-user.target
EOF

print_status "سرویس‌های سیستمی ایجاد شدند"

# مرحله 10: پیکربندی فایروال
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 10: پیکربندی فایروال${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if command -v ufw &> /dev/null; then
    print_step "باز کردن پورت‌های مورد نیاز..."
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow $APP_PORT/tcp
    ufw --force enable
    print_status "فایروال پیکربندی شد"
else
    print_warning "ufw یافت نشد - پورت‌های $APP_PORT و $WS_PORT را به صورت دستی باز کنید"
fi

# مرحله 11: فعال‌سازی و شروع سرویس‌ها
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 11: شروع سرویس‌ها${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

print_step "بارگذاری مجدد systemd..."
systemctl daemon-reload

print_step "فعال‌سازی سرویس‌ها..."
systemctl enable chatroom.service
systemctl enable chatroom-ws.service

print_step "شروع سرویس‌ها..."
systemctl start chatroom-ws.service
sleep 2
systemctl start chatroom.service

print_status "سرویس‌ها شروع به کار کردند"

# مرحله 12: دریافت IP
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  مرحله 12: اطلاعات نهایی${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                                                       ║"
echo "║            ✅ نصب با موفقیت انجام شد!                ║"
echo "║            Installation Completed Successfully!       ║"
echo "║                                                       ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  🌐 آدرس دسترسی:                                      ║"
echo "║     http://$SERVER_IP:$APP_PORT"
echo "║                                                       ║"
echo "║  🔑 اطلاعات ورود پیش‌فرض:                             ║"
echo "║     نام کاربری: admin                                 ║"
echo "║     رمز عبور: admin123                                ║"
echo "║                                                       ║"
echo "║  ⚠️  لطفاً پس از ورود رمز عبور را تغییر دهید!         ║"
echo "║                                                       ║"
echo "╠═══════════════════════════════════════════════════════╣"
echo "║                                                       ║"
echo "║  📋 دستورات مدیریت:                                   ║"
echo "║                                                       ║"
echo "║  مشاهده وضعیت:                                        ║"
echo "║    sudo systemctl status chatroom                     ║"
echo "║    sudo systemctl status chatroom-ws                  ║"
echo "║                                                       ║"
echo "║  راه‌اندازی مجدد:                                      ║"
echo "║    sudo systemctl restart chatroom                    ║"
echo "║    sudo systemctl restart chatroom-ws                 ║"
echo "║                                                       ║"
echo "║  مشاهده لاگ‌ها:                                        ║"
echo "║    sudo journalctl -u chatroom -f                     ║"
echo "║    sudo journalctl -u chatroom-ws -f                  ║"
echo "║                                                       ║"
echo "║  توقف سرویس‌ها:                                        ║"
echo "║    sudo systemctl stop chatroom                       ║"
echo "║    sudo systemctl stop chatroom-ws                    ║"
echo "║                                                       ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  💡 نکات مهم:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  • برای SSL/HTTPS می‌توانید از Nginx + Let's Encrypt استفاده کنید"
echo "  • فایل‌های آپلود شده در: $APP_DIR/public/uploads"
echo "  • دیتابیس در: $APP_DIR/db/custom.db"
echo ""
