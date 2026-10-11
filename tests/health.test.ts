import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/services/vendor.service.js', () => ({
  vendorService: {
    getAllVendors: vi.fn(),
    getVendorById: vi.fn(),
    updateVendor: vi.fn(),
    refreshVendor: vi.fn(),
  },
}));

import app from '../src/index.js';

describe('Health endpoint', () => {
  it('returns a successful health check', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
