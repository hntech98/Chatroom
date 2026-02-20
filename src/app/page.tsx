'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { 
  Send, 
  LogOut, 
  Users, 
  Settings, 
  Paperclip, 
  Image, 
  File, 
  Trash2, 
  UserPlus,
  Shield,
  MessageCircle,
  Eye,
  EyeOff,
  Menu,
  X,
  Check,
  XCircle,
  Loader2
} from 'lucide-react'

// Types
type UserRole = 'ADMIN' | 'USER'
type MessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'

interface User {
  id: string
  username: string
  role: UserRole
  avatar?: string
  isActive?: boolean
  createdAt?: string
}

interface ChatMessage {
  id: string
  content: string
  type: MessageType
  userId: string
  username: string
  avatar?: string
  file?: {
    id: string
    name: string
    originalName: string
    mimeType: string
    size: number
    path: string
  }
  timestamp: Date | string
}

interface OnlineUser {
  id: string
  username: string
  role: UserRole
  avatar?: string
}

// Main Component
export default function ChatRoom() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Login state
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [typingUsers, setTypingUsers] = useState<OnlineUser[]>([])
  const [showSidebar, setShowSidebar] = useState(true)
  
  // Admin state
  const [users, setUsers] = useState<User[]>([])
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER')
  
  // File upload state
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Refs
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Check session on mount
  useEffect(() => {
    checkSession()
  }, [])
  
  // Initialize socket when authenticated
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      initSocket()
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [isAuthenticated, currentUser])
  
  // Fetch messages when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchMessages()
    }
  }, [isAuthenticated])
  
  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  // Fetch users for admin
  useEffect(() => {
    if (isAuthenticated && currentUser?.role === 'ADMIN') {
      fetchUsers()
    }
  }, [isAuthenticated, currentUser])
  
  const checkSession = async () => {
    try {
      // First try to initialize the system
      await fetch('/api/init')
      
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      
      if (data.authenticated && data.user) {
        setCurrentUser(data.user)
        setIsAuthenticated(true)
      }
    } catch (error) {
      console.error('Session check error:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const initSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000
    })
    
    socketRef.current = socket
    
    socket.on('connect', () => {
      setIsConnected(true)
      // Authenticate with user info
      if (currentUser) {
        socket.emit('auth', {
          userId: currentUser.id,
          username: currentUser.username,
          role: currentUser.role,
          avatar: currentUser.avatar
        })
      }
    })
    
    socket.on('disconnect', () => {
      setIsConnected(false)
    })
    
    socket.on('message', (msg: ChatMessage) => {
      setMessages(prev => [...prev, msg])
    })
    
    socket.on('users-list', (data: { users: OnlineUser[] }) => {
      setOnlineUsers(data.users)
    })
    
    socket.on('user-joined', (data: { user: OnlineUser }) => {
      setOnlineUsers(prev => {
        if (!prev.find(u => u.id === data.user.id)) {
          return [...prev, data.user]
        }
        return prev
      })
    })
    
    socket.on('user-left', (data: { user: OnlineUser }) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== data.user.id))
      setTypingUsers(prev => prev.filter(u => u.id !== data.user.id))
    })
    
    socket.on('user-typing', (data: { userId: string; username: string; isTyping: boolean }) => {
      if (data.isTyping) {
        setTypingUsers(prev => {
          if (!prev.find(u => u.id === data.userId)) {
            return [...prev, { id: data.userId, username: data.username, role: 'USER' }]
          }
          return prev
        })
      } else {
        setTypingUsers(prev => prev.filter(u => u.id !== data.userId))
      }
    })
  }
  
  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/messages')
      const data = await res.json()
      if (data.messages) {
        setMessages(data.messages)
      }
    } catch (error) {
      console.error('Fetch messages error:', error)
    }
  }
  
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()
      if (data.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Fetch users error:', error)
    }
  }
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsLoggingIn(true)
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      })
      
      const data = await res.json()
      
      if (data.success && data.user) {
        setCurrentUser(data.user)
        setIsAuthenticated(true)
        setLoginUsername('')
        setLoginPassword('')
      } else {
        setLoginError(data.error || 'خطا در ورود')
      }
    } catch (error) {
      setLoginError('خطا در ارتباط با سرور')
    } finally {
      setIsLoggingIn(false)
    }
  }
  
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      setIsAuthenticated(false)
      setCurrentUser(null)
      setMessages([])
      setOnlineUsers([])
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
  
  const sendMessage = () => {
    if (!inputMessage.trim() || !socketRef.current || !currentUser || !isConnected) return
    
    socketRef.current.emit('message', {
      content: inputMessage.trim(),
      type: 'TEXT',
      userId: currentUser.id
    })
    
    setInputMessage('')
    
    // Clear typing indicator
    socketRef.current.emit('typing', { userId: currentUser.id, isTyping: false })
  }
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  const handleTyping = () => {
    if (!socketRef.current || !currentUser) return
    
    socketRef.current.emit('typing', { userId: currentUser.id, isTyping: true })
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { userId: currentUser.id, isTyping: false })
    }, 2000)
  }
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return
    
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const data = await res.json()
      
      if (data.success && data.file) {
        const isImage = data.file.mimeType.startsWith('image/')
        
        socketRef.current?.emit('message', {
          content: isImage ? `📷 ${data.file.originalName}` : `📎 ${data.file.originalName}`,
          type: isImage ? 'IMAGE' : 'FILE',
          userId: currentUser.id,
          file: data.file
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }
  
  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: newUsername.trim(), 
          password: newPassword,
          role: newRole 
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setUsers(prev => [data.user, ...prev])
        setNewUsername('')
        setNewPassword('')
        setNewRole('USER')
        setShowAddUserDialog(false)
      }
    } catch (error) {
      console.error('Add user error:', error)
    }
  }
  
  const handleDeleteUser = async (userId: string) => {
    if (!confirm('آیا از حذف این کاربر مطمئن هستید؟')) return
    
    try {
      await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (error) {
      console.error('Delete user error:', error)
    }
  }
  
  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive })
      })
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isActive: !isActive } : u
      ))
    } catch (error) {
      console.error('Toggle user status error:', error)
    }
  }
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
  
  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white text-lg">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }
  
  // Login page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <Card className="w-full max-w-md bg-white/10 backdrop-blur-lg border-white/20 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <MessageCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold text-white">
              چت‌روم
            </CardTitle>
            <p className="text-slate-400 text-sm">به چت‌روم خوش آمدید</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">نام کاربری</Label>
                <Input
                  id="username"
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="نام کاربری خود را وارد کنید"
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-400"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">رمز عبور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="رمز عبور خود را وارد کنید"
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus:border-emerald-400 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute left-1 top-1 h-8 w-8 p-0 text-slate-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              {loginError && (
                <div className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg">
                  {loginError}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-medium"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    در حال ورود...
                  </>
                ) : (
                  'ورود'
                )}
              </Button>
            </form>
            
            <div className="mt-6 pt-4 border-t border-white/10">
              <p className="text-slate-500 text-xs text-center">
                💡 برای اولین بار از نام کاربری <span className="text-emerald-400">admin</span> و رمز عبور <span className="text-emerald-400">admin123</span> استفاده کنید
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }
  
  // Chat page
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              {showSidebar ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">چت‌روم</h1>
              <p className="text-xs text-slate-400">
                {onlineUsers.length} نفر آنلاین
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Connection status */}
            <Badge 
              variant="outline" 
              className={`hidden sm:flex gap-1 ${isConnected ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {isConnected ? 'متصل' : 'قطع'}
            </Badge>
            
            {/* User info */}
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={currentUser?.avatar} />
                <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-sm">
                  {currentUser?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">{currentUser?.username}</p>
                <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-400">
                  {currentUser?.role === 'ADMIN' ? 'مدیر' : 'کاربر'}
                </Badge>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* Sidebar */}
        <aside className={`
          fixed lg:relative inset-y-0 right-0 z-40 w-80 bg-slate-900/95 lg:bg-transparent
          transform transition-transform duration-300 lg:transform-none
          ${showSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          pt-16 lg:pt-0
        `}>
          <Tabs defaultValue="users" className="h-full flex flex-col p-4">
            <TabsList className="grid grid-cols-2 bg-white/5">
              <TabsTrigger value="users" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                <Users className="w-4 h-4 ml-2" />
                کاربران
              </TabsTrigger>
              {currentUser?.role === 'ADMIN' && (
                <TabsTrigger value="admin" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400">
                  <Settings className="w-4 h-4 ml-2" />
                  مدیریت
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="users" className="flex-1 mt-4 overflow-hidden">
              <Card className="bg-white/5 border-white/10 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center justify-between">
                    <span>کاربران آنلاین</span>
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                      {onlineUsers.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-280px)]">
                    <div className="space-y-1 p-4 pt-0">
                      {onlineUsers.map(user => (
                        <div 
                          key={user.id} 
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <div className="relative">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-xs">
                                {user.username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-slate-900 rounded-full" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{user.username}</p>
                            <p className="text-xs text-slate-500">
                              {user.role === 'ADMIN' ? 'مدیر' : 'کاربر'}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {onlineUsers.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">
                          کاربری آنلاین نیست
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            
            {currentUser?.role === 'ADMIN' && (
              <TabsContent value="admin" className="flex-1 mt-4 overflow-hidden">
                <Card className="bg-white/5 border-white/10 h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-sm">مدیریت کاربران</CardTitle>
                      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                            <UserPlus className="w-4 h-4 ml-1" />
                           新增
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-white/10">
                          <DialogHeader>
                            <DialogTitle className="text-white">افزودن کاربر جدید</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label className="text-slate-300">نام کاربری</Label>
                              <Input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">رمز عبور</Label>
                              <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-slate-300">نقش</Label>
                              <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as 'USER' | 'ADMIN')}
                                className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2"
                              >
                                <option value="USER">کاربر عادی</option>
                                <option value="ADMIN">مدیر</option>
                              </select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
                              انصراف
                            </Button>
                            <Button onClick={handleAddUser} className="bg-emerald-500 hover:bg-emerald-600">
                              ایجاد کاربر
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[calc(100vh-320px)]">
                      <div className="space-y-1 p-4 pt-0">
                        {users.map(user => (
                          <div 
                            key={user.id} 
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
                          >
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="bg-gradient-to-br from-slate-600 to-slate-700 text-white text-xs">
                                {user.username?.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">{user.username}</p>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${user.role === 'ADMIN' ? 'border-emerald-500 text-emerald-400' : 'border-slate-500 text-slate-400'}`}
                                >
                                  {user.role === 'ADMIN' ? 'مدیر' : 'کاربر'}
                                </Badge>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${user.isActive ? 'border-emerald-500 text-emerald-400' : 'border-red-500 text-red-400'}`}
                                >
                                  {user.isActive ? 'فعال' : 'غیرفعال'}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-400 hover:text-white"
                                onClick={() => handleToggleUserStatus(user.id, user.isActive || false)}
                              >
                                {user.isActive ? <XCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                              </Button>
                              {user.id !== currentUser?.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-400 hover:text-red-300"
                                  onClick={() => handleDeleteUser(user.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </aside>
        
        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map((msg, index) => {
                const isCurrentUser = msg.userId === currentUser?.id
                const isSystem = msg.type === 'SYSTEM'
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full">
                        {msg.content}
                      </span>
                    </div>
                  )
                }
                
                return (
                  <div 
                    key={msg.id}
                    className={`flex gap-2 ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={msg.avatar} />
                      <AvatarFallback className={`text-xs ${isCurrentUser ? 'bg-emerald-500' : 'bg-slate-600'} text-white`}>
                        {msg.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${isCurrentUser ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {msg.username}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <div className={`
                        rounded-2xl px-4 py-2 
                        ${isCurrentUser 
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-tr-sm' 
                          : 'bg-white/10 text-white rounded-tl-sm'
                        }
                      `}>
                        {msg.type === 'IMAGE' && msg.file ? (
                          <div>
                            <img 
                              src={msg.file.path} 
                              alt={msg.file.originalName}
                              className="max-w-full rounded-lg mb-2"
                            />
                            <p className="text-sm opacity-80">{msg.file.originalName}</p>
                          </div>
                        ) : msg.type === 'FILE' && msg.file ? (
                          <a 
                            href={msg.file.path}
                            download={msg.file.originalName}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                          >
                            <File className="w-5 h-5" />
                            <div>
                              <p className="text-sm">{msg.file.originalName}</p>
                              <p className="text-xs opacity-60">{formatFileSize(msg.file.size)}</p>
                            </div>
                          </a>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{typingUsers.map(u => u.username).join('، ')} در حال نوشتن...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          {/* Input Area */}
          <div className="p-4 bg-white/5 backdrop-blur-lg border-t border-white/10">
            <div className="flex items-end gap-2">
              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Paperclip className="w-5 h-5" />
                )}
              </Button>
              
              {/* Message input */}
              <div className="flex-1 relative">
                <textarea
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value)
                    handleTyping()
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="پیام خود را بنویسید..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 resize-none"
                  rows={1}
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
              </div>
              
              {/* Send button */}
              <Button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || !isConnected}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white flex-shrink-0"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
