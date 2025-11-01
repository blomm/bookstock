
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: {
      email: 'mike_geomatics@yahoo.com',
    },
    include: {
      userRoles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (user) {
    console.log(`User: ${user.email}`);
    if (user.userRoles.length > 0) {
      user.userRoles.forEach((userRole) => {
        console.log(`  Role: ${userRole.role.name}`);
      });
    } else {
      console.log('  No roles assigned');
    }
  } else {
    console.log('User not found');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
