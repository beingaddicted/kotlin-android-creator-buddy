
const ClientManager = require('../managers/ClientManager');

describe('ClientManager', () => {
  let cm, adminManager, connectionManager;

  beforeEach(() => {
    cm = new ClientManager();
    adminManager = { getAdmin: jest.fn() };
    connectionManager = { processQueuedRequestsForClient: jest.fn() };
    cm.setManagers(adminManager, connectionManager);
  });

  test('registers a new client and notifies admin', () => {
    const ws = { send: jest.fn() };
    adminManager.getAdmin.mockReturnValue({ clientIds: [], ws: { send: jest.fn() } });
    cm.registerClient(ws, { clientId: 'c1', adminId: 'a1', organizationId: 'o1', userName: 'User1' });

    expect(cm.getClient('c1')).toBeDefined();
    expect(ws.send).toHaveBeenCalledWith(expect.any(String));
  });

  test('setClientOffline notifies admin', () => {
    const client = { adminId: 'a1', ws: {}, status: 'online', lastSeen: Date.now() };
    cm.clients.set('c1', client);
    adminManager.getAdmin.mockReturnValue({ ws: { send: jest.fn() } });

    cm.setClientOffline('c1');
    expect(client.status).toBe('offline');
  });

  test('getClientsByAdmin returns correct structure', () => {
    adminManager.getAdmin.mockReturnValue({ clientIds: ['c1', 'c2'] });
    cm.clients.set('c1', { userName: 'U1', status: 'online', lastSeen: Date.now() });
    cm.clients.set('c2', { userName: 'U2', status: 'offline', lastSeen: 0 });
    let r = cm.getClientsByAdmin('a1');
    expect(r.length).toBe(2);
    expect(r[0]).toHaveProperty('clientId', 'c1');
  });
});
