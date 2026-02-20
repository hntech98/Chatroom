import { cookies } from 'next/headers'
import { db } from './db'
import { randomBytes } from 'crypto'

// Simple session management using cookies
const SESSION_COOKIE_NAME = 'chat_session'
const SESSIONS = new Map<string, { userId: string; expiresAt: Date }>()

export async function createSession(userId: string): Promise<string> {
  const sessionId = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  
  SESSIONS.set(sessionId, { userId, expiresAt })
  
  return sessionId
}

export async function getSession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (!sessionId) {
    return null
  }
  
  const session = SESSIONS.get(sessionId)
  
  if (!session) {
    return null
  }
  
  if (session.expiresAt < new Date()) {
    SESSIONS.delete(sessionId)
    return null
  }
  
  const user = await db.user.findUnique({
    where: { id: session.userId }
  })
  
  if (!user || !user.isActive) {
    return null
  }
  
  return {
    sessionId,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      avatar: user.avatar
    }
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value
  
  if (sessionId) {
    SESSIONS.delete(sessionId)
  }
}

export { SESSION_COOKIE_NAME }
