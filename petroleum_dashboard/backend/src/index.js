import dotenv from 'dotenv';
import app from './core/server.js';
import { errorMiddleware } from './core/error.js';

dotenv.config();

const port = Number(process.env.PORT || 4000);

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

