import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Create the three main warehouses
  console.log('📦 Creating warehouses...')

  const turnaround = await prisma.warehouse.upsert({
    where: { code: 'TRN' },
    update: {},
    create: {
      name: 'Turnaround',
      code: 'TRN',
      location: 'UK',
      fulfillsChannels: ['UK_TRADE_SALES', 'ROW_TRADE_SALES'],
      isActive: true
    }
  })

  const acc = await prisma.warehouse.upsert({
    where: { code: 'ACC' },
    update: {},
    create: {
      name: 'ACC',
      code: 'ACC',
      location: 'US',
      fulfillsChannels: ['US_TRADE_SALES'],
      isActive: true
    }
  })

  const flostream = await prisma.warehouse.upsert({
    where: { code: 'FLS' },
    update: {},
    create: {
      name: 'Flostream',
      code: 'FLS',
      location: 'UK',
      fulfillsChannels: ['ONLINE_SALES'],
      isActive: true
    }
  })

  console.log('✅ Created warehouses:', {
    turnaround: turnaround.name,
    acc: acc.name,
    flostream: flostream.name
  })

  // Create example series for testing
  console.log('📚 Creating example series...')

  const opinionatedGuides = await prisma.series.upsert({
    where: { name: 'Opinionated Guides' },
    update: {},
    create: {
      name: 'Opinionated Guides',
      description: 'Technical guide series covering various programming topics'
    }
  })

  const photoStories = await prisma.series.upsert({
    where: { name: 'East London Photo Stories' },
    update: {},
    create: {
      name: 'East London Photo Stories',
      description: 'Photography series documenting East London culture'
    }
  })

  console.log('✅ Created series:', {
    opinionated: opinionatedGuides.name,
    photo: photoStories.name
  })

  // Create printing companies
  console.log('🖨️ Creating printing companies...')

  const lightningSourceUK = await prisma.printer.upsert({
    where: { code: 'LSUK' },
    update: {},
    create: {
      name: 'Lightning Source UK',
      code: 'LSUK',
      location: 'Milton Keynes, UK',
      contactEmail: 'customer.service@lightningsource.com',
      contactPhone: '+44 1908 844100',
      website: 'https://www.lightningsource.com',
      specialties: ['Print-on-Demand', 'Digital Printing', 'Distribution', 'Paperback', 'Hardcover'],
      isActive: true,
      notes: 'Primary UK printer for POD titles. Excellent turnaround times and quality.'
    }
  })

  const pureprintGroup = await prisma.printer.upsert({
    where: { code: 'PPG' },
    update: {},
    create: {
      name: 'Pureprint Group',
      code: 'PPG',
      location: 'Uckfield, East Sussex, UK',
      contactEmail: 'orders@pureprint.com',
      contactPhone: '+44 1825 768611',
      website: 'https://www.pureprint.com',
      specialties: ['Offset Printing', 'Digital Printing', 'Perfect Binding', 'Case Binding', 'Large Format'],
      isActive: true,
      notes: 'High-quality offset printer specializing in hardcover books and large print runs.'
    }
  })

  const lightningSourceUS = await prisma.printer.upsert({
    where: { code: 'LSUS' },
    update: {},
    create: {
      name: 'Lightning Source US',
      code: 'LSUS',
      location: 'La Vergne, TN, USA',
      contactEmail: 'customer.service@lightningsource.com',
      contactPhone: '+1 615 213 5815',
      website: 'https://www.lightningsource.com',
      specialties: ['Print-on-Demand', 'Digital Printing', 'Distribution', 'Paperback'],
      isActive: true,
      notes: 'US division of Lightning Source for POD distribution in North America.'
    }
  })

  console.log('✅ Created printers:', {
    lightningUK: lightningSourceUK.name,
    pureprint: pureprintGroup.name,
    lightningUS: lightningSourceUS.name
  })

  // Create a few example titles with comprehensive metadata
  console.log('📖 Creating example titles...')

  const title1 = await prisma.title.upsert({
    where: { isbn: '9781234567890' },
    update: {},
    create: {
      isbn: '9781234567890',
      title: 'The Opinionated Guide to TypeScript',
      author: 'Jane Developer',
      format: 'PAPERBACK',
      rrp: 34.99,
      unitCost: 8.75,
      pageCount: 456,
      publicationDate: new Date('2024-03-15'),
      publisher: 'Tech Books Ltd',
      category: 'Technology',
      subcategory: 'Programming',
      dimensions: '234x156x28',
      weight: 650,
      bindingType: 'Perfect bound',
      coverFinish: 'Matte',
      tradeDiscount: 45.0,
      royaltyRate: 12.5,
      royaltyThreshold: 2000,
      printRunSize: 3000,
      reprintThreshold: 600,
      description: 'A comprehensive guide to TypeScript for modern web development',
      keywords: 'typescript, javascript, programming, web development',
      language: 'en-GB',
      territoryRights: 'UK, Ireland, Europe',
      seriesId: opinionatedGuides.id
    }
  })

  const title2 = await prisma.title.upsert({
    where: { isbn: '9780987654321' },
    update: {},
    create: {
      isbn: '9780987654321',
      title: 'Brick Lane Chronicles',
      author: 'Alex Photographer',
      format: 'HARDCOVER',
      rrp: 49.99,
      unitCost: 12.50,
      pageCount: 280,
      publicationDate: new Date('2024-01-20'),
      publisher: 'Urban Stories Press',
      category: 'Photography',
      subcategory: 'Documentary',
      dimensions: '280x210x25',
      weight: 1200,
      bindingType: 'Case bound',
      coverFinish: 'Gloss',
      tradeDiscount: 40.0,
      royaltyRate: 15.0,
      royaltyThreshold: 1500,
      printRunSize: 2000,
      reprintThreshold: 400,
      description: 'A photographic journey through the heart of East London',
      keywords: 'photography, london, documentary, street photography',
      language: 'en-GB',
      territoryRights: 'World',
      seriesId: photoStories.id
    }
  })

  console.log('✅ Created titles:', {
    typescript: title1.title,
    photography: title2.title
  })

  // Create price history for titles
  console.log('💰 Creating price history...')

  // TypeScript book price history - started at 29.99, increased to 34.99
  await prisma.priceHistory.create({
    data: {
      titleId: title1.id,
      rrp: 29.99,
      unitCost: 8.75,
      tradeDiscount: 45.0,
      effectiveFrom: new Date('2024-03-15'),
      effectiveTo: new Date('2024-05-01'),
      reason: 'Launch price'
    }
  })

  await prisma.priceHistory.create({
    data: {
      titleId: title1.id,
      rrp: 34.99,
      unitCost: 8.75,
      tradeDiscount: 45.0,
      effectiveFrom: new Date('2024-05-01'),
      effectiveTo: null, // Current price
      reason: 'Price increase due to strong demand'
    }
  })

  // Photography book price history - single price point so far
  await prisma.priceHistory.create({
    data: {
      titleId: title2.id,
      rrp: 49.99,
      unitCost: 12.50,
      tradeDiscount: 40.0,
      effectiveFrom: new Date('2024-01-20'),
      effectiveTo: null, // Current price
      reason: 'Launch price'
    }
  })

  console.log('✅ Created price history records')

  // Create initial inventory records for the titles
  console.log('📊 Creating initial inventory...')

  // TypeScript book inventory across warehouses
  await prisma.inventory.upsert({
    where: {
      titleId_warehouseId: {
        titleId: title1.id,
        warehouseId: turnaround.id
      }
    },
    update: {},
    create: {
      titleId: title1.id,
      warehouseId: turnaround.id,
      currentStock: 2400,
      reservedStock: 50,
      lastMovementDate: new Date('2024-03-15')
    }
  })

  await prisma.inventory.upsert({
    where: {
      titleId_warehouseId: {
        titleId: title1.id,
        warehouseId: acc.id
      }
    },
    update: {},
    create: {
      titleId: title1.id,
      warehouseId: acc.id,
      currentStock: 450,
      reservedStock: 25,
      lastMovementDate: new Date('2024-03-15')
    }
  })

  await prisma.inventory.upsert({
    where: {
      titleId_warehouseId: {
        titleId: title1.id,
        warehouseId: flostream.id
      }
    },
    update: {},
    create: {
      titleId: title1.id,
      warehouseId: flostream.id,
      currentStock: 150,
      reservedStock: 10,
      lastMovementDate: new Date('2024-03-15')
    }
  })

  // Photography book inventory
  await prisma.inventory.upsert({
    where: {
      titleId_warehouseId: {
        titleId: title2.id,
        warehouseId: turnaround.id
      }
    },
    update: {},
    create: {
      titleId: title2.id,
      warehouseId: turnaround.id,
      currentStock: 1600,
      reservedStock: 20,
      lastMovementDate: new Date('2024-01-20')
    }
  })

  await prisma.inventory.upsert({
    where: {
      titleId_warehouseId: {
        titleId: title2.id,
        warehouseId: flostream.id
      }
    },
    update: {},
    create: {
      titleId: title2.id,
      warehouseId: flostream.id,
      currentStock: 400,
      reservedStock: 15,
      lastMovementDate: new Date('2024-01-20')
    }
  })

  console.log('✅ Created initial inventory records')

  // Create some example stock movements
  console.log('📈 Creating example stock movements...')

  // Initial print runs
  await prisma.stockMovement.create({
    data: {
      titleId: title1.id,
      warehouseId: turnaround.id,
      movementType: 'PRINT_RECEIVED',
      quantity: 3000,
      movementDate: new Date('2024-03-15'),
      printerId: lightningSourceUK.id,
      referenceNumber: 'LS-2024-001',
      notes: 'Initial print run for TypeScript guide'
    }
  })

  await prisma.stockMovement.create({
    data: {
      titleId: title2.id,
      warehouseId: turnaround.id,
      movementType: 'PRINT_RECEIVED',
      quantity: 2000,
      movementDate: new Date('2024-01-20'),
      printerId: pureprintGroup.id,
      referenceNumber: 'PP-2024-001',
      notes: 'Initial print run for photography book'
    }
  })

  // Some sales movements with financial snapshots
  await prisma.stockMovement.create({
    data: {
      titleId: title1.id,
      warehouseId: turnaround.id,
      movementType: 'UK_TRADE_SALES',
      quantity: -350,
      movementDate: new Date('2024-03-20'),
      rrpAtTime: 29.99, // Price at time of sale (before increase)
      unitCostAtTime: 8.75,
      tradeDiscountAtTime: 45.0,
      referenceNumber: 'SALES-2024-001',
      notes: 'March UK trade sales - at launch price'
    }
  })

  await prisma.stockMovement.create({
    data: {
      titleId: title1.id,
      warehouseId: flostream.id,
      movementType: 'ONLINE_SALES',
      quantity: -75,
      movementDate: new Date('2024-03-25'),
      rrpAtTime: 29.99, // Price at time of sale (before increase)
      unitCostAtTime: 8.75,
      tradeDiscountAtTime: 45.0,
      referenceNumber: 'ONLINE-2024-001',
      notes: 'March online sales - at launch price'
    }
  })

  // More recent sales at higher price
  await prisma.stockMovement.create({
    data: {
      titleId: title1.id,
      warehouseId: turnaround.id,
      movementType: 'UK_TRADE_SALES',
      quantity: -200,
      movementDate: new Date('2024-05-15'),
      rrpAtTime: 34.99, // Price at time of sale (after increase)
      unitCostAtTime: 8.75,
      tradeDiscountAtTime: 45.0,
      referenceNumber: 'SALES-2024-005',
      notes: 'May UK trade sales - at increased price'
    }
  })

  // Warehouse transfer
  await prisma.stockMovement.create({
    data: {
      titleId: title1.id,
      warehouseId: acc.id,
      movementType: 'WAREHOUSE_TRANSFER',
      quantity: 500,
      movementDate: new Date('2024-03-18'),
      sourceWarehouseId: turnaround.id,
      destinationWarehouseId: acc.id,
      referenceNumber: 'TRANSFER-2024-001',
      notes: 'Transfer to US for anticipated demand'
    }
  })

  console.log('✅ Created example stock movements')

  // Create authentication system roles
  console.log('👤 Creating system roles...')

  const adminRole = await prisma.role.upsert({
    where: { name: 'Admin' },
    update: {
      description: 'Full system access for system administrators',
      permissions: [
        'user:*',
        'role:*',
        'title:*',
        'inventory:*',
        'warehouse:*',
        'settings:*',
        'audit:read'
      ]
    },
    create: {
      name: 'Admin',
      description: 'Full system access for system administrators',
      permissions: [
        'user:*',
        'role:*',
        'title:*',
        'inventory:*',
        'warehouse:*',
        'settings:*',
        'audit:read'
      ],
      isSystem: true
    }
  })

  const operationsManagerRole = await prisma.role.upsert({
    where: { name: 'Operations Manager' },
    update: {
      description: 'Publishing operations team lead with broad inventory management access',
      permissions: [
        'title:read',
        'title:create',
        'title:update',
        'inventory:read',
        'inventory:update',
        'warehouse:read',
        'warehouse:update',
        'movement:read',
        'movement:create',
        'movement:approve',
        'report:read',
        'report:create',
        'user:read'
      ]
    },
    create: {
      name: 'Operations Manager',
      description: 'Publishing operations team lead with broad inventory management access',
      permissions: [
        'title:read',
        'title:create',
        'title:update',
        'inventory:read',
        'inventory:update',
        'warehouse:read',
        'warehouse:update',
        'movement:read',
        'movement:create',
        'movement:approve',
        'report:read',
        'report:create',
        'user:read'
      ],
      isSystem: true
    }
  })

  const inventoryClerkRole = await prisma.role.upsert({
    where: { name: 'Inventory Clerk' },
    update: {
      description: 'Staff member responsible for day-to-day inventory operations',
      permissions: [
        'title:read',
        'inventory:read',
        'inventory:update',
        'movement:read',
        'movement:create',
        'warehouse:read',
        'report:read'
      ]
    },
    create: {
      name: 'Inventory Clerk',
      description: 'Staff member responsible for day-to-day inventory operations',
      permissions: [
        'title:read',
        'inventory:read',
        'inventory:update',
        'movement:read',
        'movement:create',
        'warehouse:read',
        'report:read'
      ],
      isSystem: true
    }
  })

  const financialControllerRole = await prisma.role.upsert({
    where: { name: 'Financial Controller' },
    update: {
      description: 'Finance team member with access to financial data and reports',
      permissions: [
        'title:read',
        'inventory:read',
        'financial:read',
        'financial:create',
        'report:read',
        'report:create',
        'report:export',
        'royalty:read',
        'royalty:calculate'
      ]
    },
    create: {
      name: 'Financial Controller',
      description: 'Finance team member with access to financial data and reports',
      permissions: [
        'title:read',
        'inventory:read',
        'financial:read',
        'financial:create',
        'report:read',
        'report:create',
        'report:export',
        'royalty:read',
        'royalty:calculate'
      ],
      isSystem: true
    }
  })

  const readOnlyUserRole = await prisma.role.upsert({
    where: { name: 'Read-Only User' },
    update: {
      description: 'View-only access for stakeholders and junior team members',
      permissions: [
        'title:read',
        'inventory:read',
        'report:read'
      ]
    },
    create: {
      name: 'Read-Only User',
      description: 'View-only access for stakeholders and junior team members',
      permissions: [
        'title:read',
        'inventory:read',
        'report:read'
      ],
      isSystem: true
    }
  })

  console.log('✅ Created system roles:', {
    admin: adminRole.name,
    operationsManager: operationsManagerRole.name,
    inventoryClerk: inventoryClerkRole.name,
    financialController: financialControllerRole.name,
    readOnlyUser: readOnlyUserRole.name
  })

  console.log('🎉 Seed completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })