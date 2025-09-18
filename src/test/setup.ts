import '@testing-library/jest-dom'
import { beforeAll, afterAll, afterEach } from 'vitest'

// Mock environment variables for testing
beforeAll(() => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/bookstock_test'
})

afterEach(() => {
  // Clean up any test state
})

afterAll(() => {
  // Final cleanup
})