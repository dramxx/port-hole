// Test the exponential backoff logic from opencode.ts
// We extract and test the algorithm without needing actual SSE connection

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const RECONNECT_JITTER_FACTOR = 0.2;

function calculateBackoffDelay(reconnectAttempts: number): number {
  const exponentialDelay = RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
  const cappedDelay = Math.min(exponentialDelay, RECONNECT_MAX_DELAY_MS);
  const jitter = cappedDelay * RECONNECT_JITTER_FACTOR * Math.random();
  return Math.floor(cappedDelay + jitter);
}

describe('opencode.ts - Exponential Backoff', () => {
  describe('calculateBackoffDelay', () => {
    test('first attempt uses base delay with jitter', () => {
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(calculateBackoffDelay(0));
      }
      
      // Base is 1000ms, jitter adds 0-200ms
      const min = Math.min(...delays);
      const max = Math.max(...delays);
      
      expect(min).toBeGreaterThanOrEqual(1000);
      expect(max).toBeLessThanOrEqual(1200);
    });

    test('second attempt doubles the delay', () => {
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(calculateBackoffDelay(1));
      }
      
      // Base is 2000ms, jitter adds 0-400ms
      const min = Math.min(...delays);
      const max = Math.max(...delays);
      
      expect(min).toBeGreaterThanOrEqual(2000);
      expect(max).toBeLessThanOrEqual(2400);
    });

    test('third attempt quadruples', () => {
      const delay = calculateBackoffDelay(2);
      // 4000ms + jitter
      expect(delay).toBeGreaterThanOrEqual(4000);
      expect(delay).toBeLessThanOrEqual(4800);
    });

    test('caps at max delay (30 seconds)', () => {
      // Many attempts should cap at 30 seconds
      const delay = calculateBackoffDelay(10);
      expect(delay).toBeGreaterThanOrEqual(30000);
      expect(delay).toBeLessThanOrEqual(36000); // 30000 + 20% jitter
    });

    test('exponential growth pattern', () => {
      const attempt0 = calculateBackoffDelay(0);
      const attempt1 = calculateBackoffDelay(1);
      const attempt2 = calculateBackoffDelay(2);
      const attempt3 = calculateBackoffDelay(3);
      
      // Each should roughly double (before jitter)
      expect(attempt1).toBeGreaterThan(attempt0);
      expect(attempt2).toBeGreaterThan(attempt1);
      expect(attempt3).toBeGreaterThan(attempt2);
    });

    test('jitter prevents thundering herd', () => {
      // Collect many delays for same attempt
      const delays = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        delays.add(calculateBackoffDelay(1));
      }
      
      // Should have many different values due to jitter
      expect(delays.size).toBeGreaterThan(50);
    });
  });

  describe('backoff constants', () => {
    test('base delay is 1 second', () => {
      expect(RECONNECT_BASE_DELAY_MS).toBe(1000);
    });

    test('max delay is 30 seconds', () => {
      expect(RECONNECT_MAX_DELAY_MS).toBe(30000);
    });

    test('jitter factor is 20%', () => {
      expect(RECONNECT_JITTER_FACTOR).toBe(0.2);
    });
  });
});
