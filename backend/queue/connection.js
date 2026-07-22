import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

export function createConnection() {
  return new IORedis(REDIS_CONFIG);
}

export { REDIS_CONFIG };
