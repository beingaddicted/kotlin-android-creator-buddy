
# WebRTC Mini Server

A lightweight, temporary coordination server for WebRTC mesh networks. This mini server provides backup coordination when the main admin devices go offline, ensuring network continuity and self-healing capabilities.

## Features

- **Temporary Coordination**: Automatically becomes active when main admin devices are offline
- **Admin Election**: Democratic election process for determining temporary admin roles
- **Mesh Network Support**: Maintains connectivity between devices in a mesh topology
- **Client Management**: Tracks connected clients and their capabilities
- **Heartbeat Monitoring**: Monitors device health and removes stale connections
- **WebSocket Communication**: Real-time bidirectional communication with connected devices

## Architecture

### Core Components

1. **MiniServerCore**: Central coordination engine that manages clients and handles messaging
2. **WebSocketServer**: WebSocket server implementation for real-time communication
3. **AdminElection**: Democratic election system for selecting temporary admins
4. **DeviceTypes**: Type definitions for device information and network topology

### Network Roles

- **Temporary Admin**: Elected device that coordinates the mesh network
- **Client Devices**: Connected devices that participate in the mesh
- **Relay Nodes**: Devices that help route messages between other devices

## Usage

### Basic Setup

```typescript
import WebRTCMiniServer, { DeviceInfo } from './index';

const deviceInfo: DeviceInfo = {
  deviceId: 'device_123',
  deviceType: 'client',
  deviceName: 'Mobile Device',
  organizationId: 'org_456',
  isTemporaryServer: false,
  lastSeen: Date.now(),
  capabilities: ['location.share', 'admin.manage']
};

const miniServer = new WebRTCMiniServer({
  port: 8080,
  organizationId: 'org_456',
  deviceInfo,
  autoStart: true
});
```

### Manual Control

```typescript
// Start the server
await miniServer.start();

// Check server status
const stats = miniServer.getServerStats();
console.log('Server stats:', stats);

// Check if this device is the current admin
if (miniServer.isCurrentDeviceAdmin()) {
  console.log('This device is the temporary admin');
}

// Get connected clients
const clients = miniServer.getConnectedClients();
console.log('Connected clients:', clients);

// Stop the server
await miniServer.stop();
```

## Client Connection

Clients connect via WebSocket with query parameters:

```
ws://localhost:8080?organizationId=org_456&clientId=device_123&clientName=MyDevice&capabilities=location.share,admin.manage
```

### Message Protocol

#### Client to Server Messages

```typescript
// Heartbeat
{
  type: 'heartbeat'
}

// Location update
{
  type: 'location-update',
  data: {
    latitude: 40.7128,
    longitude: -74.0060,
    accuracy: 10
  }
}

// Peer message
{
  type: 'peer-message',
  data: {
    targetId: 'device_456', // or 'broadcast'
    message: { /* custom message data */ }
  }
}

// Request client list
{
  type: 'request-client-list'
}
```

#### Server to Client Messages

```typescript
// Welcome message
{
  type: 'welcome',
  data: {
    serverId: 'server_123',
    serverName: 'Mini Server',
    organizationId: 'org_456',
    timestamp: 1640995200000
  }
}

// Client list update
{
  type: 'client-list-update',
  data: {
    clients: [
      {
        id: 'device_456',
        name: 'Device Name',
        capabilities: ['location.share'],
        lastSeen: 1640995200000
      }
    ]
  }
}

// Server heartbeat
{
  type: 'server-heartbeat',
  timestamp: 1640995200000,
  clientCount: 5
}

// Admin election update
{
  type: 'admin-heartbeat',
  data: {
    deviceId: 'device_789',
    timestamp: 1640995200000
  }
}
```

## Admin Election Process

The mini server implements a democratic election process:

1. **Candidate Registration**: Devices with admin capabilities register as candidates
2. **Priority Calculation**: Based on capabilities and connection time
3. **Election Trigger**: Automatically triggered when no admin is present
4. **Winner Selection**: Highest priority device becomes temporary admin
5. **Heartbeat Monitoring**: Continuous monitoring of admin device health

### Priority Calculation

- Base priority: Number of capabilities
- Bonus points:
  - `location.view`: +5 points
  - `admin.manage`: +10 points
  - `server.temporary`: +3 points
- Tiebreaker: Earlier join time wins

## Development

### Building

```bash
npm install
npm run build
```

### Running in Development

```bash
npm run dev
```

### Testing

```bash
npm test
```

## Integration with Main Application

The mini server is designed to work seamlessly with the main WebRTC mesh network:

1. **Automatic Activation**: Starts when main admin devices go offline
2. **Graceful Handoff**: Automatically deactivates when main admin returns
3. **State Synchronization**: Maintains network state during transitions
4. **Backward Compatibility**: Works with existing mesh network protocols

## Configuration

### Environment Variables

- `MINI_SERVER_PORT`: Server port (default: 8080)
- `HEARTBEAT_INTERVAL`: Heartbeat interval in ms (default: 10000)
- `CLIENT_TIMEOUT`: Client timeout in ms (default: 30000)
- `ELECTION_DELAY`: Election delay in ms (default: 2000)

### Security Considerations

- **Organization Validation**: Only devices from the same organization can connect
- **Capability Verification**: Device capabilities are validated on connection
- **Heartbeat Monitoring**: Stale connections are automatically removed
- **Message Validation**: All incoming messages are validated for proper format

## Limitations

- **Single Organization**: Each mini server instance handles one organization
- **Memory Storage**: All state is stored in memory (not persistent)
- **Local Network**: Designed for local network operation (no TURN servers)
- **Basic Security**: Minimal security implementation (suitable for trusted networks)

## Future Enhancements

- Persistent storage for network state
- Enhanced security with device authentication
- Support for multiple organizations
- TURN server integration for NAT traversal
- Advanced routing algorithms for mesh optimization
