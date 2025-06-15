
export interface DeviceInfo {
  deviceId: string;
  deviceType: 'admin' | 'client' | 'temporary-server';
  deviceName: string;
  organizationId: string;
  isTemporaryServer: boolean;
  lastSeen: number;
  capabilities: string[];
}

export interface MeshNode {
  deviceId: string;
  deviceName: string;
  nodeType: 'admin' | 'client' | 'relay';
  connections: string[];
  lastSeen: number;
  capabilities: string[];
}

export interface NetworkTopology {
  nodes: Map<string, MeshNode>;
  activeAdmin: string | null;
  temporaryServer: string | null;
  organizationId: string;
}
