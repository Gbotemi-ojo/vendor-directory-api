import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import vendorRoutes from './routes/vendor.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount the vendor routes
app.use('/api/vendors', vendorRoutes);

// Basic health check for your Vitest file
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Only start the server if we are not running tests
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

export default app;
