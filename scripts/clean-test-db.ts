import { testDb, cleanDatabase } from '../src/test/utils/test-db'

async function main() {
  console.log('Cleaning test database...')
  await cleanDatabase()
  await testDb.$disconnect()
  console.log('Test database cleaned successfully')
}

main().catch(console.error)
