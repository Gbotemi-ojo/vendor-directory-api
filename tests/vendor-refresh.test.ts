import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(function RedisMock() {
    return {
      call: vi.fn().mockResolvedValue('OK'),
      quit: vi.fn().mockResolvedValue('OK'),
      on: vi.fn(),
    };
  }),
}));

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function QueueMock() {
    return {
      add: vi.fn().mockResolvedValue({ id: 'mock-job-123' }),
      close: vi.fn(),
    };
  }),
  Worker: vi.fn().mockImplementation(function WorkerMock() {
    return {
      on: vi.fn(),
      close: vi.fn(),
    };
  }),
}));

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

const vendorId = 'refresh-test-vendor-id';
const testIp = '198.51.100.225';

describe('POST /api/vendors/:id/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vendorServiceMock.refreshVendor.mockResolvedValue({ jobId: 'refresh-job-123' });
  });

  it('queues a vendor refresh and returns 202 with the job ID', async () => {
    const response = await request(app).post(`/api/vendors/${vendorId}/refresh`);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      message: 'Vendor refresh job queued',
      jobId: 'refresh-job-123',
    });
    expect(vendorServiceMock.refreshVendor).toHaveBeenCalledWith(vendorId);
  });

  it('returns an error when the service fails to enqueue the job', async () => {
    vendorServiceMock.refreshVendor.mockRejectedValueOnce(
      new Error('Vendor is missing a slug identifier.'),
    );

    const response = await request(app).post(`/api/vendors/${vendorId}/refresh`);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Vendor is missing a slug identifier.' });
  });

  it('limits refresh requests from one IP', async () => {
    const limit = process.env.NODE_ENV === 'test' ? 100 : 3;
    let lastResponse;

    for (let requestNumber = 0; requestNumber <= limit; requestNumber += 1) {
      lastResponse = await request(app)
        .post(`/api/vendors/${vendorId}/refresh`)
        .set('X-Forwarded-For', testIp);
    }

    expect(lastResponse?.status).toBe(429);
    expect(vendorServiceMock.refreshVendor).toHaveBeenCalledTimes(limit);
  });
});
