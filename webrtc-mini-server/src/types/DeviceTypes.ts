
export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'admin' | 'client';
  organizationId: string;
  capabilities: string[];
  joinTime: number;
  lastSeen: number;
  priority: number;
  isTemporaryServer: boolean;
}

export interface DeviceCapabilities {
  canManageAdmin: boolean;
  canViewLocation: boolean;
  canServeTemporary: boolean;
  canBroadcast: boolean;
}

export const DEFAULT_CAPABILITIES = {
  ADMIN_MANAGE: 'admin.manage',
  LOCATION_VIEW: 'location.view',
  SERVER_TEMPORARY: 'server.temporary',
  BROADCAST_MESSAGE: 'message.broadcast'
};
