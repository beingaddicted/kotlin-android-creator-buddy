
const AdminManager = require('../managers/AdminManager');

describe('AdminManager', () => {
  let am, clientManager, historyManager, ws;

  beforeEach(() => {
    am = new AdminManager();
    clientManager = { getClient: jest.fn() };
    historyManager = { getHistory: jest.fn() };
    ws = { send: jest.fn() };
    am.setManagers(clientManager, historyManager);
  });

  test('registers admin and sends client list', () => {
    am.registerAdmin(ws, { adminId: 'a2', organizationId: 'o9' });
    expect(ws.send).toHaveBeenCalledWith(expect.any(String));
    expect(am.getAdmin('a2')).toBeDefined();
  });

  test('sendEnhancedClientList works', () => {
    const c = { userName: 'u', status: 'online', lastSeen: 42 };
    am.admins.set('A', { ws, organizationId: 'Z', clientIds: ['C'], lastSeen: 44, connectionHistory: [] });
    clientManager.getClient.mockReturnValue(c);
    historyManager.getHistory.mockReturnValue([{ status: 'accepted' }]);
    am.sendEnhancedClientList('A');
    expect(ws.send).toHaveBeenCalledWith(expect.any(String));
  });

  test('sendPendingNotifications for recently online client', () => {
    const now = Date.now();
    const client = { status: 'online', lastSeen: now, userName: 'John' };
    am.admins.set('B', { ws, clientIds: ['C'], lastSeen: now, organizationId: 'Q', connectionHistory: [] });
    clientManager.getClient.mockReturnValue(client);

    am.sendPendingNotifications('B');
    expect(ws.send).toHaveBeenCalledWith(expect.any(String));
  });

});
