import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET - Initialize default admin user (only if no users exist)
export async function GET() {
  try {
    const userCount = await db.user.count()
    
    if (userCount > 0) {
      return NextResponse.json({ 
        message: 'سیستم قبلاً راه‌اندازی شده است',
        initialized: true 
      })
    }
    
    // Create default admin user
    const admin = await db.user.create({
      data: {
        username: 'admin',
        password: 'admin123',
        role: 'ADMIN'
      }
    })
    
    return NextResponse.json({
      message: 'کاربر ادمین پیش‌فرض ایجاد شد',
      initialized: true,
      credentials: {
        username: 'admin',
        password: 'admin123'
      },
      warning: 'لطفاً پس از ورود اولیه، رمز عبور را تغییر دهید!'
    })
  } catch (error) {
    console.error('Init error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}
