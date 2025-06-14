
const WebSocket = require('ws');
const ConnectionManager = require('../managers/ConnectionManager');

describe('ConnectionManager', () => {
  let cm, mockClientManager, mockAdminManager, mockQueueManager, mockHistoryManager;

  beforeEach(() => {
    cm = new ConnectionManager();
    mockClientManager = { getClient: jest.fn(), setClientOnline: jest.fn(), hasClient: jest.fn(), updateLastSeen: jest.fn() };
    mockAdminManager = { getAdmin: jest.fn(), hasAdmin: jest.fn(), updateLastSeen: jest.fn() };
    mockQueueManager = { queueConnectionRequest: jest.fn(), getQueuedRequests: jest.fn(), clearQueue: jest.fn() };
    mockHistoryManager = { recordConnectionHistory: jest.fn(), getClientHistory: jest.fn() };
    cm.setManagers(mockClientManager, mockAdminManager, mockQueueManager, mockHistoryManager);
  });

  test('should set manager dependencies', () => {
    expect(cm.clientManager).toBe(mockClientManager);
    expect(cm.adminManager).toBe(mockAdminManager);
  });

  test('should handle unknown message type', () => {
    const ws = { send: jest.fn() };
    cm.handleWebSocketMessage(ws, { type: 'unknown_type' });
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('Unknown message type'));
  });

  test('should process queued requests for client', () => {
    mockClientManager.getClient.mockReturnValue({ ws: { send: jest.fn() }, clientId: 'c1' });
    mockQueueManager.getQueuedRequests.mockReturnValue([
      { requestId: 'rid', adminId: 'a1', offerData: {} }
    ]);
    cm.connectionRequests.set('rid', { clientId: 'c1', adminId: 'a1', offerData: {} });
    cm.adminManager.getAdmin = jest.fn().mockReturnValue({ ws: { send: jest.fn() } });

    cm.processQueuedRequestsForClient('c1');
    expect(mockQueueManager.clearQueue).toHaveBeenCalled();
  });
});
