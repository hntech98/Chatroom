import { NextResponse } from 'next/server'
import { destroySession, SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  try {
    await destroySession()
    
    const response = NextResponse.json({ success: true })
    
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    })
    
    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}
