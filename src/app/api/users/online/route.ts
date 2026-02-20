import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

// GET - Get online users count (for display)
export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 401 }
      )
    }
    
    // This would be handled by WebSocket, but we can return session info
    return NextResponse.json({
      user: session.user
    })
  } catch (error) {
    console.error('Get online users error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}
