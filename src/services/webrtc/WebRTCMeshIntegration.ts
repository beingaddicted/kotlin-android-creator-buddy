
import { MeshNetworkManager, MeshMessage, DeviceInfo } from './MeshNetworkManager';
import { ConnectionManager } from './ConnectionManager';
import { IPChangeManager } from './IPChangeManager';
import { SignalingMessage } from './SignalingService';

export class WebRTCMeshIntegration {
  private meshManager: MeshNetworkManager;
  private connectionManager: ConnectionManager;
  private ipChangeManager: IPChangeManager;

  constructor(
    meshManager: MeshNetworkManager,
    connectionManager: ConnectionManager,
    ipChangeManager: IPChangeManager
  ) {
    this.meshManager = meshManager;
    this.connectionManager = connectionManager;
    this.ipChangeManager = ipChangeManager;
    
    this.setupIntegration();
  }

  private setupIntegration(): void {
    // Listen for IP changes and update mesh network
    this.ipChangeManager.onIPChange((event) => {
      if (event.source === 'local') {
        console.log('WebRTCMeshIntegration: Local IP changed, updating mesh network');
        this.meshManager.updateCurrentDeviceIP(event.newIP);
      }
    });

    // Listen for mesh messages and route them through WebRTC
    this.meshManager.onMeshMessageReceived((message, toDeviceId) => {
      this.sendMeshMessageViaWebRTC(message, toDeviceId);
    });

    // Listen for peer connections and add them to mesh network
    this.connectionManager.onPeerStatusUpdate((peers) => {
      peers.forEach(peer => {
        if (peer.status === 'connected') {
          const deviceInfo: DeviceInfo = {
            id: peer.id,
            name: peer.name,
            organizationId: peer.organizationId,
            ipAddress: 'unknown', // Will be updated when we receive their info
            isAdmin: false, // Will be determined from peer data
            lastSeen: peer.lastSeen,
            status: 'online'
          };
          
          this.meshManager.addOrUpdateDevice(deviceInfo);
        }
      });
    });

    // Setup signaling message handler for mesh messages
    this.connectionManager.onSignalingMessage((message, fromPeerId) => {
      if (this.isMeshMessage(message)) {
        this.handleMeshMessageFromWebRTC(message, fromPeerId);
      }
    });
  }

  private sendMeshMessageViaWebRTC(meshMessage: MeshMessage, toDeviceId: string): void {
    const signalingMessage: SignalingMessage = {
      type: 'mesh-message' as any, // Extend the SignalingMessage type
      data: meshMessage,
      fromId: this.meshManager.getCurrentDevice().id,
      toId: toDeviceId,
      timestamp: Date.now()
    };

    // Find peer and send message
    const peer = this.connectionManager.getPeer(toDeviceId);
    if (peer?.dataChannel && peer.dataChannel.readyState === 'open') {
      try {
        peer.dataChannel.send(JSON.stringify(signalingMessage));
        console.log('WebRTCMeshIntegration: Sent mesh message to', toDeviceId);
      } catch (error) {
        console.error('WebRTCMeshIntegration: Failed to send mesh message:', error);
      }
    } else {
      console.warn('WebRTCMeshIntegration: Cannot send mesh message - peer not connected:', toDeviceId);
    }
  }

  private handleMeshMessageFromWebRTC(signalingMessage: SignalingMessage, fromPeerId: string): void {
    const meshMessage = signalingMessage.data as MeshMessage;
    
    console.log('WebRTCMeshIntegration: Received mesh message from WebRTC peer:', fromPeerId);
    
    // Update device info for the sender
    if (meshMessage.type === 'address_update' && meshMessage.data.deviceInfo) {
      const senderDevice: DeviceInfo = meshMessage.data.deviceInfo;
      this.meshManager.addOrUpdateDevice(senderDevice);
    }
    
    // Handle the mesh message
    this.meshManager.handleMeshMessage(meshMessage, fromPeerId);
  }

  private isMeshMessage(message: SignalingMessage): boolean {
    return message.type === 'mesh-message' as any;
  }

  // Method to initialize mesh network when device comes online
  initiateMeshSync(): void {
    console.log('WebRTCMeshIntegration: Initiating mesh network sync');
    
    // Request sync from all available peers
    this.meshManager.requestAddressSync();
    
    // Broadcast our current device info
    this.meshManager.broadcastAddressUpdate();
  }

  // Method to handle device going offline
  handleDeviceOffline(deviceId: string): void {
    const addressBook = this.meshManager.getAddressBook();
    const device = addressBook.devices.get(deviceId);
    
    if (device) {
      device.status = 'offline';
      device.lastSeen = Date.now();
      this.meshManager.addOrUpdateDevice(device);
    }
  }

  // Method to get current mesh network status
  getMeshNetworkStatus() {
    const addressBook = this.meshManager.getAddressBook();
    const currentDevice = this.meshManager.getCurrentDevice();
    const onlineDevices = this.meshManager.getOnlineDevices();
    const adminDevices = this.meshManager.getAdminDevices();
    
    return {
      currentDevice,
      totalDevices: addressBook.devices.size,
      onlineDevices: onlineDevices.length,
      adminDevices: adminDevices.length,
      lastSync: addressBook.lastUpdated,
      version: addressBook.version
    };
  }

  // Get all devices for UI display
  getAllDevices(): DeviceInfo[] {
    return this.meshManager.getDevicesInOrganization();
  }

  // Get mesh network manager for direct access
  getMeshManager(): MeshNetworkManager {
    return this.meshManager;
  }
}
