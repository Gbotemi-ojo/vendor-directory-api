import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import vendorRoutes from './routes/vendor.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/vendors', vendorRoutes);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}

export default app;
