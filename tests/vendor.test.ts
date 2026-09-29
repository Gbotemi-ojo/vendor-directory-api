import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';

// Minimal Express app for testing purposes
const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

describe('Vendor API', () => {
  it('should pass a basic health check', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
