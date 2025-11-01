
import { test, expect } from '@playwright/test';

test.describe('Inventory API', () => {
  test('GET /api/inventory/dashboard should return inventory grouped by warehouse', async ({ request }) => {
    const response = await request.get('/api/inventory/dashboard');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/inventory/low-stock should return low stock items', async ({ request }) => {
    const response = await request.get('/api/inventory/low-stock');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('POST /api/stock-movements should create a new stock movement', async ({ request }) => {
    const response = await request.post('/api/stock-movements', {
      data: {
        titleId: 1,
        warehouseId: 1,
        quantity: 10,
        movementType: 'PRINT',
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toHaveProperty('data');
  });

  test('GET /api/stock-movements should return a list of stock movements', async ({ request }) => {
    const response = await request.get('/api/stock-movements');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('PATCH /api/titles/:id/stock-threshold should update the stock threshold for a title', async ({ request }) => {
    const response = await request.patch('/api/titles/1/stock-threshold', {
      data: {
        threshold: 10,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('data');
  });
});
