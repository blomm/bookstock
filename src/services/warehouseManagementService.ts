import { PrismaClient, Warehouse, Prisma } from '@prisma/client'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Types and Interfaces
export interface CreateWarehouseData {
  name: string
  code: string
  location: string
  fulfillsChannels: string[]
  isActive?: boolean
  capacity?: WarehouseCapacity
}

export interface UpdateWarehouseData {
  name?: string
  code?: string
  location?: string
  fulfillsChannels?: string[]
  isActive?: boolean
  capacity?: WarehouseCapacity
}

export interface WarehouseCapacity {
  maxVolume?: number
  maxWeight?: number
  maxSkus?: number
  maxPallets?: number
}

export interface UtilizationMetrics {
  volumeUsed: number
  weightUsed: number
  skuCount: number
  palletCount: number
  utilizationPercentage: number
  lastCalculated: Date
}

export interface WarehouseWithMetrics extends Warehouse {
  capacity?: WarehouseCapacity
  utilization?: UtilizationMetrics
  inventoryCount: number
  totalStock: number
}

export interface OperationalStatus {
  isActive: boolean
  lastStatusChange?: Date
  statusReason?: string
  scheduledDowntime?: DateRange[]
  operatingHours?: OperatingHours
}

export interface DateRange {
  start: Date
  end: Date
  reason: string
}

export interface OperatingHours {
  monday: DaySchedule
  tuesday: DaySchedule
  wednesday: DaySchedule
  thursday: DaySchedule
  friday: DaySchedule
  saturday: DaySchedule
  sunday: DaySchedule
}

export interface DaySchedule {
  isOpen: boolean
  openTime?: string
  closeTime?: string
  breaks?: TimeSlot[]
}

export interface TimeSlot {
  start: string
  end: string
  description: string
}

export interface ConfigurationSetting {
  key: string
  value: any
  description?: string
  category: 'fulfillment' | 'capacity' | 'scheduling' | 'integration' | 'general'
}

export class WarehouseManagementService {
  /**
   * Sub-task 1: Build warehouse CRUD operations with location tracking
   */

  // Create new warehouse
  static async createWarehouse(data: CreateWarehouseData): Promise<Warehouse> {
    try {
      // Validate required fields
      if (!data.name || !data.code || !data.location) {
        throw new Error('Name, code, and location are required')
      }

      // Check for duplicate warehouse code
      const existingWarehouse = await dbClient.warehouse.findUnique({
        where: { code: data.code }
      })

      if (existingWarehouse) {
        throw new Error(`Warehouse with code '${data.code}' already exists`)
      }

      // Create warehouse with default active status
      const warehouse = await dbClient.warehouse.create({
        data: {
          name: data.name,
          code: data.code,
          location: data.location,
          fulfillsChannels: data.fulfillsChannels || [],
          isActive: data.isActive !== undefined ? data.isActive : true
        }
      })

      return warehouse
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to create warehouse')
    }
  }

  // Get warehouse by ID
  static async getWarehouseById(id: number): Promise<WarehouseWithMetrics | null> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id },
        include: {
          inventory: {
            select: {
              currentStock: true,
              reservedStock: true
            }
          }
        }
      })

      if (!warehouse) {
        return null
      }

      // Calculate metrics
      const inventoryCount = warehouse.inventory.length
      const totalStock = warehouse.inventory.reduce(
        (sum, inv) => sum + inv.currentStock + inv.reservedStock,
        0
      )

      return {
        ...warehouse,
        inventoryCount,
        totalStock
      }
    } catch (error) {
      throw new Error('Failed to retrieve warehouse')
    }
  }

  // List all warehouses with optional filtering
  static async listWarehouses(filters?: {
    isActive?: boolean
    location?: string
    fulfillsChannel?: string
  }): Promise<WarehouseWithMetrics[]> {
    try {
      const where: Prisma.WarehouseWhereInput = {}

      if (filters?.isActive !== undefined) {
        where.isActive = filters.isActive
      }

      if (filters?.location) {
        where.location = { contains: filters.location, mode: 'insensitive' }
      }

      if (filters?.fulfillsChannel) {
        where.fulfillsChannels = { array_contains: filters.fulfillsChannel }
      }

      const warehouses = await dbClient.warehouse.findMany({
        where,
        include: {
          inventory: {
            select: {
              currentStock: true,
              reservedStock: true
            }
          }
        },
        orderBy: { name: 'asc' }
      })

      return warehouses.map(warehouse => ({
        ...warehouse,
        inventoryCount: warehouse.inventory.length,
        totalStock: warehouse.inventory.reduce(
          (sum, inv) => sum + inv.currentStock + inv.reservedStock,
          0
        )
      }))
    } catch (error) {
      throw new Error('Failed to list warehouses')
    }
  }

  // Update warehouse
  static async updateWarehouse(id: number, data: UpdateWarehouseData): Promise<Warehouse> {
    try {
      // Check if warehouse exists
      const existingWarehouse = await dbClient.warehouse.findUnique({
        where: { id }
      })

      if (!existingWarehouse) {
        throw new Error('Warehouse not found')
      }

      // Check for duplicate code if code is being updated
      if (data.code && data.code !== existingWarehouse.code) {
        const duplicateCode = await dbClient.warehouse.findUnique({
          where: { code: data.code }
        })

        if (duplicateCode) {
          throw new Error(`Warehouse with code '${data.code}' already exists`)
        }
      }

      const warehouse = await dbClient.warehouse.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          location: data.location,
          fulfillsChannels: data.fulfillsChannels,
          isActive: data.isActive
        }
      })

      return warehouse
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update warehouse')
    }
  }

  // Delete warehouse (soft delete by deactivating)
  static async deleteWarehouse(id: number): Promise<void> {
    try {
      // Check if warehouse exists
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id },
        include: {
          inventory: true,
          stockMovements: true
        }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      // Check if warehouse has active inventory or movements
      const hasActiveInventory = warehouse.inventory.some(inv =>
        inv.currentStock > 0 || inv.reservedStock > 0
      )

      if (hasActiveInventory) {
        throw new Error('Cannot delete warehouse with active inventory. Please transfer stock first.')
      }

      // Soft delete by deactivating
      await dbClient.warehouse.update({
        where: { id },
        data: { isActive: false }
      })
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to delete warehouse')
    }
  }

  /**
   * Sub-task 2: Implement warehouse capacity and utilization monitoring
   */

  // Calculate utilization metrics for a warehouse
  static async calculateUtilization(warehouseId: number): Promise<UtilizationMetrics> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          inventory: {
            include: {
              title: true
            }
          }
        }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      // Calculate current utilization metrics
      const skuCount = warehouse.inventory.length
      const totalStock = warehouse.inventory.reduce(
        (sum, inv) => sum + inv.currentStock + inv.reservedStock,
        0
      )

      // Estimate volume and weight (simplified calculation)
      // In a real system, these would be based on actual product dimensions
      const estimatedVolumePerUnit = 0.001 // 1 liter per book average
      const estimatedWeightPerUnit = 0.5 // 500g per book average

      const volumeUsed = totalStock * estimatedVolumePerUnit
      const weightUsed = totalStock * estimatedWeightPerUnit

      // Estimate pallet count (assuming 500 books per pallet)
      const palletCount = Math.ceil(totalStock / 500)

      // Calculate utilization percentage (simplified - using SKU count as primary metric)
      const maxSkuCapacity = 10000 // Default capacity if not specified
      const utilizationPercentage = Math.min((skuCount / maxSkuCapacity) * 100, 100)

      return {
        volumeUsed,
        weightUsed,
        skuCount,
        palletCount,
        utilizationPercentage,
        lastCalculated: new Date()
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to calculate warehouse utilization')
    }
  }

  // Get utilization for all warehouses
  static async getAllWarehouseUtilization(): Promise<Array<{
    warehouse: Warehouse
    utilization: UtilizationMetrics
  }>> {
    try {
      const warehouses = await dbClient.warehouse.findMany({
        where: { isActive: true }
      })

      const utilizationData = await Promise.all(
        warehouses.map(async warehouse => ({
          warehouse,
          utilization: await this.calculateUtilization(warehouse.id)
        }))
      )

      return utilizationData
    } catch (error) {
      throw new Error('Failed to get warehouse utilization data')
    }
  }

  // Check capacity alerts (warehouses approaching capacity limits)
  static async getCapacityAlerts(thresholdPercentage: number = 85): Promise<Array<{
    warehouse: Warehouse
    utilization: UtilizationMetrics
    alertLevel: 'warning' | 'critical'
  }>> {
    try {
      const utilizationData = await this.getAllWarehouseUtilization()

      return utilizationData
        .filter(data => data.utilization.utilizationPercentage >= thresholdPercentage)
        .map(data => ({
          warehouse: data.warehouse,
          utilization: data.utilization,
          alertLevel: data.utilization.utilizationPercentage >= 95 ? 'critical' : 'warning'
        }))
    } catch (error) {
      throw new Error('Failed to get capacity alerts')
    }
  }

  /**
   * Sub-task 3: Add warehouse operational status and scheduling
   */

  // Update operational status
  static async updateOperationalStatus(
    warehouseId: number,
    status: Partial<OperationalStatus>
  ): Promise<void> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      await dbClient.warehouse.update({
        where: { id: warehouseId },
        data: {
          isActive: status.isActive
        }
      })

      // In a real implementation, additional status fields would be stored
      // in a separate warehouse_status or warehouse_configuration table
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update operational status')
    }
  }

  // Get operational status
  static async getOperationalStatus(warehouseId: number): Promise<OperationalStatus> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      // Return current status (simplified implementation)
      return {
        isActive: warehouse.isActive,
        lastStatusChange: warehouse.updatedAt
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to get operational status')
    }
  }

  // Check if warehouse is operational at given time
  static async isOperational(warehouseId: number, checkTime?: Date): Promise<boolean> {
    try {
      const status = await this.getOperationalStatus(warehouseId)
      const timeToCheck = checkTime || new Date()

      // Basic check - warehouse must be active
      if (!status.isActive) {
        return false
      }

      // In a real implementation, this would check:
      // - Scheduled downtime
      // - Operating hours
      // - Holiday schedules
      // For now, return true if active

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Sub-task 4: Create warehouse-specific configuration management
   */

  // Get warehouse configuration
  static async getWarehouseConfiguration(warehouseId: number): Promise<ConfigurationSetting[]> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      // Return current configuration as settings array
      const config: ConfigurationSetting[] = [
        {
          key: 'fulfillment_channels',
          value: warehouse.fulfillsChannels,
          description: 'Sales channels this warehouse can fulfill',
          category: 'fulfillment'
        },
        {
          key: 'warehouse_code',
          value: warehouse.code,
          description: 'Unique warehouse identifier code',
          category: 'general'
        },
        {
          key: 'location',
          value: warehouse.location,
          description: 'Physical location of the warehouse',
          category: 'general'
        },
        {
          key: 'is_active',
          value: warehouse.isActive,
          description: 'Whether warehouse is currently operational',
          category: 'general'
        }
      ]

      return config
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to get warehouse configuration')
    }
  }

  // Update warehouse configuration
  static async updateWarehouseConfiguration(
    warehouseId: number,
    settings: ConfigurationSetting[]
  ): Promise<void> {
    try {
      const warehouse = await dbClient.warehouse.findUnique({
        where: { id: warehouseId }
      })

      if (!warehouse) {
        throw new Error('Warehouse not found')
      }

      // Extract updateable fields from settings
      const updateData: Partial<Warehouse> = {}

      settings.forEach(setting => {
        switch (setting.key) {
          case 'fulfillment_channels':
            if (Array.isArray(setting.value)) {
              updateData.fulfillsChannels = setting.value
            }
            break
          case 'is_active':
            if (typeof setting.value === 'boolean') {
              updateData.isActive = setting.value
            }
            break
          case 'location':
            if (typeof setting.value === 'string') {
              updateData.location = setting.value
            }
            break
        }
      })

      if (Object.keys(updateData).length > 0) {
        await dbClient.warehouse.update({
          where: { id: warehouseId },
          data: updateData
        })
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error('Failed to update warehouse configuration')
    }
  }

  // Get warehouse performance metrics
  static async getWarehousePerformanceMetrics(
    warehouseId: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalMovements: number
    inboundMovements: number
    outboundMovements: number
    transfersIn: number
    transfersOut: number
    averageMovementValue: number
    topMovementTypes: Array<{ type: string; count: number }>
  }> {
    try {
      const dateFilter: Prisma.StockMovementWhereInput = {
        warehouseId,
        ...(startDate && endDate && {
          movementDate: {
            gte: startDate,
            lte: endDate
          }
        })
      }

      const movements = await dbClient.stockMovement.findMany({
        where: dateFilter,
        select: {
          movementType: true,
          quantity: true,
          rrpAtTime: true,
          sourceWarehouseId: true,
          destinationWarehouseId: true
        }
      })

      const totalMovements = movements.length
      const inboundMovements = movements.filter(m => m.quantity > 0).length
      const outboundMovements = movements.filter(m => m.quantity < 0).length
      const transfersIn = movements.filter(m => m.sourceWarehouseId !== null).length
      const transfersOut = movements.filter(m => m.destinationWarehouseId !== null).length

      const totalValue = movements.reduce((sum, m) => {
        const value = Number(m.rrpAtTime || 0) * Math.abs(m.quantity)
        return sum + value
      }, 0)

      const averageMovementValue = totalMovements > 0 ? totalValue / totalMovements : 0

      // Count movement types
      const movementTypeCounts = movements.reduce((acc, m) => {
        acc[m.movementType] = (acc[m.movementType] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const topMovementTypes = Object.entries(movementTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      return {
        totalMovements,
        inboundMovements,
        outboundMovements,
        transfersIn,
        transfersOut,
        averageMovementValue,
        topMovementTypes
      }
    } catch (error) {
      throw new Error('Failed to get warehouse performance metrics')
    }
  }
}

// Export service and types
export default WarehouseManagementService