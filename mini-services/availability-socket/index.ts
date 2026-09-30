import { createServer } from 'http'
import { Server } from 'socket.io'

const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

// Track which equipment each client is watching
const watchers = new Map<string, Set<string>>() // equipmentId -> Set<socketId>

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  socket.on('watch:equipment', (equipmentId: string) => {
    socket.join(`equipment:${equipmentId}`)
    if (!watchers.has(equipmentId)) watchers.set(equipmentId, new Set())
    watchers.get(equipmentId)!.add(socket.id)
    console.log(`[socket] ${socket.id} watching equipment:${equipmentId}`)
  })

  socket.on('unwatch:equipment', (equipmentId: string) => {
    socket.leave(`equipment:${equipmentId}`)
    watchers.get(equipmentId)?.delete(socket.id)
  })

  // REST endpoint to broadcast availability change (called from Next.js API)
  socket.on('availability:changed', (data: { equipmentId: string; type: string; startDate: string; endDate: string }) => {
    io.to(`equipment:${data.equipmentId}`).emit('availability:updated', data)
    console.log(`[socket] broadcast availability:updated to equipment:${data.equipmentId}`)
  })

  // Booking chat message
  socket.on('join:booking', (bookingId: string) => {
    socket.join(`booking:${bookingId}`)
  })

  socket.on('booking:message', (data: { bookingId: string; message: any }) => {
    socket.to(`booking:${data.bookingId}`).emit('booking:message', data.message)
  })

  socket.on('disconnect', () => {
    watchers.forEach((set, eqId) => set.delete(socket.id))
    console.log(`[socket] disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[socket] availability socket.io running on port ${PORT}`)
})
