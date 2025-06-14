
export type Permission = 
  | 'location.request'
  | 'location.view' 
  | 'network.manage'
  | 'network.view'
  | 'mesh.sync'
  | 'mesh.broadcast'
  | 'admin.promote'
  | 'admin.demote';

export type Role = 'admin' | 'member' | 'guest';

export interface AccessToken {
  deviceId: string;
  role: Role;
  permissions: Permission[];
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}

export interface LocationAccessRequest {
  requesterId: string;
  requesterName: string;
  targetDeviceId: string;
  reason?: string;
  timestamp: number;
  expiresAt: number;
}

export class AccessControl {
  private static rolePermissions: Record<Role, Permission[]> = {
    admin: [
      'location.request',
      'location.view',
      'network.manage',
      'network.view',
      'mesh.sync',
      'mesh.broadcast',
      'admin.promote',
      'admin.demote'
    ],
    member: [
      'location.view',
      'network.view',
      'mesh.sync',
      'mesh.broadcast'
    ],
    guest: [
      'network.view'
    ]
  };

  private pendingLocationRequests = new Map<string, LocationAccessRequest>();
  private approvedLocationRequests = new Map<string, { expiresAt: number; permissions: Permission[] }>();

  // Check if a device has permission
  static hasPermission(token: AccessToken, permission: Permission): boolean {
    if (token.expiresAt < Date.now()) {
      return false;
    }

    return token.permissions.includes(permission);
  }

  // Get permissions for a role
  static getPermissionsForRole(role: Role): Permission[] {
    return [...this.rolePermissions[role]];
  }

  // Create access token
  static createAccessToken(
    deviceId: string,
    role: Role,
    organizationId: string,
    additionalPermissions: Permission[] = []
  ): AccessToken {
    const basePermissions = this.getPermissionsForRole(role);
    const allPermissions = [...new Set([...basePermissions, ...additionalPermissions])];

    return {
      deviceId,
      role,
      permissions: allPermissions,
      organizationId,
      issuedAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      signature: '' // Would be signed in real implementation
    };
  }

  // Request location access
  requestLocationAccess(
    requesterId: string,
    requesterName: string,
    targetDeviceId: string,
    reason?: string
  ): string {
    const requestId = `${requesterId}-${targetDeviceId}-${Date.now()}`;
    
    const request: LocationAccessRequest = {
      requesterId,
      requesterName,
      targetDeviceId,
      reason,
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes to respond
    };

    this.pendingLocationRequests.set(requestId, request);
    
    // Dispatch event for UI notification
    const event = new CustomEvent('location-access-requested', {
      detail: { requestId, request }
    });
    window.dispatchEvent(event);

    return requestId;
  }

  // Approve location access request
  approveLocationRequest(requestId: string, duration: number = 60 * 60 * 1000): boolean {
    const request = this.pendingLocationRequests.get(requestId);
    if (!request || request.expiresAt < Date.now()) {
      return false;
    }

    // Grant temporary location access
    this.approvedLocationRequests.set(request.requesterId, {
      expiresAt: Date.now() + duration,
      permissions: ['location.view']
    });

    this.pendingLocationRequests.delete(requestId);
    
    // Dispatch approval event
    const event = new CustomEvent('location-access-approved', {
      detail: { requestId, request, duration }
    });
    window.dispatchEvent(event);

    return true;
  }

  // Deny location access request
  denyLocationRequest(requestId: string, reason?: string): boolean {
    const request = this.pendingLocationRequests.get(requestId);
    if (!request) {
      return false;
    }

    this.pendingLocationRequests.delete(requestId);
    
    // Dispatch denial event
    const event = new CustomEvent('location-access-denied', {
      detail: { requestId, request, reason }
    });
    window.dispatchEvent(event);

    return true;
  }

  // Check if requester has temporary location access
  hasTemporaryLocationAccess(requesterId: string): boolean {
    const access = this.approvedLocationRequests.get(requesterId);
    if (!access || access.expiresAt < Date.now()) {
      if (access) {
        this.approvedLocationRequests.delete(requesterId);
      }
      return false;
    }
    return true;
  }

  // Get pending location requests for a device
  getPendingLocationRequests(deviceId: string): LocationAccessRequest[] {
    return Array.from(this.pendingLocationRequests.values())
      .filter(request => request.targetDeviceId === deviceId && request.expiresAt > Date.now());
  }

  // Clean up expired requests
  cleanupExpiredRequests(): void {
    const now = Date.now();
    
    // Clean up pending requests
    const expiredPending = Array.from(this.pendingLocationRequests.entries())
      .filter(([, request]) => request.expiresAt <= now)
      .map(([id]) => id);
    
    expiredPending.forEach(id => this.pendingLocationRequests.delete(id));

    // Clean up approved requests
    const expiredApproved = Array.from(this.approvedLocationRequests.entries())
      .filter(([, access]) => access.expiresAt <= now)
      .map(([id]) => id);
    
    expiredApproved.forEach(id => this.approvedLocationRequests.delete(id));
  }

  // Revoke all access for a device
  revokeAllAccess(deviceId: string): void {
    this.approvedLocationRequests.delete(deviceId);
    
    // Remove pending requests from this device
    const toRemove = Array.from(this.pendingLocationRequests.entries())
      .filter(([, request]) => request.requesterId === deviceId)
      .map(([id]) => id);
    
    toRemove.forEach(id => this.pendingLocationRequests.delete(id));
  }

  // Get all approved devices for debugging
  getApprovedDevices(): string[] {
    return Array.from(this.approvedLocationRequests.keys());
  }

  clear(): void {
    this.pendingLocationRequests.clear();
    this.approvedLocationRequests.clear();
  }
}
