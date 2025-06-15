
import { BrowserCompatibilityManager } from './BrowserCompatibilityManager';
import { GracefulDegradationManager } from './GracefulDegradationManager';
import { ConnectionHealthMonitor } from './ConnectionHealthMonitor';
import { ErrorContextManager } from './ErrorContextManager';
import { PersistentConnectionStorage } from './PersistentConnectionStorage';
import { MeshNetworkCoordinator } from './MeshNetworkCoordinator';
import { MultiAdminManager } from './MultiAdminManager';
import { DeviceIDManager } from './DeviceIDManager';

export class WebRTCDiagnosticManager {
  private compatibilityManager: BrowserCompatibilityManager;
  private degradationManager: GracefulDegradationManager;
  private persistentStorage: PersistentConnectionStorage;
  private meshCoordinator: MeshNetworkCoordinator;
  private multiAdminManager: MultiAdminManager;
  private currentDeviceId: string;

  constructor(
    compatibilityManager: BrowserCompatibilityManager,
    degradationManager: GracefulDegradationManager,
    persistentStorage: PersistentConnectionStorage,
    meshCoordinator: MeshNetworkCoordinator,
    multiAdminManager: MultiAdminManager,
    currentDeviceId: string
  ) {
    this.compatibilityManager = compatibilityManager;
    this.degradationManager = degradationManager;
    this.persistentStorage = persistentStorage;
    this.meshCoordinator = meshCoordinator;
    this.multiAdminManager = multiAdminManager;
    this.currentDeviceId = currentDeviceId;
  }

  getBrowserCompatibility() {
    return this.compatibilityManager.getBrowserInfo();
  }

  getConnectionHealth(healthMonitor: ConnectionHealthMonitor | null) {
    return healthMonitor ? healthMonitor.getLastHealth() : null;
  }

  getDegradationLevel() {
    return this.degradationManager.getCurrentLevel();
  }

  getErrorHistory(errorManager: ErrorContextManager) {
    return errorManager.getErrorHistory();
  }

  getStoredConnections() {
    return this.persistentStorage.getStoredConnections();
  }

  generateDiagnosticReport(errorManager: ErrorContextManager): string {
    const compatibility = this.compatibilityManager.generateCompatibilityReport();
    const degradation = this.degradationManager.getCurrentLevel();
    const errors = errorManager.getRecurringErrors();
    const connections = this.persistentStorage.getStoredConnections();
    const meshStatus = this.meshCoordinator.getNetworkStatus();
    const adminDevices = this.multiAdminManager.getAllAdmins();
    
    let report = compatibility;
    report += `\n\nService Status:\n`;
    report += `==============\n`;
    report += `Device ID: ${this.currentDeviceId}\n`;
    report += `Device Type: ${DeviceIDManager.getDeviceInfo()?.deviceType || 'unknown'}\n`;
    report += `Is Temporary Server: ${DeviceIDManager.isTemporaryServer()}\n`;
    report += `Degradation Level: ${degradation.level}\n`;
    report += `Active Features: ${Object.entries(degradation.features).filter(([,v]) => v).map(([k]) => k).join(', ')}\n`;
    
    report += `\n\nMesh Network Status:\n`;
    report += `===================\n`;
    report += `Has Active Admin: ${meshStatus.hasActiveAdmin}\n`;
    report += `Temporary Server: ${meshStatus.temporaryServerId || 'None'}\n`;
    report += `Connected Devices: ${meshStatus.connectedDevices.length}\n`;
    
    report += `\n\nAdmin Devices:\n`;
    report += `==============\n`;
    adminDevices.forEach(admin => {
      report += `  • ${admin.deviceId} (${admin.isPrimary ? 'Primary' : 'Secondary'})\n`;
    });
    
    if (errors.length > 0) {
      report += `\nRecurring Errors:\n`;
      errors.forEach(error => {
        report += `  • ${error.code}: ${error.count} occurrences\n`;
      });
    }
    
    report += `\nStored Connections: ${connections.length}\n`;
    
    return report;
  }
}
