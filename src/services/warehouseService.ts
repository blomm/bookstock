import { PrismaClient, Prisma, Warehouse } from '@prisma/client'

// Types for warehouse operations
export interface CreateWarehouseData {
  name: string
  code: string
  location: string
  fulfillsChannels: string[]
  isActive?: boolean
  capacity?: WarehouseCapacity
  coordinates?: GeographicCoordinates
  configuration?: WarehouseConfiguration
}

export interface UpdateWarehouseData extends Partial<CreateWarehouseData> {
  operationalStatus?: OperationalStatus
  lastStatusChange?: Date
}

export interface WarehouseCapacity {
  maxVolume?: number // cubic meters
  maxWeight?: number // kilograms
  maxSku?: number // maximum SKU count
  maxPallets?: number // maximum pallet positions
  currentUtilization?: UtilizationMetrics
}

export interface UtilizationMetrics {
  volumeUsed: number
  weightUsed: number
  skuCount: number
  palletCount: number
  lastCalculated: Date
}

export interface GeographicCoordinates {
  latitude: number
  longitude: number
  timezone: string
  address?: string
  postalCode?: string
  country: string
}

export interface WarehouseConfiguration {
  workingHours?: WorkingHours
  fulfillmentSettings?: FulfillmentSettings
  integrations?: IntegrationSettings
  notifications?: NotificationSettings
}

export interface WorkingHours {
  monday?: DaySchedule
  tuesday?: DaySchedule
  wednesday?: DaySchedule
  thursday?: DaySchedule
  friday?: DaySchedule
  saturday?: DaySchedule
  sunday?: DaySchedule
  timezone: string
}

export interface DaySchedule {
  isWorkingDay: boolean
  openTime?: string // HH:MM format
  closeTime?: string // HH:MM format
  breakTimes?: Array<{ start: string; end: string }>
}

export interface FulfillmentSettings {
  allowBackorders: boolean
  autoAllocateInventory: boolean
  priorityChannels: string[]
  cutoffTimes: Array<{ channel: string; cutoffTime: string }>
  shippingMethods: string[]
}

export interface IntegrationSettings {
  wmsSystem?: string
  wmsApiUrl?: string
  wmsApiKey?: string
  printerConnections: Array<{ printerId: number; priority: number }>
  externalWarehouseId?: string
}

export interface NotificationSettings {
  lowStockThreshold: number
  capacityWarningThreshold: number // percentage
  alertEmails: string[]
  urgentAlertEmails: string[]
}

export enum OperationalStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SEASONAL_CLOSED = 'SEASONAL_CLOSED',
  EMERGENCY_CLOSURE = 'EMERGENCY_CLOSURE'
}

// Custom error classes
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class BusinessRuleError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'BusinessRuleError'
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class WarehouseService {
  constructor(private prisma: PrismaClient = new PrismaClient()) {}

  // CRUD Operations
  async createWarehouse(data: CreateWarehouseData): Promise<Warehouse> {
    // Validate required fields
    this.validateCreateData(data)

    // Check for unique code
    await this.validateUniqueCode(data.code)

    // Validate business rules
    this.validateBusinessRules(data)

    try {
      const warehouse = await this.prisma.warehouse.create({
        data: {
          name: data.name,
          code: data.code.toUpperCase(),
          location: data.location,
          fulfillsChannels: data.fulfillsChannels,
          isActive: data.isActive ?? true
        }
      })

      // If capacity, coordinates, or configuration provided, store them separately
      if (data.capacity || data.coordinates || data.configuration) {
        await this.updateWarehouseMetadata(warehouse.id, {
          capacity: data.capacity,
          coordinates: data.coordinates,
          configuration: data.configuration
        })
      }

      return warehouse
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError('Warehouse code must be unique', 'code')
        }
      }
      throw error
    }
  }

  async getWarehouse(id: number): Promise<Warehouse | null> {
    return await this.prisma.warehouse.findUnique({
      where: { id },
      include: {
        inventory: {
          include: {
            title: true
          }
        },
        stockMovements: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            title: true
          }
        }
      }
    })
  }

  async getWarehouseByCode(code: string): Promise<Warehouse | null> {
    return await this.prisma.warehouse.findUnique({
      where: { code: code.toUpperCase() }
    })
  }

  async listWarehouses(filters?: {
    location?: string
    isActive?: boolean
    fulfillsChannel?: string
  }): Promise<Warehouse[]> {
    const where: Prisma.WarehouseWhereInput = {}

    if (filters?.location) {
      where.location = filters.location
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive
    }

    if (filters?.fulfillsChannel) {
      where.fulfillsChannels = {
        array_contains: filters.fulfillsChannel
      }
    }

    return await this.prisma.warehouse.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            inventory: true,
            stockMovements: true
          }
        }
      }
    })
  }

  async updateWarehouse(id: number, data: UpdateWarehouseData): Promise<Warehouse> {
    const existingWarehouse = await this.getWarehouse(id)
    if (!existingWarehouse) {
      throw new NotFoundError(`Warehouse with ID ${id} not found`)
    }

    // Validate code uniqueness if code is being updated
    if (data.code && data.code !== existingWarehouse.code) {
      await this.validateUniqueCode(data.code, id)
    }

    // Validate business rules for updates
    if (data.fulfillsChannels || data.location) {
      this.validateBusinessRules(data as CreateWarehouseData)
    }

    const updateData: Prisma.WarehouseUpdateInput = {}

    // Update basic fields
    if (data.name) updateData.name = data.name
    if (data.code) updateData.code = data.code.toUpperCase()
    if (data.location) updateData.location = data.location
    if (data.fulfillsChannels) updateData.fulfillsChannels = data.fulfillsChannels
    if (data.isActive !== undefined) updateData.isActive = data.isActive

    try {
      const warehouse = await this.prisma.warehouse.update({
        where: { id },
        data: updateData
      })

      // Update metadata if provided
      if (data.capacity || data.coordinates || data.configuration || data.operationalStatus) {
        await this.updateWarehouseMetadata(id, {
          capacity: data.capacity,
          coordinates: data.coordinates,
          configuration: data.configuration,
          operationalStatus: data.operationalStatus,
          lastStatusChange: data.lastStatusChange
        })
      }

      return warehouse
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ValidationError('Warehouse code must be unique', 'code')
        }
      }
      throw error
    }
  }

  async deleteWarehouse(id: number): Promise<void> {
    const warehouse = await this.getWarehouse(id)
    if (!warehouse) {
      throw new NotFoundError(`Warehouse with ID ${id} not found`)
    }

    // Check if warehouse has inventory
    const inventoryCount = await this.prisma.inventory.count({
      where: { warehouseId: id }
    })

    if (inventoryCount > 0) {
      throw new BusinessRuleError(
        'Cannot delete warehouse with existing inventory',
        'HAS_INVENTORY'
      )
    }

    await this.prisma.warehouse.delete({
      where: { id }
    })
  }

  // Capacity and Utilization Monitoring
  async calculateUtilization(warehouseId: number): Promise<UtilizationMetrics> {
    const warehouse = await this.getWarehouse(warehouseId)
    if (!warehouse) {
      throw new NotFoundError(`Warehouse with ID ${warehouseId} not found`)
    }

    // Get inventory statistics
    const inventoryStats = await this.prisma.inventory.aggregate({
      where: { warehouseId },
      _sum: {
        currentStock: true
      },
      _count: {
        id: true
      }
    })

    // Calculate basic utilization metrics
    const skuCount = inventoryStats._count.id || 0
    const totalUnits = inventoryStats._sum.currentStock || 0

    // For now, estimate volume and weight based on average book dimensions
    // In a real system, this would use actual product dimensions
    const averageVolumePerUnit = 0.0005 // 0.5 liters per book
    const averageWeightPerUnit = 0.3 // 300g per book

    const volumeUsed = totalUnits * averageVolumePerUnit
    const weightUsed = totalUnits * averageWeightPerUnit

    // Estimate pallet count (assuming 1000 units per pallet)
    const palletCount = Math.ceil(totalUnits / 1000)

    return {
      volumeUsed,
      weightUsed,
      skuCount,
      palletCount,
      lastCalculated: new Date()
    }
  }

  async getCapacityReport(warehouseId: number): Promise<{
    capacity: WarehouseCapacity | null
    utilization: UtilizationMetrics
    utilizationPercentages: {
      volume: number
      weight: number
      sku: number
      pallets: number
    }
    warnings: string[]
  }> {
    const utilization = await this.calculateUtilization(warehouseId)
    const capacity = await this.getWarehouseCapacity(warehouseId)

    const utilizationPercentages = {
      volume: capacity?.maxVolume ? (utilization.volumeUsed / capacity.maxVolume) * 100 : 0,
      weight: capacity?.maxWeight ? (utilization.weightUsed / capacity.maxWeight) * 100 : 0,
      sku: capacity?.maxSku ? (utilization.skuCount / capacity.maxSku) * 100 : 0,
      pallets: capacity?.maxPallets ? (utilization.palletCount / capacity.maxPallets) * 100 : 0
    }

    const warnings: string[] = []
    const warningThreshold = 80 // 80% threshold for warnings

    if (utilizationPercentages.volume > warningThreshold) {
      warnings.push(`Volume utilization is ${utilizationPercentages.volume.toFixed(1)}%`)
    }
    if (utilizationPercentages.weight > warningThreshold) {
      warnings.push(`Weight utilization is ${utilizationPercentages.weight.toFixed(1)}%`)
    }
    if (utilizationPercentages.sku > warningThreshold) {
      warnings.push(`SKU utilization is ${utilizationPercentages.sku.toFixed(1)}%`)
    }
    if (utilizationPercentages.pallets > warningThreshold) {
      warnings.push(`Pallet utilization is ${utilizationPercentages.pallets.toFixed(1)}%`)
    }

    return {
      capacity,
      utilization,
      utilizationPercentages,
      warnings
    }
  }

  // Operational Status and Scheduling
  async updateOperationalStatus(
    warehouseId: number,
    status: OperationalStatus,
    reason?: string
  ): Promise<void> {
    const warehouse = await this.getWarehouse(warehouseId)
    if (!warehouse) {
      throw new NotFoundError(`Warehouse with ID ${warehouseId} not found`)
    }

    await this.updateWarehouseMetadata(warehouseId, {
      operationalStatus: status,
      lastStatusChange: new Date(),
      statusChangeReason: reason
    })
  }

  async getOperationalStatus(warehouseId: number): Promise<{
    status: OperationalStatus
    lastStatusChange?: Date
    reason?: string
    isOperational: boolean
  }> {
    const metadata = await this.getWarehouseMetadata(warehouseId)
    const status = metadata?.operationalStatus || OperationalStatus.ACTIVE

    return {
      status,
      lastStatusChange: metadata?.lastStatusChange,
      reason: metadata?.statusChangeReason,
      isOperational: status === OperationalStatus.ACTIVE
    }
  }

  async isWarehouseOperational(warehouseId: number, checkTime?: Date): Promise<boolean> {
    const warehouse = await this.getWarehouse(warehouseId)
    if (!warehouse || !warehouse.isActive) {
      return false
    }

    const operationalStatus = await this.getOperationalStatus(warehouseId)
    if (!operationalStatus.isOperational) {
      return false
    }

    // Check working hours if checkTime provided
    if (checkTime) {
      const configuration = await this.getWarehouseConfiguration(warehouseId)
      if (configuration?.workingHours) {
        return this.isWithinWorkingHours(configuration.workingHours, checkTime)
      }
    }

    return true
  }

  // Configuration Management
  async updateWarehouseConfiguration(
    warehouseId: number,
    configuration: WarehouseConfiguration
  ): Promise<void> {
    const warehouse = await this.getWarehouse(warehouseId)
    if (!warehouse) {
      throw new NotFoundError(`Warehouse with ID ${warehouseId} not found`)
    }

    await this.updateWarehouseMetadata(warehouseId, { configuration })
  }

  async getWarehouseConfiguration(warehouseId: number): Promise<WarehouseConfiguration | null> {
    const metadata = await this.getWarehouseMetadata(warehouseId)
    return metadata?.configuration || null
  }

  // Private helper methods
  private validateCreateData(data: CreateWarehouseData): void {
    if (!data.name?.trim()) {
      throw new ValidationError('Warehouse name is required', 'name')
    }

    if (!data.code?.trim()) {
      throw new ValidationError('Warehouse code is required', 'code')
    }

    if (data.code.length > 10) {
      throw new ValidationError('Warehouse code must be 10 characters or less', 'code')
    }

    if (!data.location?.trim()) {
      throw new ValidationError('Warehouse location is required', 'location')
    }

    if (!Array.isArray(data.fulfillsChannels)) {
      throw new ValidationError('FulfillsChannels must be an array', 'fulfillsChannels')
    }
  }

  private async validateUniqueCode(code: string, excludeId?: number): Promise<void> {
    const existing = await this.prisma.warehouse.findUnique({
      where: { code: code.toUpperCase() }
    })

    if (existing && (!excludeId || existing.id !== excludeId)) {
      throw new ValidationError('Warehouse code must be unique', 'code')
    }
  }

  private validateBusinessRules(data: Partial<CreateWarehouseData>): void {
    // Validate fulfillment channel assignments based on location
    if (data.fulfillsChannels && data.location) {
      const validChannelsByLocation: Record<string, string[]> = {
        'UK': ['UK_TRADE_SALES', 'ROW_TRADE_SALES', 'ONLINE_SALES', 'DIRECT_SALES'],
        'US': ['US_TRADE_SALES', 'ONLINE_SALES', 'DIRECT_SALES'],
        'EU': ['EU_TRADE_SALES', 'ONLINE_SALES', 'DIRECT_SALES']
      }

      const validChannels = validChannelsByLocation[data.location] || []

      for (const channel of data.fulfillsChannels) {
        if (!validChannels.includes(channel)) {
          throw new BusinessRuleError(
            `Channel ${channel} is not valid for location ${data.location}`,
            'INVALID_CHANNEL_LOCATION'
          )
        }
      }
    }
  }

  private isWithinWorkingHours(workingHours: WorkingHours, checkTime: Date): boolean {
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[checkTime.getDay()] as keyof WorkingHours
    const daySchedule = workingHours[dayName] as DaySchedule | undefined

    if (!daySchedule || !daySchedule.isWorkingDay) {
      return false
    }

    if (!daySchedule.openTime || !daySchedule.closeTime) {
      return true // No specific hours means all day
    }

    const currentTime = checkTime.toTimeString().substr(0, 5) // HH:MM format
    return currentTime >= daySchedule.openTime && currentTime <= daySchedule.closeTime
  }

  // Metadata storage methods (using JSON fields or separate tables)
  private async updateWarehouseMetadata(warehouseId: number, metadata: any): Promise<void> {
    // For now, we'll simulate storing metadata
    // In a real implementation, this might use a separate metadata table or JSON fields
    // Since the current schema doesn't have these fields, we'll just store the core data

    // This is a placeholder - in production you'd extend the schema or use a metadata table
    console.log(`Updating metadata for warehouse ${warehouseId}:`, metadata)
  }

  private async getWarehouseMetadata(warehouseId: number): Promise<any> {
    // Placeholder for metadata retrieval
    // In production, this would fetch from metadata storage
    return null
  }

  private async getWarehouseCapacity(warehouseId: number): Promise<WarehouseCapacity | null> {
    // Placeholder for capacity data retrieval
    return null
  }
}

export default WarehouseService