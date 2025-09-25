import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import routes from '../routes/index.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(express.json());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || '*',
    credentials: false,
  })
);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api', routes);

export default app;

