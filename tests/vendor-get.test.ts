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

describe('GET /api/vendors/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorServiceMock.getVendorById.mockResolvedValue(vendor);
  });

  it('returns a vendor when its ID exists', async () => {
    const response = await request(app).get(`/api/vendors/${vendor.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(vendor);
    expect(vendorServiceMock.getVendorById).toHaveBeenCalledWith(vendor.id);
  });

  it('returns 404 when the vendor does not exist', async () => {
    vendorServiceMock.getVendorById.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/vendors/missing-id');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Vendor not found' });
  });
});
