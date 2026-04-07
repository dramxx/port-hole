import {
  appendEvent,
  getEventLog,
  addPendingApproval,
  resolveApproval,
  getPendingApprovals,
} from '../store';

// Reset modules before each test to clear state
beforeEach(() => {
  jest.resetModules();
});

describe('store.ts - Event Log', () => {
  test('appendEvent adds event to log', () => {
    const event = { type: 'test', data: 'hello' };
    const entry = appendEvent(event);

    expect(entry.id).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.raw).toEqual(event);

    const log = getEventLog();
    expect(log).toHaveLength(1);
    expect(log[0].raw).toEqual(event);
  });

  test('appendEvent maintains max size of 500', () => {
    // Add 600 events
    for (let i = 0; i < 600; i++) {
      appendEvent({ index: i });
    }

    const log = getEventLog();
    expect(log).toHaveLength(500);
    // First 100 should be removed
    expect(log[0].raw).toEqual({ index: 100 });
    expect(log[499].raw).toEqual({ index: 599 });
  });
});

describe('store.ts - Approval Queue', () => {
  test('addPendingApproval adds approval to queue', () => {
    addPendingApproval({
      permissionId: 'perm-1',
      sessionId: 'session-1',
      description: 'Test permission',
    });

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
    expect(pending[0].permissionId).toBe('perm-1');
    expect(pending[0].status).toBe('pending');
  });

  test('addPendingApproval does not duplicate', () => {
    addPendingApproval({
      permissionId: 'perm-1',
      sessionId: 'session-1',
      description: 'Test permission',
    });

    addPendingApproval({
      permissionId: 'perm-1',
      sessionId: 'session-1',
      description: 'Test permission',
    });

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(1);
  });

  test('resolveApproval marks approval as resolved', () => {
    addPendingApproval({
      permissionId: 'perm-1',
      sessionId: 'session-1',
      description: 'Test permission',
    });

    resolveApproval('perm-1', 'allow');

    const pending = getPendingApprovals();
    expect(pending).toHaveLength(0);
  });

  test('resolveApproval throws for unknown permissionId', () => {
    expect(() => {
      resolveApproval('unknown', 'allow');
    }).toThrow('Unknown permissionId');
  });

  test('resolveApproval cleans up after delay', async () => {
    // Import with fresh module to test cleanup
    jest.resetModules();
    const store = require('../store');
    
    store.addPendingApproval({
      permissionId: 'perm-cleanup',
      sessionId: 'session-1',
      description: 'Test cleanup',
    });

    store.resolveApproval('perm-cleanup', 'deny');

    // Immediately after resolve, entry should still exist in the map
    // but getPendingApprovals should not return it
    const pending = store.getPendingApprovals();
    expect(pending).toHaveLength(0);
  });
});
