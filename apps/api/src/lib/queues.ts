import { Queue } from 'bullmq';
import { redis } from './redis.js';

export const exportQueue = new Queue('export-queue', { connection: redis });
export const llmQueue = new Queue('llm-queue', { connection: redis });
