import { PrismaClient, MovementType } from '@prisma/client'

export interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  isActive: boolean
  events: WebhookEventType[]
  retryPolicy: {
    maxRetries: number
    retryDelay: number
    backoffMultiplier: number
  }
  metadata?: Record<string, any>
}

export type WebhookEventType =
  | 'movement.created'
  | 'movement.updated'
  | 'movement.deleted'
  | 'movement.approved'
  | 'movement.rejected'
  | 'inventory.updated'
  | 'batch.completed'
  | 'batch.failed'

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: Date
  data: MovementWebhookData | InventoryWebhookData | BatchWebhookData
  metadata?: Record<string, any>
}

export interface MovementWebhookData {
  movementId: number
  externalId?: string
  titleId: number
  titleISBN: string
  titleName: string
  warehouseId: number
  warehouseName: string
  movementType: MovementType
  quantity: number
  unitCost: number
  totalValue: number
  movementDate: Date
  notes?: string
  performedBy: string
  previousValues?: Partial<MovementWebhookData>
}

export interface InventoryWebhookData {
  titleId: number
  warehouseId: number
  previousLevel: number
  newLevel: number
  change: number
  triggerMovementId: number
}

export interface BatchWebhookData {
  batchId: string
  sourceSystem: string
  totalCount: number
  successCount: number
  failureCount: number
  startedAt: Date
  completedAt: Date
  errors?: string[]
}

export interface WebhookDelivery {
  id: string
  endpointId: string
  event: WebhookEventType
  payload: WebhookPayload
  attemptCount: number
  maxRetries: number
  status: 'pending' | 'delivered' | 'failed' | 'abandoned'
  lastAttemptAt?: Date
  nextAttemptAt?: Date
  responseStatus?: number
  responseBody?: string
  createdAt: Date
  deliveredAt?: Date
}

export interface WebhookSignature {
  timestamp: number
  signature: string
}

class WebhookService {
  private static db: PrismaClient | null = null
  private static endpoints: Map<string, WebhookEndpoint> = new Map()
  private static deliveryQueue: WebhookDelivery[] = []
  private static isProcessingQueue = false

  static setDbClient(client: PrismaClient): void {
    this.db = client
  }

  private static getDb(): PrismaClient {
    if (!this.db) {
      throw new Error('Database client not initialized. Call setDbClient() first.')
    }
    return this.db
  }

  static async registerEndpoint(endpoint: WebhookEndpoint): Promise<void> {
    this.validateEndpoint(endpoint)
    this.endpoints.set(endpoint.id, endpoint)

    // In production, this would persist to database
    console.log(`Webhook endpoint registered: ${endpoint.id} -> ${endpoint.url}`)
  }

  static async unregisterEndpoint(endpointId: string): Promise<boolean> {
    const removed = this.endpoints.delete(endpointId)

    if (removed) {
      console.log(`Webhook endpoint unregistered: ${endpointId}`)
    }

    return removed
  }

  static async updateEndpoint(
    endpointId: string,
    updates: Partial<WebhookEndpoint>
  ): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId)

    if (!endpoint) {
      return false
    }

    const updatedEndpoint = { ...endpoint, ...updates }
    this.validateEndpoint(updatedEndpoint)
    this.endpoints.set(endpointId, updatedEndpoint)

    console.log(`Webhook endpoint updated: ${endpointId}`)
    return true
  }

  static async triggerMovementEvent(
    event: WebhookEventType,
    movementData: MovementWebhookData,
    previousValues?: Partial<MovementWebhookData>
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      data: previousValues ? { ...movementData, previousValues } : movementData
    }

    await this.queueWebhookDeliveries(event, payload)
  }

  static async triggerInventoryEvent(
    inventoryData: InventoryWebhookData
  ): Promise<void> {
    const payload: WebhookPayload = {
      event: 'inventory.updated',
      timestamp: new Date(),
      data: inventoryData
    }

    await this.queueWebhookDeliveries('inventory.updated', payload)
  }

  static async triggerBatchEvent(
    event: 'batch.completed' | 'batch.failed',
    batchData: BatchWebhookData
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      timestamp: new Date(),
      data: batchData
    }

    await this.queueWebhookDeliveries(event, payload)
  }

  static async processDeliveryQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return
    }

    this.isProcessingQueue = true

    try {
      const pendingDeliveries = this.deliveryQueue.filter(
        delivery => delivery.status === 'pending' &&
        (!delivery.nextAttemptAt || delivery.nextAttemptAt <= new Date())
      )

      for (const delivery of pendingDeliveries) {
        await this.attemptDelivery(delivery)
      }

      // Clean up completed or abandoned deliveries
      this.deliveryQueue = this.deliveryQueue.filter(
        delivery => delivery.status === 'pending'
      )

    } catch (error) {
      console.error('Webhook queue processing error:', error)
    } finally {
      this.isProcessingQueue = false
    }
  }

  static generateSignature(payload: string, secret: string): WebhookSignature {
    const crypto = require('crypto')
    const timestamp = Math.floor(Date.now() / 1000)
    const signingString = `${timestamp}.${payload}`
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signingString, 'utf8')
      .digest('hex')

    return {
      timestamp,
      signature: `v1=${signature}`
    }
  }

  static verifySignature(
    payload: string,
    receivedSignature: string,
    secret: string,
    tolerance: number = 300 // 5 minutes
  ): boolean {
    try {
      const crypto = require('crypto')
      const elements = receivedSignature.split(',')

      let timestamp: number | undefined
      let signatures: string[] = []

      for (const element of elements) {
        const [key, value] = element.split('=')
        if (key === 't') {
          timestamp = parseInt(value)
        } else if (key === 'v1') {
          signatures.push(value)
        }
      }

      if (!timestamp || signatures.length === 0) {
        return false
      }

      // Check timestamp tolerance
      const currentTime = Math.floor(Date.now() / 1000)
      if (Math.abs(currentTime - timestamp) > tolerance) {
        return false
      }

      // Verify signature
      const signingString = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signingString, 'utf8')
        .digest('hex')

      return signatures.some(sig =>
        crypto.timingSafeEqual(
          Buffer.from(expectedSignature, 'hex'),
          Buffer.from(sig, 'hex')
        )
      )

    } catch (error) {
      console.error('Webhook signature verification error:', error)
      return false
    }
  }

  static async getDeliveryStatus(deliveryId: string): Promise<WebhookDelivery | null> {
    const delivery = this.deliveryQueue.find(d => d.id === deliveryId)
    return delivery || null
  }

  static async getEndpointMetrics(endpointId: string): Promise<{
    totalDeliveries: number
    successfulDeliveries: number
    failedDeliveries: number
    averageResponseTime: number
    lastDeliveryAt?: Date
    successRate: number
  }> {
    // In production, this would query persisted delivery records
    const deliveries = this.deliveryQueue.filter(d => d.endpointId === endpointId)

    const totalDeliveries = deliveries.length
    const successfulDeliveries = deliveries.filter(d => d.status === 'delivered').length
    const failedDeliveries = deliveries.filter(d => d.status === 'failed' || d.status === 'abandoned').length

    const lastDelivery = deliveries
      .filter(d => d.deliveredAt)
      .sort((a, b) => (b.deliveredAt!.getTime() - a.deliveredAt!.getTime()))[0]

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageResponseTime: 0, // Would need separate tracking
      lastDeliveryAt: lastDelivery?.deliveredAt,
      successRate: totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0
    }
  }

  private static validateEndpoint(endpoint: WebhookEndpoint): void {
    if (!endpoint.id || endpoint.id.trim() === '') {
      throw new Error('Endpoint ID is required')
    }

    if (!endpoint.url || !this.isValidUrl(endpoint.url)) {
      throw new Error('Valid endpoint URL is required')
    }

    if (!endpoint.secret || endpoint.secret.length < 16) {
      throw new Error('Endpoint secret must be at least 16 characters')
    }

    if (!endpoint.events || endpoint.events.length === 0) {
      throw new Error('At least one event type must be specified')
    }

    const validEvents: WebhookEventType[] = [
      'movement.created', 'movement.updated', 'movement.deleted',
      'movement.approved', 'movement.rejected',
      'inventory.updated', 'batch.completed', 'batch.failed'
    ]

    for (const event of endpoint.events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid event type: ${event}`)
      }
    }
  }

  private static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' || (process.env.NODE_ENV === 'development' && parsed.protocol === 'http:')
    } catch {
      return false
    }
  }

  private static async queueWebhookDeliveries(
    event: WebhookEventType,
    payload: WebhookPayload
  ): Promise<void> {
    const relevantEndpoints = Array.from(this.endpoints.values()).filter(
      endpoint => endpoint.isActive && endpoint.events.includes(event)
    )

    for (const endpoint of relevantEndpoints) {
      const delivery: WebhookDelivery = {
        id: this.generateDeliveryId(),
        endpointId: endpoint.id,
        event,
        payload,
        attemptCount: 0,
        maxRetries: endpoint.retryPolicy.maxRetries,
        status: 'pending',
        createdAt: new Date()
      }

      this.deliveryQueue.push(delivery)
    }

    // Start processing queue if not already running
    if (!this.isProcessingQueue) {
      // Use setTimeout to avoid blocking the current execution
      setTimeout(() => this.processDeliveryQueue(), 100)
    }
  }

  private static async attemptDelivery(delivery: WebhookDelivery): Promise<void> {
    const endpoint = this.endpoints.get(delivery.endpointId)

    if (!endpoint) {
      delivery.status = 'abandoned'
      return
    }

    delivery.attemptCount++
    delivery.lastAttemptAt = new Date()

    try {
      const payloadString = JSON.stringify(delivery.payload)
      const signature = this.generateSignature(payloadString, endpoint.secret)

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `t=${signature.timestamp},v1=${signature.signature.replace('v1=', '')}`,
          'X-Webhook-Event': delivery.event,
          'X-Webhook-Delivery': delivery.id,
          'User-Agent': 'BookStock-Webhooks/1.0'
        },
        body: payloadString,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })

      delivery.responseStatus = response.status
      delivery.responseBody = await response.text()

      if (response.ok) {
        delivery.status = 'delivered'
        delivery.deliveredAt = new Date()
      } else {
        throw new Error(`HTTP ${response.status}: ${delivery.responseBody}`)
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      if (delivery.attemptCount >= delivery.maxRetries) {
        delivery.status = 'abandoned'
        console.error(`Webhook delivery abandoned after ${delivery.attemptCount} attempts:`, {
          deliveryId: delivery.id,
          endpointId: delivery.endpointId,
          error: errorMessage
        })
      } else {
        // Schedule retry
        const delayMs = endpoint.retryPolicy.retryDelay *
          Math.pow(endpoint.retryPolicy.backoffMultiplier, delivery.attemptCount - 1)

        delivery.nextAttemptAt = new Date(Date.now() + delayMs)
        delivery.status = 'pending'

        console.warn(`Webhook delivery failed, retry scheduled:`, {
          deliveryId: delivery.id,
          endpointId: delivery.endpointId,
          attemptCount: delivery.attemptCount,
          nextAttempt: delivery.nextAttemptAt,
          error: errorMessage
        })
      }
    }
  }

  private static generateDeliveryId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `whook_${timestamp}_${random}`
  }

  // Initialize default endpoints (would typically be loaded from database)
  static async initializeDefaultEndpoints(): Promise<void> {
    // Example development endpoint
    if (process.env.NODE_ENV === 'development') {
      await this.registerEndpoint({
        id: 'dev-webhook',
        url: 'http://localhost:3001/webhooks/movements',
        secret: 'dev-webhook-secret-key-12345',
        isActive: false, // Disabled by default
        events: ['movement.created', 'movement.updated', 'inventory.updated'],
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000, // 1 second
          backoffMultiplier: 2
        }
      })
    }
  }
}

export default WebhookService