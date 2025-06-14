
# Enhanced WebRTC Signaling Server

An advanced signaling server with queuing, state management, and reconnection handling for admin-initiated WebRTC connections.

## 🆕 Advanced Features

### Connection Request Queuing
- **Offline Client Support**: Admins can request connections to offline clients
- **Automatic Processing**: Queued requests are automatically processed when clients come online
- **Priority Handling**: Support for priority levels on connection requests
- **Queue Management**: Automatic cleanup and size limits to prevent memory issues

### Enhanced State Management
- **Persistent Client Data**: Client information persists across disconnections
- **Connection History**: Track all connection attempts and their outcomes
- **Reconnection Detection**: Differentiate between new connections and reconnections
- **Comprehensive Status Tracking**: Detailed online/offline status with timestamps

### Advanced Admin Features
- **Enhanced Client Lists**: Detailed client information including history and pending requests
- **Pending Notifications**: Get notified about events that happened while offline
- **Connection Analytics**: Track connection success rates and patterns
- **Real-time Updates**: Instant notifications for all client status changes

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
# or for development
npm run dev
```

3. Server will run on port 3001 by default

## API Reference

### WebSocket Messages

#### Enhanced Admin Registration
```json
{
  "type": "register_admin",
  "adminId": "admin-123",
  "organizationId": "org-456"
}
```

**Response:**
```json
{
  "type": "admin_registered",
  "adminId": "admin-123",
  "organizationId": "org-456",
  "reconnected": false
}
```

#### Enhanced Client Registration
```json
{
  "type": "register_client",
  "clientId": "client-789",
  "adminId": "admin-123",
  "organizationId": "org-456",
  "userName": "John Doe"
}
```

**Response:**
```json
{
  "type": "client_registered",
  "clientId": "client-789",
  "adminId": "admin-123",
  "reconnected": false
}
```

#### Connection Request with Priority
```json
{
  "type": "admin_connect_request",
  "clientId": "client-789",
  "offerData": { "offer": "...", "serverIp": "..." },
  "priority": "high"
}
```

**Responses:**
```json
// For online clients
{
  "type": "connection_request_sent",
  "requestId": "req-123",
  "clientId": "client-789"
}

// For offline clients
{
  "type": "connection_request_queued",
  "requestId": "req-123",
  "clientId": "client-789",
  "message": "Client is offline. Request queued for when client comes online."
}
```

#### Cancel Connection Request
```json
{
  "type": "cancel_connection_request",
  "requestId": "req-123"
}
```

#### Get Client History
```json
{
  "type": "get_client_history",
  "clientId": "client-789"
}
```

### Enhanced HTTP Endpoints

#### Server Statistics
- `GET /api/stats` - Comprehensive server statistics
```json
{
  "timestamp": 1640995200000,
  "clients": {
    "total": 25,
    "online": 18,
    "offline": 7
  },
  "admins": {
    "total": 3,
    "online": 2
  },
  "requests": {
    "pending": 5,
    "queued": 12,
    "total": 23
  }
}
```

#### Enhanced Client List
- `GET /api/admin/:adminId/clients` - Get detailed client list for admin
```json
{
  "clients": [
    {
      "clientId": "client-789",
      "userName": "John Doe",
      "status": "online",
      "lastSeen": 1640995200000,
      "pendingRequests": 1
    }
  ]
}
```

#### Advanced Connection Request
- `POST /api/admin/:adminId/connect/:clientId` - Request connection with queuing support
```json
{
  "offerData": { "offer": "...", "serverIp": "..." },
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "requestId": "req-123",
  "message": "Connection request sent to online client",
  "queued": false
}
```

## Advanced Client Notifications

### Queued Request Processing
When an offline client comes back online:
```json
{
  "type": "queued_request_processing",
  "requestId": "req-123",
  "clientId": "client-789",
  "message": "Client came online. Processing queued connection request."
}
```

### Enhanced Client List Updates
Admins receive detailed client information:
```json
{
  "type": "enhanced_client_list",
  "clients": [...],
  "totalClients": 25,
  "onlineClients": 18
}
```

### Pending Notifications
When admins reconnect:
```json
{
  "type": "pending_notifications",
  "notifications": [
    {
      "type": "client_recently_online",
      "clientId": "client-789",
      "userName": "John Doe",
      "timestamp": 1640995200000
    }
  ]
}
```

## Key Improvements

1. **Offline Client Support**: Admins can now initiate connections to offline clients through queuing
2. **Better Reconnection**: Smart detection and handling of reconnections vs new connections
3. **Persistent State**: Client and admin data persists across disconnections
4. **Enhanced Monitoring**: Comprehensive statistics and history tracking
5. **Improved UX**: Better notifications and status updates for admins
6. **Scalability**: Efficient memory management and cleanup processes

## Integration Notes

- The enhanced server maintains backward compatibility with basic WebSocket messages
- New features are opt-in through additional message types and endpoints
- Existing WebRTC P2P functionality remains unchanged
- Enhanced features provide better admin dashboard experience
- Queue system enables reliable connection establishment even with unreliable client connectivity

This advanced server significantly improves the reliability and user experience of admin-initiated WebRTC connections by handling the complexities of real-world network conditions and client availability.
