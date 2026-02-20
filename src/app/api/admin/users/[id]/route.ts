import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT - Update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }
    
    const { username, password, role, isActive } = await request.json()
    
    const updateData: Record<string, unknown> = {}
    
    if (username) updateData.username = username
    if (password) updateData.password = password
    if (role) updateData.role = role
    if (typeof isActive === 'boolean') updateData.isActive = isActive
    
    const user = await db.user.update({
      where: { id },
      data: updateData
    })
    
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        isActive: user.isActive
      }
    })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}

// DELETE - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'دسترسی غیرمجاز' },
        { status: 403 }
      )
    }
    
    // Prevent deleting yourself
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'نمی‌توانید حساب کاربری خود را حذف کنید' },
        { status: 400 }
      )
    }
    
    await db.user.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json(
      { error: 'خطای سرور' },
      { status: 500 }
    )
  }
}
