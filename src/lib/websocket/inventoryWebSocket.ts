import { Server as HTTPServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import RealTimeInventoryService, { InventoryUpdateEvent } from '@/services/realTimeInventoryService'
import InventoryDiscrepancyService from '@/services/inventoryDiscrepancyService'

export interface InventorySocketServer {
  io: SocketIOServer
  start: () => void
  stop: () => void
}

export interface ClientSubscription {
  socketId: string
  warehouseIds?: number[]
  titleIds?: number[]
  alertTypes?: string[]
  userId?: string
}

class InventoryWebSocketManager {
  private io: SocketIOServer | null = null
  private subscriptions: Map<string, ClientSubscription> = new Map()
  private realTimeService: RealTimeInventoryService

  constructor() {
    this.realTimeService = RealTimeInventoryService.getInstance()
  }

  initialize(httpServer: HTTPServer): InventorySocketServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
        methods: ['GET', 'POST']
      },
      path: '/api/socket/inventory'
    })

    this.setupEventHandlers()

    return {
      io: this.io,
      start: this.start.bind(this),
      stop: this.stop.bind(this)
    }
  }

  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)

      // Handle client subscription to inventory updates
      socket.on('subscribe-inventory', (subscription: Omit<ClientSubscription, 'socketId'>) => {
        const clientSubscription: ClientSubscription = {
          ...subscription,
          socketId: socket.id
        }

        this.subscriptions.set(socket.id, clientSubscription)

        // Subscribe to real-time service
        this.realTimeService.subscribe({
          subscriberId: socket.id,
          warehouseIds: subscription.warehouseIds,
          titleIds: subscription.titleIds,
          callback: (event: InventoryUpdateEvent) => {
            this.handleInventoryUpdate(socket.id, event)
          }
        })

        socket.emit('subscription-confirmed', {
          message: 'Successfully subscribed to inventory updates',
          subscription: clientSubscription
        })

        console.log(`Client ${socket.id} subscribed to inventory updates:`, clientSubscription)
      })

      // Handle client unsubscription
      socket.on('unsubscribe-inventory', () => {
        this.realTimeService.unsubscribe(socket.id)
        this.subscriptions.delete(socket.id)
        socket.emit('unsubscription-confirmed', {
          message: 'Successfully unsubscribed from inventory updates'
        })
        console.log(`Client ${socket.id} unsubscribed from inventory updates`)
      })

      // Handle manual inventory update requests
      socket.on('update-inventory', async (data: {
        inventoryId: number
        stockChange: number
        reason: string
        userId?: string
      }) => {
        try {
          const result = await RealTimeInventoryService.updateInventoryLevel(
            data.inventoryId,
            data.stockChange,
            data.reason,
            data.userId
          )

          socket.emit('inventory-update-success', {
            message: 'Inventory updated successfully',
            data: result
          })
        } catch (error) {
          socket.emit('inventory-update-error', {
            error: error instanceof Error ? error.message : 'Failed to update inventory'
          })
        }
      })

      // Handle transfer requests
      socket.on('execute-transfer', async (data: {
        sourceWarehouseId: number
        destinationWarehouseId: number
        titleId: number
        quantity: number
        reason: string
        userId?: string
      }) => {
        try {
          const result = await RealTimeInventoryService.synchronizeTransfer(
            data.sourceWarehouseId,
            data.destinationWarehouseId,
            data.titleId,
            data.quantity,
            data.reason,
            data.userId
          )

          socket.emit('transfer-success', {
            message: 'Transfer completed successfully',
            data: result
          })
        } catch (error) {
          socket.emit('transfer-error', {
            error: error instanceof Error ? error.message : 'Failed to execute transfer'
          })
        }
      })

      // Handle discrepancy scan requests
      socket.on('scan-discrepancies', async (data: { warehouseId?: number }) => {
        try {
          const result = await InventoryDiscrepancyService.performComprehensiveDiscrepancyScan(
            data.warehouseId
          )

          socket.emit('discrepancy-scan-complete', {
            message: 'Discrepancy scan completed',
            data: result
          })
        } catch (error) {
          socket.emit('discrepancy-scan-error', {
            error: error instanceof Error ? error.message : 'Failed to perform discrepancy scan'
          })
        }
      })

      // Handle client disconnection
      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
        this.realTimeService.unsubscribe(socket.id)
        this.subscriptions.delete(socket.id)
      })

      // Handle ping/pong for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() })
      })
    })

    // Listen for real-time inventory events and broadcast to relevant clients
    this.realTimeService.on('inventory-update', (event: InventoryUpdateEvent) => {
      this.broadcastInventoryUpdate(event)
    })
  }

  private handleInventoryUpdate(socketId: string, event: InventoryUpdateEvent): void {
    if (!this.io) return

    const socket = this.io.sockets.sockets.get(socketId)
    if (!socket) return

    socket.emit('inventory-update', {
      type: 'real-time-update',
      event,
      timestamp: new Date().toISOString()
    })
  }

  private broadcastInventoryUpdate(event: InventoryUpdateEvent): void {
    if (!this.io) return

    // Broadcast to all connected clients (they can filter based on their subscriptions)
    this.io.emit('inventory-broadcast', {
      type: 'inventory-change',
      event,
      timestamp: new Date().toISOString()
    })
  }

  private start(): void {
    console.log('🚀 Inventory WebSocket server started')

    // Initialize discrepancy monitoring
    InventoryDiscrepancyService.initializeMonitoring()
      .then(() => {
        console.log('📊 Inventory discrepancy monitoring initialized')
      })
      .catch((error) => {
        console.error('❌ Failed to initialize discrepancy monitoring:', error)
      })
  }

  private stop(): void {
    if (this.io) {
      this.io.close()
      console.log('🛑 Inventory WebSocket server stopped')
    }
  }

  // Get active connections info
  getConnectionInfo(): {
    totalConnections: number
    activeSubscriptions: number
    subscriptionDetails: ClientSubscription[]
  } {
    return {
      totalConnections: this.io?.sockets.sockets.size || 0,
      activeSubscriptions: this.subscriptions.size,
      subscriptionDetails: Array.from(this.subscriptions.values())
    }
  }
}

// Export singleton instance
export const inventoryWebSocketManager = new InventoryWebSocketManager()

// Export types
export type { ClientSubscription, InventoryUpdateEvent }