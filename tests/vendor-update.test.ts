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

describe('PUT /api/vendors/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorServiceMock.updateVendor.mockResolvedValue(vendor);
  });

  it('rejects an update with no fields', async () => {
    const response = await request(app).put(`/api/vendors/${vendor.id}`).send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Invalid input data',
      details: expect.arrayContaining([
        expect.objectContaining({ message: 'At least one field is required to update' }),
      ]),
    });
    expect(vendorServiceMock.updateVendor).not.toHaveBeenCalled();
  });

  it('rejects an invalid website URL', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({ website: 'not-a-url' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input data');
    expect(vendorServiceMock.updateVendor).not.toHaveBeenCalled();
  });

  it('rejects a non-string name', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({ name: 42 });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid input data');
    expect(vendorServiceMock.updateVendor).not.toHaveBeenCalled();
  });

  it('updates provided vendor fields', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({ name: 'Updated Vendor', website: 'https://updated.example' });

    expect(response.status).toBe(200);
    expect(vendorServiceMock.updateVendor).toHaveBeenCalledWith(vendor.id, {
      name: 'Updated Vendor',
      website: 'https://updated.example',
    });
  });

  it('allows clearing nullable fields with null', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({ website: null, description: null });

    expect(response.status).toBe(200);
    expect(vendorServiceMock.updateVendor).toHaveBeenCalledWith(vendor.id, {
      website: null,
      description: null,
    });
  });

  it('returns 404 when updating a vendor that does not exist', async () => {
    vendorServiceMock.updateVendor.mockResolvedValueOnce(null);

    const response = await request(app)
      .put('/api/vendors/missing-id')
      .send({ name: 'Updated name' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Vendor not found' });
  });
});
