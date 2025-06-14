
import { MeshNetworkManager, DeviceInfo, AddressBook } from './MeshNetworkManager';
import { WebRTCMeshIntegration } from './WebRTCMeshIntegration';
import { ConnectionManager } from './ConnectionManager';
import { IPChangeManager } from './IPChangeManager';

export class WebRTCMeshService {
  private meshManager: MeshNetworkManager | null = null;
  private meshIntegration: WebRTCMeshIntegration | null = null;

  initializeMeshNetwork(
    userId: string,
    deviceName: string,
    organizationId: string,
    isAdmin: boolean,
    connectionManager: ConnectionManager,
    ipChangeManager: IPChangeManager
  ): void {
    this.meshManager = new MeshNetworkManager(
      userId,
      deviceName,
      organizationId,
      isAdmin
    );
    
    this.meshIntegration = new WebRTCMeshIntegration(
      this.meshManager,
      connectionManager,
      ipChangeManager
    );
    
    // Listen for address book updates
    this.meshManager.onAddressBookUpdate((addressBook) => {
      this.handleMeshNetworkUpdate(addressBook);
    });
    
    console.log('WebRTCMeshService: Mesh network initialized');
  }

  private handleMeshNetworkUpdate(addressBook: AddressBook): void {
    // Dispatch event to notify UI about mesh network updates
    const event = new CustomEvent('webrtc-mesh-network-updated', {
      detail: {
        devices: Array.from(addressBook.devices.values()),
        version: addressBook.version,
        lastUpdated: addressBook.lastUpdated
      }
    });
    window.dispatchEvent(event);
  }

  initiateMeshSync(): void {
    if (this.meshIntegration) {
      setTimeout(() => {
        this.meshIntegration?.initiateMeshSync();
      }, 2000);
    }
  }

  getMeshNetworkStatus() {
    return this.meshIntegration?.getMeshNetworkStatus() || null;
  }

  getAllDevicesInNetwork(): DeviceInfo[] {
    return this.meshIntegration?.getAllDevices() || [];
  }

  onMeshNetworkUpdate(callback: (devices: DeviceInfo[]) => void): void {
    window.addEventListener('webrtc-mesh-network-updated', (event: any) => {
      callback(event.detail.devices);
    });
  }

  broadcastToMeshNetwork(data: any): void {
    if (this.meshManager) {
      console.log('WebRTCMeshService: Broadcasting to mesh network:', data);
    }
  }

  cleanup(): void {
    if (this.meshManager) {
      this.meshManager.cleanup();
      this.meshManager = null;
    }
    this.meshIntegration = null;
  }
}
