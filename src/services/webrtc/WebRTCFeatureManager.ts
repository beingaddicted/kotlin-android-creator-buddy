
import { BrowserCompatibilityManager } from './BrowserCompatibilityManager';
import { GracefulDegradationManager } from './GracefulDegradationManager';

export class WebRTCFeatureManager {
  private compatibilityManager: BrowserCompatibilityManager;
  private degradationManager: GracefulDegradationManager;

  constructor(
    compatibilityManager: BrowserCompatibilityManager,
    degradationManager: GracefulDegradationManager
  ) {
    this.compatibilityManager = compatibilityManager;
    this.degradationManager = degradationManager;
  }

  isFeatureAvailable(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): boolean {
    // Check browser capability first
    if (feature === 'videoCapabilities' && !this.compatibilityManager.isFeatureSupported('mediaDevices')) {
      return false;
    }
    
    // Check degradation level
    return this.degradationManager.isFeatureAvailable(feature);
  }

  getFeatureMessage(feature: 'realTimeLocation' | 'videoCapabilities' | 'fileTransfer' | 'voiceChat' | 'instantMessaging'): string {
    // Check browser limitations first
    const browserLimitations = this.compatibilityManager.getLimitations();
    const relevantLimitation = browserLimitations.find(limitation => 
      limitation.toLowerCase().includes(feature.toLowerCase())
    );
    
    if (relevantLimitation) {
      return relevantLimitation;
    }
    
    return this.degradationManager.getFeatureMessage(feature);
  }
}
