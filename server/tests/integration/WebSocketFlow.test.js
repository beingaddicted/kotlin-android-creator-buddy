
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const ConnectionManager = require('../../managers/ConnectionManager');
const ClientManager = require('../../managers/ClientManager');
const AdminManager = require('../../managers/AdminManager');
const QueueManager = require('../../managers/QueueManager');
const HistoryManager = require('../../managers/HistoryManager');

let server, wss, port;

beforeAll((done) => {
  const app = express();
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });
  port = 33555;

  // Managers
  const connectionManager = new ConnectionManager();
  const clientManager = new ClientManager();
  const adminManager = new AdminManager();
  const queueManager = new QueueManager();
  const historyManager = new HistoryManager();
  connectionManager.setManagers(clientManager, adminManager, queueManager, historyManager);
  clientManager.setManagers(adminManager, connectionManager);
  adminManager.setManagers(clientManager, historyManager);

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        connectionManager.handleWebSocketMessage(ws, data);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });
  });

  server.listen(port, done);
});

afterAll((done) => {
  wss.close(() => server.close(done));
});

test('WebSocket flow: admin and client registration/connection', (done) => {
  const adminWs = new WebSocket(`ws://localhost:${port}`);
  const clientWs = new WebSocket(`ws://localhost:${port}`);

  let adminRegistered = false, clientRegistered = false;

  adminWs.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'admin_registered') {
      adminRegistered = true;
    }
    if (data.type === 'enhanced_client_list') {
      expect(data.clients).toBeDefined();
      setupClient();
    }
    if (data.type === 'client_connection_response') {
      expect(data.accepted).toBe(true);
      adminWs.close();
      clientWs.close();
      done();
    }
  });

  function setupClient() {
    clientWs.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'client_registered') {
        clientRegistered = true;
        // Admin requests connection to client
        adminWs.send(
          JSON.stringify({
            type: 'admin_connect_request',
            clientId: 'clientA',
            offerData: { sdp: 'fake-sdp' },
          })
        );
      }
      if (data.type === 'admin_connection_request') {
        // Client responds to admin connect
        clientWs.send(
          JSON.stringify({
            type: 'client_response',
            requestId: data.requestId,
            accepted: true,
            answerData: { sdp: 'fake-answer' },
          })
        );
      }
    });

    clientWs.send(
      JSON.stringify({
        type: 'register_client',
        clientId: 'clientA',
        adminId: 'adminB',
        organizationId: 'orgX',
        userName: 'TestUser',
      })
    );
  }

  adminWs.on('open', () => {
    adminWs.send(
      JSON.stringify({
        type: 'register_admin',
        adminId: 'adminB',
        organizationId: 'orgX',
      })
    );
  });
});
