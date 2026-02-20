import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Get chat messages (authenticated users only)
export async function GET() {
  try {
    const session = await getSession()
    
    if (!session) {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 401 }
      )
    }
    
    const messages = await db.message.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true
          }
        },
        file: true
      }
    })
    
    // Reverse to get chronological order
    const reversedMessages = messages.reverse()
    
    return NextResponse.json({ messages: reversedMessages })
  } catch (error) {
    console.error('Get messages error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}
