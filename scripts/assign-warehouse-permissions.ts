import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking Admin role permissions...\n')

  // Get Admin role
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })

  if (!adminRole) {
    console.log('❌ Admin role not found!')
    console.log('Run: npm run db:seed to create default roles')
    return
  }

  console.log('✅ Admin role found')
  console.log('Permissions:', adminRole.permissions)

  // Check if warehouse permissions are included
  const permissions = adminRole.permissions as string[]
  const hasWarehouseRead = permissions.includes('warehouse:read')
  const hasWarehouseCreate = permissions.includes('warehouse:create')
  const hasWarehouseUpdate = permissions.includes('warehouse:update')
  const hasWarehouseDelete = permissions.includes('warehouse:delete')

  console.log('\nWarehouse Permissions Check:')
  console.log('  warehouse:read:', hasWarehouseRead ? '✅' : '❌')
  console.log('  warehouse:create:', hasWarehouseCreate ? '✅' : '❌')
  console.log('  warehouse:update:', hasWarehouseUpdate ? '✅' : '❌')
  console.log('  warehouse:delete:', hasWarehouseDelete ? '✅' : '❌')

  // If missing, add them
  if (!hasWarehouseRead || !hasWarehouseCreate || !hasWarehouseUpdate || !hasWarehouseDelete) {
    console.log('\n⚠️  Adding missing warehouse permissions to Admin role...')

    const updatedPermissions = Array.from(new Set([
      ...permissions,
      'warehouse:read',
      'warehouse:create',
      'warehouse:update',
      'warehouse:delete'
    ]))

    await prisma.role.update({
      where: { name: 'Admin' },
      data: { permissions: updatedPermissions }
    })

    console.log('✅ Warehouse permissions added to Admin role')
  }

  // Check users
  console.log('\n\nChecking users with Admin role...')
  const admins = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  })

  const adminUsers = admins.filter(user =>
    user.userRoles.some(ur => ur.role.name === 'Admin')
  )

  if (adminUsers.length === 0) {
    console.log('❌ No users with Admin role found!')
    console.log('\nTo assign Admin role to your user, go to:')
    console.log('http://localhost:3000/admin/users')
  } else {
    console.log(`\n✅ Found ${adminUsers.length} admin user(s):`)
    adminUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.firstName} ${user.lastName})`)
    })
  }

  console.log('\n✨ Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
