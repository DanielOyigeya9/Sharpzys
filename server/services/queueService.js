/**
 * services/queueService.js
 * Singleton PQueue that enforces a concurrency limit of 1 on all
 * Playwright browser searches. Every search task is enqueued here.
 * Concurrency is configurable via QUEUE_CONCURRENCY in .env but
 * defaults to 1 — only one browser may run at a time.
 */

import PQueue from 'p-queue';
import logger from '../utils/logger.js';

const CONCURRENCY = parseInt(process.env.QUEUE_CONCURRENCY || '1', 10);

const queue = new PQueue({ concurrency: CONCURRENCY });

// Log when queue becomes idle (all tasks drained).
queue.on('idle', () => {
  logger.debug('Search queue idle — no pending tasks');
});

// Log every time a task is added so we can see queue depth.
queue.on('add', () => {
  logger.info('Task added to search queue', {
    size: queue.size,
    pending: queue.pending,
  });
});

// Log when a task finishes (resolves or rejects).
queue.on('next', () => {
  logger.info('Search queue task completed — next slot available', {
    size: queue.size,
    pending: queue.pending,
  });
});

/**
 * Enqueue a search task and wait for its result.
 *
 * @param {() => Promise<any>} task  An async function to execute in the queue.
 * @returns {Promise<any>}  Resolves with whatever the task resolves with.
 */
async function enqueue(task) {
  const position = queue.size + queue.pending;
  logger.info('Enqueueing browser search', { queuePosition: position });
  return queue.add(task);
}

/** Current number of tasks waiting (not yet started). */
function size() {
  return queue.size;
}

/** Current number of tasks actively running. */
function pending() {
  return queue.pending;
}

export default { enqueue, size, pending };
