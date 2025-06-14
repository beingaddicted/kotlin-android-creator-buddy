
const QueueManager = require('../managers/QueueManager');

describe('QueueManager', () => {
  let qm;
  beforeEach(() => {
    qm = new QueueManager();
  });

  test('can queue and clear requests', () => {
    qm.queueConnectionRequest('c1', 'r1', 'a1', 'offerData');
    expect(qm.getQueuedRequests('c1')).toHaveLength(1);

    qm.clearQueue('c1');
    expect(qm.getQueuedRequests('c1')).toHaveLength(0);
  });

  test('evicts old requests if over limit', () => {
    for (let i = 0; i < 12; i++) {
      qm.queueConnectionRequest('c1', `r${i}`, 'a1', {});
    }
    expect(qm.getQueuedRequests('c1').length).toBeLessThanOrEqual(10);
  });

  test('cleanupStaleRequests removes stale', () => {
    const now = Date.now();
    qm.queuedRequests.set('c2', [
      { requestId: 'r2', adminId: 'a2', offerData: {}, timestamp: now - 1000000 },
      { requestId: 'r3', adminId: 'a2', offerData: {}, timestamp: now }
    ]);
    qm.cleanupStaleRequests(60000);
    expect(qm.getQueuedRequests('c2').length).toBe(1);
  });

  test('getQueueStats returns sum', () => {
    qm.queueConnectionRequest('c1', 'r1', 'a1', {});
    qm.queueConnectionRequest('c2', 'r2', 'a2', {});
    expect(qm.getQueueStats()).toBe(2);
  });
});
