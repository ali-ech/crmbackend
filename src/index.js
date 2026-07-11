import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { startJobWorker } from './queues/jobQueue.js';
import { isRedisConfigured } from './config/redis.js';

await connectDB();

if (isRedisConfigured()) {
  startJobWorker();
} else {
  console.warn('REDIS_URL not set — background jobs disabled');
}

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});
