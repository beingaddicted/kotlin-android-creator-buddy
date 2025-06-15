
import { WebRTCDiagnosticManager } from './WebRTCDiagnosticManager';
import { WebRTCServiceCore } from './WebRTCServiceCore';

export class WebRTCServiceDiagnostics {
  constructor(
    private diagnosticManager: WebRTCDiagnosticManager,
    private core: WebRTCServiceCore
  ) {}

  getBrowserCompatibility(): any {
    return this.diagnosticManager.getBrowserCompatibility();
  }

  getDegradationLevel(): any {
    return this.diagnosticManager.getDegradationLevel();
  }

  getErrorHistory(): any[] {
    return this.diagnosticManager.getErrorHistory();
  }

  generateDiagnosticReport(): string {
    return this.diagnosticManager.generateDiagnosticReport();
  }

  // Mesh network methods
  getMeshNetworkStatus(): any {
    return {
      hasActiveAdmin: this.core.isAdmin,
      temporaryServerId: null,
      connectedDevices: this.core.connectionManager.getConnectedPeers(),
      meshTopology: new Map()
    };
  }

  getAllAdmins(): any[] {
    return [{
      deviceId: this.core.userId || 'unknown',
      deviceName: 'Admin Device',
      lastSeen: Date.now(),
      isPrimary: true,
      capabilities: ['admin']
    }];
  }

  isPrimaryAdmin(): boolean {
    return this.core.isAdmin;
  }

  canPerformAdminActions(): boolean {
    return this.core.isAdmin;
  }

  getCurrentDeviceInfo(): any {
    return {
      deviceId: this.core.userId || 'unknown',
      deviceType: this.core.isAdmin ? 'admin' : 'client'
    };
  }
}
