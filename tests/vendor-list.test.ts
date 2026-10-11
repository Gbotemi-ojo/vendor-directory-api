import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const vendorServiceMock = vi.hoisted(() => ({
  getAllVendors: vi.fn(),
  getVendorById: vi.fn(),
  updateVendor: vi.fn(),
  refreshVendor: vi.fn(),
}));

vi.mock('../src/services/vendor.service.js', () => ({
  vendorService: vendorServiceMock,
}));

import app from '../src/index.js';

const vendor = {
  id: 'vendor-test-id',
  slug: 'example-vendor',
  name: 'Example Vendor',
  website: 'https://example.com',
  description: 'Example vendor description',
};

describe('GET /api/vendors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorServiceMock.getAllVendors.mockResolvedValue({
      data: [vendor],
      meta: { total: 1, page: 1, limit: 24, totalPages: 1 },
    });
  });

  it('returns the paginated vendor response with default pagination', async () => {
    const response = await request(app).get('/api/vendors');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [vendor],
      meta: { total: 1, page: 1, limit: 24, totalPages: 1 },
    });
    expect(vendorServiceMock.getAllVendors).toHaveBeenCalledWith(undefined, 1, 24);
  });

  it('forwards search and coerced pagination parameters', async () => {
    const response = await request(app).get(
      '/api/vendors?search=%20example%20&page=3&limit=12',
    );

    expect(response.status).toBe(200);
    expect(vendorServiceMock.getAllVendors).toHaveBeenCalledWith(' example ', 3, 12);
  });

  it('rejects pagination values outside the accepted range', async () => {
    const response = await request(app).get('/api/vendors?page=0&limit=101');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input data');
    expect(vendorServiceMock.getAllVendors).not.toHaveBeenCalled();
  });

  it('rejects a non-string search query', async () => {
    const response = await request(app).get('/api/vendors?search[]=example');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid input data',
      details: expect.arrayContaining([expect.any(Object)]),
    });
    expect(vendorServiceMock.getAllVendors).not.toHaveBeenCalled();
  });
});
