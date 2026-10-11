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

describe('Vendor API endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorServiceMock.getAllVendors.mockResolvedValue([vendor]);
    vendorServiceMock.getVendorById.mockResolvedValue(vendor);
    vendorServiceMock.updateVendor.mockResolvedValue(vendor);
    vendorServiceMock.refreshVendor.mockResolvedValue(vendor);
  });

  it('returns a successful health check', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('lists vendors when no search term is provided', async () => {
    const response = await request(app).get('/api/vendors');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([vendor]);
    expect(vendorServiceMock.getAllVendors).toHaveBeenCalledWith(undefined);
  });

  it('trims and forwards a search term', async () => {
    const response = await request(app).get('/api/vendors?search=%20example%20');

    expect(response.status).toBe(200);
    expect(vendorServiceMock.getAllVendors).toHaveBeenCalledWith(' example ');
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

  it('returns a vendor when its ID exists', async () => {
    const response = await request(app).get(`/api/vendors/${vendor.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(vendor);
    expect(vendorServiceMock.getVendorById).toHaveBeenCalledWith(vendor.id);
  });

  it('returns 404 when a vendor ID does not exist', async () => {
    vendorServiceMock.getVendorById.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/vendors/missing-id');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Vendor not found' });
  });

  it('rejects an update with no provided fields', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({});

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
    expect(response.body).toMatchObject({
      error: 'Invalid input data',
      details: expect.arrayContaining([
        expect.objectContaining({ path: ['website'] }),
      ]),
    });
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

  it('allows clearing nullable fields with null', async () => {
    const response = await request(app)
      .put(`/api/vendors/${vendor.id}`)
      .send({ website: null, description: null });

    expect(response.status).toBe(200);
    expect(vendorServiceMock.updateVendor).toHaveBeenCalledWith(vendor.id, {
      slug: undefined,
      name: undefined,
      website: null,
      description: null,
    });
  });

  it('returns 404 when updating a missing vendor', async () => {
    vendorServiceMock.updateVendor.mockResolvedValueOnce(null);

    const response = await request(app)
      .put('/api/vendors/missing-id')
      .send({ name: 'Updated name' });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Vendor not found' });
  });

  it('refreshes a vendor and returns the refreshed record', async () => {
    const response = await request(app).post(`/api/vendors/${vendor.id}/refresh`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(vendor);
    expect(vendorServiceMock.refreshVendor).toHaveBeenCalledWith(vendor.id);
  });

  it('returns a refresh error when the service fails', async () => {
    vendorServiceMock.refreshVendor.mockRejectedValueOnce(new Error('Vendor is missing a slug identifier.'));

    const response = await request(app).post(`/api/vendors/${vendor.id}/refresh`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Vendor is missing a slug identifier.' });
  });
});
