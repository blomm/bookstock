import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedRoles() {
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
    where: { name: 'read_only_user' },
    update: {
      description: 'View-only access for stakeholders and junior team members',
      permissions: [
        'title:read',
        'inventory:read',
        'report:read'
      ]
    },
    create: {
      name: 'read_only_user',
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

  console.log('🎉 Role seeding completed successfully!')
}

seedRoles()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Role seeding failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
