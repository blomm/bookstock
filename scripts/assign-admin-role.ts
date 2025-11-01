import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignAdminRole() {
  // Get email from command line argument
  const email = process.argv[2]

  if (!email) {
    console.error('❌ Please provide an email address')
    console.log('Usage: npx tsx scripts/assign-admin-role.ts <email>')
    process.exit(1)
  }

  console.log(`🔍 Looking for user with email: ${email}`)

  // Find the user
  const user = await prisma.user.findUnique({
    where: { email },
    include: { userRoles: { include: { role: true } } }
  })

  if (!user) {
    console.error(`❌ User not found with email: ${email}`)
    console.log('\n💡 Make sure you have signed up at http://localhost:3000/sign-up first')
    process.exit(1)
  }

  console.log(`✅ Found user: ${user.name || user.email}`)

  // Find the Admin role
  const adminRole = await prisma.role.findUnique({
    where: { name: 'Admin' }
  })

  if (!adminRole) {
    console.error('❌ Admin role not found. Run: npm run db:seed')
    process.exit(1)
  }

  // Check if user already has the role
  const existingRole = user.userRoles.find(ur => ur.roleId === adminRole.id)

  if (existingRole) {
    console.log(`✅ User already has Admin role`)
  } else {
    // Assign the Admin role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id
      }
    })
    console.log(`✅ Assigned Admin role to ${user.name || user.email}`)
  }

  // Show current roles
  const updatedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { userRoles: { include: { role: true } } }
  })

  console.log('\n📋 User roles:')
  updatedUser?.userRoles.forEach(ur => {
    console.log(`  - ${ur.role.name}`)
  })

  console.log('\n🎉 Done! Refresh your browser to see the changes.')
}

assignAdminRole()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
