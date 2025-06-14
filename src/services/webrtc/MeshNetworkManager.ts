
export interface DeviceInfo {
  id: string;
  name: string;
  organizationId: string;
  ipAddress: string;
  isAdmin: boolean;
  lastSeen: number;
  status: 'online' | 'offline' | 'connecting';
}

export interface AddressBook {
  devices: Map<string, DeviceInfo>;
  lastUpdated: number;
  version: number;
}

export interface MeshMessage {
  type: 'address_update' | 'address_request' | 'address_response' | 'sync_request';
  fromDeviceId: string;
  toDeviceId?: string; // If undefined, broadcast to all
  data: any;
  timestamp: number;
  version: number;
}

export class MeshNetworkManager {
  private addressBook: AddressBook;
  private currentDevice: DeviceInfo;
  private onAddressBookUpdated?: (addressBook: AddressBook) => void;
  private onMeshMessage?: (message: MeshMessage, fromDeviceId: string) => void;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(deviceId: string, deviceName: string, organizationId: string, isAdmin: boolean) {
    this.currentDevice = {
      id: deviceId,
      name: deviceName,
      organizationId,
      ipAddress: 'unknown',
      isAdmin,
      lastSeen: Date.now(),
      status: 'online'
    };

    this.addressBook = {
      devices: new Map(),
      lastUpdated: Date.now(),
      version: 1
    };

    // Add self to address book
    this.addressBook.devices.set(deviceId, this.currentDevice);
    this.loadAddressBookFromStorage();
    this.startPeriodicSync();
  }

  updateCurrentDeviceIP(newIP: string): void {
    const oldIP = this.currentDevice.ipAddress;
    this.currentDevice.ipAddress = newIP;
    this.currentDevice.lastSeen = Date.now();
    
    // Update in address book
    this.addressBook.devices.set(this.currentDevice.id, { ...this.currentDevice });
    this.addressBook.version++;
    this.addressBook.lastUpdated = Date.now();
    
    console.log(`MeshNetwork: Device IP updated from ${oldIP} to ${newIP}`);
    
    // Broadcast IP change to all devices
    this.broadcastAddressUpdate();
    this.saveAddressBookToStorage();
    this.notifyAddressBookUpdated();
  }

  addOrUpdateDevice(deviceInfo: DeviceInfo): boolean {
    const existingDevice = this.addressBook.devices.get(deviceInfo.id);
    let hasChanged = false;

    if (!existingDevice) {
      // New device
      this.addressBook.devices.set(deviceInfo.id, deviceInfo);
      hasChanged = true;
      console.log(`MeshNetwork: Added new device ${deviceInfo.name} (${deviceInfo.id})`);
    } else {
      // Check if device info has changed
      if (existingDevice.ipAddress !== deviceInfo.ipAddress ||
          existingDevice.name !== deviceInfo.name ||
          existingDevice.status !== deviceInfo.status) {
        this.addressBook.devices.set(deviceInfo.id, deviceInfo);
        hasChanged = true;
        console.log(`MeshNetwork: Updated device ${deviceInfo.name} (${deviceInfo.id})`);
      }
      
      // Always update lastSeen
      deviceInfo.lastSeen = Date.now();
      this.addressBook.devices.set(deviceInfo.id, deviceInfo);
    }

    if (hasChanged) {
      this.addressBook.version++;
      this.addressBook.lastUpdated = Date.now();
      this.saveAddressBookToStorage();
      this.notifyAddressBookUpdated();
    }

    return hasChanged;
  }

  getDevicesInOrganization(): DeviceInfo[] {
    return Array.from(this.addressBook.devices.values())
      .filter(device => device.organizationId === this.currentDevice.organizationId);
  }

  getOnlineDevices(): DeviceInfo[] {
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.getDevicesInOrganization()
      .filter(device => device.lastSeen > fiveMinutesAgo && device.status === 'online');
  }

  getAdminDevices(): DeviceInfo[] {
    return this.getDevicesInOrganization().filter(device => device.isAdmin);
  }

  broadcastAddressUpdate(): void {
    const message: MeshMessage = {
      type: 'address_update',
      fromDeviceId: this.currentDevice.id,
      data: {
        deviceInfo: this.currentDevice,
        addressBookVersion: this.addressBook.version
      },
      timestamp: Date.now(),
      version: this.addressBook.version
    };

    this.broadcastMeshMessage(message);
  }

  requestAddressSync(targetDeviceId?: string): void {
    const message: MeshMessage = {
      type: 'sync_request',
      fromDeviceId: this.currentDevice.id,
      toDeviceId: targetDeviceId,
      data: {
        currentVersion: this.addressBook.version,
        requestingDeviceInfo: this.currentDevice
      },
      timestamp: Date.now(),
      version: this.addressBook.version
    };

    if (targetDeviceId) {
      this.sendMeshMessage(targetDeviceId, message);
    } else {
      this.broadcastMeshMessage(message);
    }
  }

  handleMeshMessage(message: MeshMessage, fromDeviceId: string): void {
    console.log(`MeshNetwork: Received ${message.type} from ${fromDeviceId}`);

    switch (message.type) {
      case 'address_update':
        this.handleAddressUpdate(message);
        break;
      case 'sync_request':
        this.handleSyncRequest(message);
        break;
      case 'address_response':
        this.handleAddressResponse(message);
        break;
    }
  }

  private handleAddressUpdate(message: MeshMessage): void {
    const { deviceInfo, addressBookVersion } = message.data;
    
    if (deviceInfo && deviceInfo.organizationId === this.currentDevice.organizationId) {
      const hasChanged = this.addOrUpdateDevice(deviceInfo);
      
      if (hasChanged) {
        // Relay to other devices (except sender)
        this.relayAddressUpdate(message);
      }
    }
  }

  private handleSyncRequest(message: MeshMessage): void {
    const { currentVersion, requestingDeviceInfo } = message.data;
    
    // Add/update the requesting device
    if (requestingDeviceInfo) {
      this.addOrUpdateDevice(requestingDeviceInfo);
    }
    
    // Send our address book if we have a newer version
    if (this.addressBook.version > currentVersion) {
      const response: MeshMessage = {
        type: 'address_response',
        fromDeviceId: this.currentDevice.id,
        toDeviceId: message.fromDeviceId,
        data: {
          devices: Array.from(this.addressBook.devices.values())
            .filter(device => device.organizationId === this.currentDevice.organizationId),
          version: this.addressBook.version
        },
        timestamp: Date.now(),
        version: this.addressBook.version
      };
      
      this.sendMeshMessage(message.fromDeviceId, response);
    }
  }

  private handleAddressResponse(message: MeshMessage): void {
    const { devices, version } = message.data;
    
    if (version > this.addressBook.version) {
      devices.forEach((deviceInfo: DeviceInfo) => {
        this.addOrUpdateDevice(deviceInfo);
      });
      
      this.addressBook.version = version;
      console.log(`MeshNetwork: Updated address book to version ${version}`);
    }
  }

  private relayAddressUpdate(originalMessage: MeshMessage): void {
    // Relay to all devices except the original sender
    const relayMessage: MeshMessage = {
      ...originalMessage,
      fromDeviceId: this.currentDevice.id // Mark as relayed by us
    };
    
    this.broadcastMeshMessage(relayMessage, [originalMessage.fromDeviceId]);
  }

  private broadcastMeshMessage(message: MeshMessage, excludeDevices: string[] = []): void {
    const onlineDevices = this.getOnlineDevices()
      .filter(device => device.id !== this.currentDevice.id)
      .filter(device => !excludeDevices.includes(device.id));
    
    onlineDevices.forEach(device => {
      this.sendMeshMessage(device.id, message);
    });
  }

  private sendMeshMessage(deviceId: string, message: MeshMessage): void {
    if (this.onMeshMessage) {
      this.onMeshMessage(message, deviceId);
    }
  }

  private startPeriodicSync(): void {
    // Sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.performPeriodicSync();
    }, 30000);
  }

  private async performPeriodicSync(): Promise<void> {
    // Try to sync with admin first, then other devices
    const adminDevices = this.getAdminDevices()
      .filter(device => device.id !== this.currentDevice.id);
    
    if (adminDevices.length > 0) {
      // Try admin devices first
      for (const admin of adminDevices) {
        this.requestAddressSync(admin.id);
      }
    } else {
      // No admin available, try other online devices
      const otherDevices = this.getOnlineDevices()
        .filter(device => device.id !== this.currentDevice.id);
      
      if (otherDevices.length > 0) {
        this.requestAddressSync(otherDevices[0].id);
      }
    }
  }

  private saveAddressBookToStorage(): void {
    try {
      const storageKey = `mesh_address_book_${this.currentDevice.organizationId}`;
      const addressBookData = {
        devices: Array.from(this.addressBook.devices.entries()),
        lastUpdated: this.addressBook.lastUpdated,
        version: this.addressBook.version
      };
      localStorage.setItem(storageKey, JSON.stringify(addressBookData));
    } catch (error) {
      console.error('MeshNetwork: Failed to save address book:', error);
    }
  }

  private loadAddressBookFromStorage(): void {
    try {
      const storageKey = `mesh_address_book_${this.currentDevice.organizationId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const addressBookData = JSON.parse(stored);
        this.addressBook.devices = new Map(addressBookData.devices);
        this.addressBook.lastUpdated = addressBookData.lastUpdated;
        this.addressBook.version = addressBookData.version;
        
        // Ensure current device is in the address book with latest info
        this.addressBook.devices.set(this.currentDevice.id, this.currentDevice);
        
        console.log(`MeshNetwork: Loaded address book with ${this.addressBook.devices.size} devices`);
      }
    } catch (error) {
      console.error('MeshNetwork: Failed to load address book:', error);
    }
  }

  private notifyAddressBookUpdated(): void {
    if (this.onAddressBookUpdated) {
      this.onAddressBookUpdated(this.addressBook);
    }
  }

  onMeshMessageReceived(callback: (message: MeshMessage, fromDeviceId: string) => void): void {
    this.onMeshMessage = callback;
  }

  onAddressBookUpdate(callback: (addressBook: AddressBook) => void): void {
    this.onAddressBookUpdated = callback;
  }

  getAddressBook(): AddressBook {
    return { ...this.addressBook };
  }

  getCurrentDevice(): DeviceInfo {
    return { ...this.currentDevice };
  }

  cleanup(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}
