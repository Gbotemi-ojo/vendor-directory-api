import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
dotenv.config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env.DB_HOST as string,
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    database: process.env.DB_DATABASE as string,
    port: Number(process.env.DB_PORT) || 3306,
  },
});
