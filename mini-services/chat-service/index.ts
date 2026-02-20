import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface ConnectedUser {
  id: string
  userId: string
  username: string
  role: 'ADMIN' | 'USER'
  avatar?: string
}

interface ChatMessage {
  id: string
  content: string
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM'
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
  timestamp: Date
}

// Store connected users
const connectedUsers = new Map<string, ConnectedUser>()

const generateId = () => Math.random().toString(36).substr(2, 9)

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`)

  // User authentication/join
  socket.on('auth', (data: { userId: string; username: string; role: 'ADMIN' | 'USER'; avatar?: string }) => {
    const { userId, username, role, avatar } = data
    
    // Check if user is already connected from another tab
    const existingUser = Array.from(connectedUsers.values()).find(u => u.userId === userId)
    if (existingUser) {
      // Disconnect the old connection
      const oldSocket = io.sockets.sockets.get(existingUser.id)
      if (oldSocket) {
        oldSocket.disconnect(true)
      }
      connectedUsers.delete(existingUser.id)
    }

    const user: ConnectedUser = {
      id: socket.id,
      userId,
      username,
      role,
      avatar
    }
    
    connectedUsers.set(socket.id, user)
    
    // Send current online users to new user
    const usersList = Array.from(connectedUsers.values())
    socket.emit('users-list', { users: usersList })
    
    // Broadcast to all users that a new user joined
    socket.broadcast.emit('user-joined', { user: { ...user, id: userId } })
    
    console.log(`${username} (${role}) joined. Online users: ${connectedUsers.size}`)
  })

  // New message
  socket.on('message', (data: { content: string; type: 'TEXT' | 'IMAGE' | 'FILE'; userId: string; file?: ChatMessage['file'] }) => {
    const user = connectedUsers.get(socket.id)
    
    if (user && user.userId === data.userId) {
      const message: ChatMessage = {
        id: generateId(),
        content: data.content,
        type: data.type,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        file: data.file,
        timestamp: new Date()
      }
      
      io.emit('message', message)
      console.log(`Message from ${user.username}: ${data.content.substring(0, 50)}...`)
    }
  })

  // Typing indicator
  socket.on('typing', (data: { userId: string; isTyping: boolean }) => {
    const user = connectedUsers.get(socket.id)
    if (user && user.userId === data.userId) {
      socket.broadcast.emit('user-typing', { 
        userId: user.userId, 
        username: user.username,
        isTyping: data.isTyping 
      })
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id)
    
    if (user) {
      connectedUsers.delete(socket.id)
      
      // Broadcast to all users that a user left
      io.emit('user-left', { 
        user: { 
          id: user.userId, 
          username: user.username,
          role: user.role
        } 
      })
      
      console.log(`${user.username} left. Online users: ${connectedUsers.size}`)
    } else {
      console.log(`Unknown user disconnected: ${socket.id}`)
    }
  })

  socket.on('error', (error) => {
    console.error(`Socket error (${socket.id}):`, error)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`Chat WebSocket server running on port ${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, shutting down server...')
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, shutting down server...')
  httpServer.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})
