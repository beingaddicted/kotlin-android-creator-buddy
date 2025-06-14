
const HistoryManager = require('../managers/HistoryManager');

describe('HistoryManager', () => {
  let hm;
  beforeEach(() => {
    hm = new HistoryManager();
  });

  test('records and gets connection history', () => {
    hm.recordConnectionHistory('c1', 'a1', 'accepted');
    const h = hm.getHistory('c1');
    expect(h.length).toBe(1);
    expect(h[0]).toMatchObject({ adminId: 'a1', status: 'accepted' });
  });

  test('does not exceed 50 history entries', () => {
    for (let i = 0; i < 60; i++) {
      hm.recordConnectionHistory('c2', 'a1', 'accepted');
    }
    expect(hm.getHistory('c2').length).toBeLessThanOrEqual(50);
  });

  test('getClientHistory sends correct message', () => {
    const ws = { send: jest.fn() };
    hm.recordConnectionHistory('c3', 'a1', 'rejected');
    hm.getClientHistory(ws, { clientId: 'c3' });
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('client_history'));
  });
});
