import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/index';

describe('Vendor API Endpoints', () => {
  let testVendorId: string;

  it('should pass the health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('should fetch a list of vendors', async () => {
    const response = await request(app).get('/api/vendors');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Save an ID to use in the following tests
    testVendorId = response.body[0].id;
  });

  it('should fetch a single vendor by id', async () => {
    const response = await request(app).get(`/api/vendors/${testVendorId}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', testVendorId);
  });

  it('should update a vendor', async () => {
    const response = await request(app)
      .put(`/api/vendors/${testVendorId}`)
      .send({ name: 'Updated Vendor Name Test' });
    
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('Updated Vendor Name Test');
  });

  it('should search for the updated vendor', async () => {
    const response = await request(app).get('/api/vendors?search=Updated');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].name).toContain('Updated');
  });
});
