import { PrismaClient, StockMovement, MovementType } from '@prisma/client'
import StockMovementAuditService, { MovementTimelineEntry, MovementChainTracking } from './stockMovementAuditService'

let dbClient = new PrismaClient()

export function setDbClient(client: PrismaClient) {
  dbClient = client
}

// Timeline Visualization Types and Interfaces
export interface MovementHistoryVisualization {
  movementId: number
  timeline: EnhancedTimelineEntry[]
  relatedMovements: RelatedMovementInfo[]
  chainVisualization?: ChainVisualizationData
  summary: HistorySummary
}

export interface EnhancedTimelineEntry extends MovementTimelineEntry {
  id: string
  category: TimelineCategory
  impact: ImpactLevel
  relatedMovementIds: number[]
  visualizationData: {
    icon: string
    color: string
    position: number
    duration?: number
  }
}

export interface RelatedMovementInfo {
  movementId: number
  relationship: MovementRelationship
  description: string
  impact: ImpactLevel
  timestamp: Date
}

export interface ChainVisualizationData {
  nodes: ChainNode[]
  edges: ChainEdge[]
  layout: 'sequential' | 'hierarchical' | 'network'
  metadata: {
    totalNodes: number
    totalEdges: number
    depth: number
    breadth: number
  }
}

export interface ChainNode {
  id: string
  movementId: number
  label: string
  type: NodeType
  status: NodeStatus
  position: { x: number; y: number }
  data: {
    movementType: MovementType
    quantity: number
    warehouse: string
    timestamp: Date
    value?: number
  }
  style: {
    color: string
    size: number
    shape: string
  }
}

export interface ChainEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  label?: string
  data: {
    relationshipType: MovementRelationship
    transferredQuantity?: number
    timeDelay?: number
  }
  style: {
    color: string
    width: number
    pattern: 'solid' | 'dashed' | 'dotted'
  }
}

export interface HistorySummary {
  totalMovements: number
  totalQuantityChange: number
  totalValueChange: number
  timeSpan: {
    start: Date
    end: Date
    duration: number // in milliseconds
  }
  warehouses: string[]
  movementTypes: MovementType[]
  keyMilestones: Milestone[]
}

export interface Milestone {
  timestamp: Date
  description: string
  type: MilestoneType
  impact: ImpactLevel
  data?: Record<string, any>
}

export type TimelineCategory =
  | 'CREATION'
  | 'EXECUTION'
  | 'TRANSFER'
  | 'APPROVAL'
  | 'ADJUSTMENT'
  | 'SYSTEM'
  | 'ERROR'

export type ImpactLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type MovementRelationship =
  | 'PARENT'
  | 'CHILD'
  | 'SIBLING'
  | 'TRANSFER_PAIR'
  | 'BATCH_MEMBER'
  | 'REVERSAL'
  | 'CORRECTION'

export type NodeType =
  | 'MOVEMENT'
  | 'WAREHOUSE'
  | 'TITLE'
  | 'BATCH'

export type NodeStatus =
  | 'COMPLETED'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'

export type EdgeType =
  | 'TRANSFER'
  | 'SEQUENCE'
  | 'DEPENDENCY'
  | 'REVERSAL'

export type MilestoneType =
  | 'FIRST_MOVEMENT'
  | 'LARGE_ADJUSTMENT'
  | 'WAREHOUSE_TRANSFER'
  | 'BATCH_COMPLETION'
  | 'THRESHOLD_BREACH'

export interface TimelineFilterOptions {
  categories?: TimelineCategory[]
  impactLevels?: ImpactLevel[]
  dateRange?: { start: Date; end: Date }
  warehouses?: number[]
  movementTypes?: MovementType[]
  includeSystemEvents?: boolean
}

export interface VisualizationOptions {
  layout?: 'sequential' | 'hierarchical' | 'network'
  includeRelated?: boolean
  maxDepth?: number
  groupByWarehouse?: boolean
  showTimestamps?: boolean
  colorScheme?: 'default' | 'impact' | 'type' | 'warehouse'
}

class MovementTimelineService {

  // Movement History and Timeline Visualization
  static async generateMovementHistoryVisualization(
    movementId: number,
    options: VisualizationOptions = {}
  ): Promise<MovementHistoryVisualization> {
    try {
      // Get basic timeline from audit service
      const baseTimeline = await StockMovementAuditService.generateMovementTimeline(movementId)

      // Enhance timeline entries
      const timeline = await this.enhanceTimelineEntries(baseTimeline, movementId)

      // Get related movements
      const relatedMovements = await this.getRelatedMovementsInfo(movementId, options)

      // Generate chain visualization if requested
      let chainVisualization: ChainVisualizationData | undefined
      if (options.includeRelated) {
        chainVisualization = await this.generateChainVisualization(movementId, options)
      }

      // Generate summary
      const summary = await this.generateHistorySummary(movementId, timeline, relatedMovements)

      return {
        movementId,
        timeline,
        relatedMovements,
        chainVisualization,
        summary
      }
    } catch (error) {
      throw new Error(`Failed to generate movement history visualization: ${error}`)
    }
  }

  static async enhanceTimelineEntries(
    baseTimeline: MovementTimelineEntry[],
    movementId: number
  ): Promise<EnhancedTimelineEntry[]> {
    const enhancedEntries: EnhancedTimelineEntry[] = []

    for (let i = 0; i < baseTimeline.length; i++) {
      const entry = baseTimeline[i]
      const enhanced: EnhancedTimelineEntry = {
        ...entry,
        id: `${movementId}_${i}`,
        category: this.categorizeTimelineEntry(entry),
        impact: this.assessImpactLevel(entry),
        relatedMovementIds: await this.findRelatedMovementIds(entry),
        visualizationData: this.generateVisualizationData(entry, i, baseTimeline.length)
      }

      enhancedEntries.push(enhanced)
    }

    return enhancedEntries
  }

  static categorizeTimelineEntry(entry: MovementTimelineEntry): TimelineCategory {
    if (entry.action.includes('CREATED')) return 'CREATION'
    if (entry.action.includes('EXECUTED')) return 'EXECUTION'
    if (entry.action.includes('TRANSFER')) return 'TRANSFER'
    if (entry.action.includes('APPROVED') || entry.action.includes('REJECTED')) return 'APPROVAL'
    if (entry.action.includes('ADJUSTMENT')) return 'ADJUSTMENT'
    if (entry.action.includes('SYSTEM')) return 'SYSTEM'
    if (entry.action.includes('ERROR') || entry.action.includes('FAILED')) return 'ERROR'
    return 'SYSTEM'
  }

  static assessImpactLevel(entry: MovementTimelineEntry): ImpactLevel {
    // Assess impact based on action type and metadata
    if (entry.action.includes('FAILED') || entry.action.includes('ERROR')) return 'CRITICAL'
    if (entry.action.includes('APPROVED') || entry.action.includes('TRANSFER')) return 'HIGH'
    if (entry.action.includes('EXECUTED') || entry.action.includes('CREATED')) return 'MEDIUM'
    return 'LOW'
  }

  static async findRelatedMovementIds(entry: MovementTimelineEntry): Promise<number[]> {
    // Extract movement IDs from metadata or related transfers
    const relatedIds: number[] = []

    if (entry.metadata) {
      if (entry.metadata.relatedMovementId) {
        relatedIds.push(entry.metadata.relatedMovementId)
      }
      if (entry.metadata.transferPairId) {
        relatedIds.push(entry.metadata.transferPairId)
      }
    }

    return relatedIds
  }

  static generateVisualizationData(
    entry: MovementTimelineEntry,
    position: number,
    totalEntries: number
  ): EnhancedTimelineEntry['visualizationData'] {
    const category = this.categorizeTimelineEntry(entry)
    const impact = this.assessImpactLevel(entry)

    return {
      icon: this.getIconForCategory(category),
      color: this.getColorForImpact(impact),
      position: (position / Math.max(totalEntries - 1, 1)) * 100, // 0-100%
      duration: this.estimateEventDuration(entry)
    }
  }

  static getIconForCategory(category: TimelineCategory): string {
    const iconMap: Record<TimelineCategory, string> = {
      CREATION: '📝',
      EXECUTION: '⚡',
      TRANSFER: '🔄',
      APPROVAL: '✅',
      ADJUSTMENT: '⚖️',
      SYSTEM: '🤖',
      ERROR: '❌'
    }
    return iconMap[category] || '📋'
  }

  static getColorForImpact(impact: ImpactLevel): string {
    const colorMap: Record<ImpactLevel, string> = {
      LOW: '#10B981',      // Green
      MEDIUM: '#F59E0B',   // Amber
      HIGH: '#EF4444',     // Red
      CRITICAL: '#7C2D12'  // Dark red
    }
    return colorMap[impact]
  }

  static estimateEventDuration(entry: MovementTimelineEntry): number | undefined {
    // Estimate duration based on event type (in minutes)
    if (entry.action.includes('TRANSFER')) return 30
    if (entry.action.includes('APPROVAL')) return 60
    if (entry.action.includes('EXECUTED')) return 5
    return undefined
  }

  static async getRelatedMovementsInfo(
    movementId: number,
    options: VisualizationOptions
  ): Promise<RelatedMovementInfo[]> {
    try {
      const relatedMovements = await StockMovementAuditService.getRelatedMovements(movementId)
      const relatedInfo: RelatedMovementInfo[] = []

      for (const movement of relatedMovements) {
        const relationship = await this.determineMovementRelationship(movementId, movement.id)
        const info: RelatedMovementInfo = {
          movementId: movement.id,
          relationship,
          description: this.generateRelationshipDescription(movement, relationship),
          impact: this.assessMovementImpact(movement),
          timestamp: movement.movementDate
        }
        relatedInfo.push(info)
      }

      return relatedInfo.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    } catch (error) {
      throw new Error(`Failed to get related movements info: ${error}`)
    }
  }

  static async determineMovementRelationship(
    primaryMovementId: number,
    relatedMovementId: number
  ): Promise<MovementRelationship> {
    try {
      const [primary, related] = await Promise.all([
        dbClient.stockMovement.findUnique({ where: { id: primaryMovementId } }),
        dbClient.stockMovement.findUnique({ where: { id: relatedMovementId } })
      ])

      if (!primary || !related) {
        return 'SIBLING'
      }

      // Check for transfer pairs
      if (primary.movementType === 'WAREHOUSE_TRANSFER' && related.movementType === 'WAREHOUSE_TRANSFER') {
        if (
          primary.sourceWarehouseId === related.destinationWarehouseId &&
          primary.destinationWarehouseId === related.sourceWarehouseId
        ) {
          return 'TRANSFER_PAIR'
        }
      }

      // Check for batch members
      if (primary.batchNumber && primary.batchNumber === related.batchNumber) {
        return 'BATCH_MEMBER'
      }

      // Check for reversals
      if (primary.referenceNumber && related.referenceNumber?.includes(primary.referenceNumber)) {
        return 'REVERSAL'
      }

      // Check temporal relationship
      if (Math.abs(primary.movementDate.getTime() - related.movementDate.getTime()) < 60000) { // 1 minute
        return 'SIBLING'
      }

      return 'SIBLING'
    } catch (error) {
      return 'SIBLING'
    }
  }

  static generateRelationshipDescription(
    movement: StockMovement,
    relationship: MovementRelationship
  ): string {
    const quantity = Math.abs(movement.quantity)
    const type = movement.movementType.replace(/_/g, ' ').toLowerCase()

    switch (relationship) {
      case 'TRANSFER_PAIR':
        return `Transfer counterpart: ${type} of ${quantity} units`
      case 'BATCH_MEMBER':
        return `Batch member: ${type} of ${quantity} units (batch: ${movement.batchNumber})`
      case 'REVERSAL':
        return `Reversal: ${type} of ${quantity} units`
      case 'CORRECTION':
        return `Correction: ${type} of ${quantity} units`
      default:
        return `Related: ${type} of ${quantity} units`
    }
  }

  static assessMovementImpact(movement: StockMovement): ImpactLevel {
    const quantity = Math.abs(movement.quantity)
    const value = movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * quantity : 0

    // Assess based on quantity and value
    if (quantity > 1000 || value > 10000) return 'HIGH'
    if (quantity > 100 || value > 1000) return 'MEDIUM'
    return 'LOW'
  }

  // Chain Visualization Generation
  static async generateChainVisualization(
    movementId: number,
    options: VisualizationOptions
  ): Promise<ChainVisualizationData> {
    try {
      const chain = await StockMovementAuditService.traceMovementChain({ movementId, includeRelated: true })

      if (!chain) {
        // Create single-node visualization
        return this.createSingleNodeVisualization(movementId)
      }

      const nodes = await this.generateChainNodes(chain, options)
      const edges = this.generateChainEdges(chain, nodes)
      const layout = options.layout || 'sequential'

      // Calculate positions based on layout
      this.calculateNodePositions(nodes, edges, layout)

      return {
        nodes,
        edges,
        layout,
        metadata: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          depth: this.calculateChainDepth(chain),
          breadth: this.calculateChainBreadth(chain)
        }
      }
    } catch (error) {
      throw new Error(`Failed to generate chain visualization: ${error}`)
    }
  }

  static async createSingleNodeVisualization(movementId: number): Promise<ChainVisualizationData> {
    const movement = await dbClient.stockMovement.findUnique({
      where: { id: movementId },
      include: {
        warehouse: { select: { name: true } },
        title: { select: { title: true } }
      }
    })

    if (!movement) {
      throw new Error(`Movement ${movementId} not found`)
    }

    const node: ChainNode = {
      id: `node_${movementId}`,
      movementId,
      label: `${movement.movementType} - ${Math.abs(movement.quantity)} units`,
      type: 'MOVEMENT',
      status: 'COMPLETED',
      position: { x: 0, y: 0 },
      data: {
        movementType: movement.movementType,
        quantity: movement.quantity,
        warehouse: movement.warehouse.name,
        timestamp: movement.movementDate,
        value: movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * Math.abs(movement.quantity) : undefined
      },
      style: {
        color: '#3B82F6',
        size: 30,
        shape: 'circle'
      }
    }

    return {
      nodes: [node],
      edges: [],
      layout: 'sequential',
      metadata: {
        totalNodes: 1,
        totalEdges: 0,
        depth: 1,
        breadth: 1
      }
    }
  }

  static async generateChainNodes(
    chain: MovementChainTracking,
    options: VisualizationOptions
  ): Promise<ChainNode[]> {
    const nodes: ChainNode[] = []

    for (const chainedMovement of chain.movements) {
      const movement = chainedMovement.movement

      // Get additional data
      const movementWithDetails = await dbClient.stockMovement.findUnique({
        where: { id: movement.id },
        include: {
          warehouse: { select: { name: true } },
          title: { select: { title: true } }
        }
      })

      if (!movementWithDetails) continue

      const node: ChainNode = {
        id: `node_${movement.id}`,
        movementId: movement.id,
        label: this.generateNodeLabel(movementWithDetails, options),
        type: 'MOVEMENT',
        status: 'COMPLETED', // Could be enhanced with actual status
        position: { x: 0, y: 0 }, // Will be calculated later
        data: {
          movementType: movement.movementType,
          quantity: movement.quantity,
          warehouse: movementWithDetails.warehouse.name,
          timestamp: movement.movementDate,
          value: movement.rrpAtTime ? parseFloat(movement.rrpAtTime.toString()) * Math.abs(movement.quantity) : undefined
        },
        style: this.generateNodeStyle(movement, options)
      }

      nodes.push(node)
    }

    return nodes
  }

  static generateNodeLabel(movement: any, options: VisualizationOptions): string {
    const quantity = Math.abs(movement.quantity)
    const type = movement.movementType.replace(/_/g, ' ')

    if (options.showTimestamps) {
      const date = movement.movementDate.toLocaleDateString()
      return `${type}\n${quantity} units\n${date}`
    }

    return `${type}\n${quantity} units`
  }

  static generateNodeStyle(movement: StockMovement, options: VisualizationOptions): ChainNode['style'] {
    const colorScheme = options.colorScheme || 'default'
    let color = '#3B82F6' // Default blue

    switch (colorScheme) {
      case 'impact':
        const impact = this.assessMovementImpact(movement)
        color = this.getColorForImpact(impact)
        break
      case 'type':
        color = this.getColorForMovementType(movement.movementType)
        break
      case 'warehouse':
        color = this.getColorForWarehouse(movement.warehouseId)
        break
    }

    const quantity = Math.abs(movement.quantity)
    const size = Math.min(50, Math.max(20, quantity / 10 + 20))

    return {
      color,
      size,
      shape: movement.movementType.includes('TRANSFER') ? 'diamond' : 'circle'
    }
  }

  static getColorForMovementType(movementType: MovementType): string {
    const typeColors: Record<string, string> = {
      'PRINT_RECEIVED': '#10B981',
      'UK_TRADE_SALES': '#EF4444',
      'ROW_TRADE_SALES': '#F59E0B',
      'DIRECT_SALES': '#8B5CF6',
      'AMAZON_SALES': '#06B6D4',
      'WAREHOUSE_TRANSFER_IN': '#3B82F6',
      'WAREHOUSE_TRANSFER_OUT': '#6366F1',
      'STOCK_ADJUSTMENT': '#84CC16',
      'CYCLE_COUNT_ADJUSTMENT': '#22D3EE'
    }
    return typeColors[movementType] || '#6B7280'
  }

  static getColorForWarehouse(warehouseId: number): string {
    const warehouseColors = ['#EF4444', '#10B981', '#3B82F6', '#F59E0B', '#8B5CF6']
    return warehouseColors[warehouseId % warehouseColors.length]
  }

  static generateChainEdges(chain: MovementChainTracking, nodes: ChainNode[]): ChainEdge[] {
    const edges: ChainEdge[] = []
    const nodeMap = new Map(nodes.map(node => [node.movementId, node]))

    for (const chainedMovement of chain.movements) {
      for (const childId of chainedMovement.childMovementIds) {
        const sourceNode = nodeMap.get(chainedMovement.movementId)
        const targetNode = nodeMap.get(childId)

        if (sourceNode && targetNode) {
          const edge: ChainEdge = {
            id: `edge_${chainedMovement.movementId}_${childId}`,
            source: sourceNode.id,
            target: targetNode.id,
            type: this.determineEdgeType(sourceNode.data.movementType, targetNode.data.movementType),
            data: {
              relationshipType: 'CHILD', // Could be enhanced
              transferredQuantity: Math.abs(targetNode.data.quantity),
              timeDelay: targetNode.data.timestamp.getTime() - sourceNode.data.timestamp.getTime()
            },
            style: {
              color: '#6B7280',
              width: 2,
              pattern: 'solid'
            }
          }

          edges.push(edge)
        }
      }
    }

    return edges
  }

  static determineEdgeType(sourceType: MovementType, targetType: MovementType): EdgeType {
    if (sourceType === 'WAREHOUSE_TRANSFER' && targetType === 'WAREHOUSE_TRANSFER') {
      return 'TRANSFER'
    }
    if (sourceType.toString().includes('ADJUSTMENT') || targetType.toString().includes('ADJUSTMENT')) {
      return 'REVERSAL'
    }
    return 'SEQUENCE'
  }

  static calculateNodePositions(nodes: ChainNode[], edges: ChainEdge[], layout: string): void {
    switch (layout) {
      case 'sequential':
        this.calculateSequentialLayout(nodes)
        break
      case 'hierarchical':
        this.calculateHierarchicalLayout(nodes, edges)
        break
      case 'network':
        this.calculateNetworkLayout(nodes, edges)
        break
    }
  }

  static calculateSequentialLayout(nodes: ChainNode[]): void {
    const spacing = 150
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].position = {
        x: i * spacing,
        y: 0
      }
    }
  }

  static calculateHierarchicalLayout(nodes: ChainNode[], edges: ChainEdge[]): void {
    // Simple hierarchical layout - could be enhanced with proper graph algorithms
    const levels = new Map<string, number>()
    const spacing = { x: 150, y: 100 }

    // Assign levels
    for (const node of nodes) {
      levels.set(node.id, 0)
    }

    for (const edge of edges) {
      const sourceLevel = levels.get(edge.source) || 0
      const targetLevel = levels.get(edge.target) || 0
      levels.set(edge.target, Math.max(targetLevel, sourceLevel + 1))
    }

    // Position nodes
    const levelCounts = new Map<number, number>()
    for (const node of nodes) {
      const level = levels.get(node.id) || 0
      const count = levelCounts.get(level) || 0

      node.position = {
        x: count * spacing.x,
        y: level * spacing.y
      }

      levelCounts.set(level, count + 1)
    }
  }

  static calculateNetworkLayout(nodes: ChainNode[], edges: ChainEdge[]): void {
    // Simple force-directed layout simulation
    const center = { x: 200, y: 200 }
    const radius = 150

    for (let i = 0; i < nodes.length; i++) {
      const angle = (i / nodes.length) * 2 * Math.PI
      nodes[i].position = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      }
    }
  }

  static calculateChainDepth(chain: MovementChainTracking): number {
    // Calculate maximum depth of the chain
    let maxDepth = 1
    const visited = new Set<number>()

    const calculateDepth = (movementId: number, currentDepth: number): number => {
      if (visited.has(movementId)) return currentDepth

      visited.add(movementId)
      const chainedMovement = chain.movements.find(m => m.movementId === movementId)

      if (!chainedMovement || chainedMovement.childMovementIds.length === 0) {
        return currentDepth
      }

      let maxChildDepth = currentDepth
      for (const childId of chainedMovement.childMovementIds) {
        const childDepth = calculateDepth(childId, currentDepth + 1)
        maxChildDepth = Math.max(maxChildDepth, childDepth)
      }

      return maxChildDepth
    }

    for (const movement of chain.movements) {
      maxDepth = Math.max(maxDepth, calculateDepth(movement.movementId, 1))
    }

    return maxDepth
  }

  static calculateChainBreadth(chain: MovementChainTracking): number {
    // Calculate maximum breadth at any level
    const levels = new Map<number, number>()

    for (const movement of chain.movements) {
      const level = movement.chainPosition
      levels.set(level, (levels.get(level) || 0) + 1)
    }

    return Math.max(...levels.values())
  }

  // Summary Generation
  static async generateHistorySummary(
    movementId: number,
    timeline: EnhancedTimelineEntry[],
    relatedMovements: RelatedMovementInfo[]
  ): Promise<HistorySummary> {
    try {
      const movement = await dbClient.stockMovement.findUnique({
        where: { id: movementId },
        include: {
          warehouse: { select: { name: true } }
        }
      })

      if (!movement) {
        throw new Error(`Movement ${movementId} not found`)
      }

      // Calculate totals
      const totalQuantityChange = Math.abs(movement.quantity) +
        relatedMovements.reduce((sum, rm) => sum + Math.abs(rm.movementId), 0) // Simplified

      const totalValueChange = movement.rrpAtTime
        ? parseFloat(movement.rrpAtTime.toString()) * Math.abs(movement.quantity)
        : 0

      // Get time span
      const allTimestamps = [
        movement.movementDate,
        ...timeline.map(t => t.timestamp),
        ...relatedMovements.map(rm => rm.timestamp)
      ].sort((a, b) => a.getTime() - b.getTime())

      const timeSpan = {
        start: allTimestamps[0],
        end: allTimestamps[allTimestamps.length - 1],
        duration: allTimestamps[allTimestamps.length - 1].getTime() - allTimestamps[0].getTime()
      }

      // Get unique warehouses and movement types
      const warehouses = [movement.warehouse.name]
      const movementTypes = [movement.movementType]

      // Generate key milestones
      const keyMilestones = this.generateKeyMilestones(timeline, movement)

      return {
        totalMovements: 1 + relatedMovements.length,
        totalQuantityChange,
        totalValueChange,
        timeSpan,
        warehouses: [...new Set(warehouses)],
        movementTypes: [...new Set(movementTypes)],
        keyMilestones
      }
    } catch (error) {
      throw new Error(`Failed to generate history summary: ${error}`)
    }
  }

  static generateKeyMilestones(timeline: EnhancedTimelineEntry[], movement: StockMovement): Milestone[] {
    const milestones: Milestone[] = []

    // Add creation milestone
    milestones.push({
      timestamp: movement.createdAt,
      description: 'Movement created',
      type: 'FIRST_MOVEMENT',
      impact: 'MEDIUM'
    })

    // Add execution milestone
    milestones.push({
      timestamp: movement.movementDate,
      description: 'Movement executed',
      type: 'FIRST_MOVEMENT',
      impact: 'HIGH'
    })

    // Add high-impact timeline events as milestones
    for (const entry of timeline) {
      if (entry.impact === 'HIGH' || entry.impact === 'CRITICAL') {
        milestones.push({
          timestamp: entry.timestamp,
          description: entry.description,
          type: this.getMilestoneType(entry),
          impact: entry.impact,
          data: entry.metadata
        })
      }
    }

    return milestones.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  static getMilestoneType(entry: EnhancedTimelineEntry): MilestoneType {
    if (entry.category === 'TRANSFER') return 'WAREHOUSE_TRANSFER'
    if (entry.category === 'ADJUSTMENT') return 'LARGE_ADJUSTMENT'
    if (entry.action.includes('BATCH')) return 'BATCH_COMPLETION'
    if (entry.action.includes('THRESHOLD')) return 'THRESHOLD_BREACH'
    return 'FIRST_MOVEMENT'
  }

  // Filtering and Search
  static async getFilteredTimeline(
    movementId: number,
    filters: TimelineFilterOptions
  ): Promise<EnhancedTimelineEntry[]> {
    const visualization = await this.generateMovementHistoryVisualization(movementId)
    let timeline = visualization.timeline

    if (filters.categories && filters.categories.length > 0) {
      timeline = timeline.filter(entry => filters.categories!.includes(entry.category))
    }

    if (filters.impactLevels && filters.impactLevels.length > 0) {
      timeline = timeline.filter(entry => filters.impactLevels!.includes(entry.impact))
    }

    if (filters.dateRange) {
      timeline = timeline.filter(entry =>
        entry.timestamp >= filters.dateRange!.start && entry.timestamp <= filters.dateRange!.end
      )
    }

    if (!filters.includeSystemEvents) {
      timeline = timeline.filter(entry => entry.category !== 'SYSTEM')
    }

    return timeline
  }

  // Export and Sharing
  static async exportTimelineData(
    movementId: number,
    format: 'json' | 'csv' | 'pdf' = 'json'
  ): Promise<string> {
    const visualization = await this.generateMovementHistoryVisualization(movementId)

    switch (format) {
      case 'json':
        return JSON.stringify(visualization, null, 2)
      case 'csv':
        return this.convertTimelineToCSV(visualization.timeline)
      case 'pdf':
        // Would implement PDF generation
        throw new Error('PDF export not implemented')
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  static convertTimelineToCSV(timeline: EnhancedTimelineEntry[]): string {
    const headers = ['timestamp', 'action', 'description', 'category', 'impact', 'performedBy']
    const rows = timeline.map(entry => [
      entry.timestamp.toISOString(),
      entry.action,
      entry.description,
      entry.category,
      entry.impact,
      entry.performedBy || ''
    ])

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  }
}

export default MovementTimelineService