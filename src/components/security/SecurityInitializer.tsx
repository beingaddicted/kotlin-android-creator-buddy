
import { useEffect, useState } from 'react';
import { EnhancedSecurityManager } from '@/services/security/EnhancedSecurityManager';
import { DeviceIDManager } from '@/services/webrtc/DeviceIDManager';
import { SessionTimeoutMonitor } from './SessionTimeoutMonitor';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityInitializerProps {
  organizationId: string;
  role?: 'admin' | 'member';
  onSecurityReady?: () => void;
  onSessionTimeout?: () => void;
  children: React.ReactNode;
}

export const SecurityInitializer = ({ 
  organizationId, 
  role = 'member', 
  onSecurityReady,
  onSessionTimeout,
  children 
}: SecurityInitializerProps) => {
  const [securityStatus, setSecurityStatus] = useState<'initializing' | 'ready' | 'error'>('initializing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    initializeSecurity();
  }, [organizationId, role]);

  const initializeSecurity = async () => {
    try {
      setSecurityStatus('initializing');
      setError('');

      // Get device ID
      const deviceInfo = DeviceIDManager.getDeviceInfo();
      if (!deviceInfo) {
        throw new Error('Device information not available');
      }

      // Initialize enhanced security manager
      const securityManager = new EnhancedSecurityManager();
      await securityManager.initialize(deviceInfo.deviceId, organizationId, role);

      // Make security manager globally available
      (window as any).securityManager = securityManager;

      setSecurityStatus('ready');
      onSecurityReady?.();
      
      console.log('SecurityInitializer: Enhanced security system initialized successfully');
      toast.success('Secure connection established with enhanced protection');
    } catch (err) {
      console.error('SecurityInitializer: Failed to initialize security:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize security system');
      setSecurityStatus('error');
      toast.error('Failed to establish secure connection');
    }
  };

  const handleSessionTimeout = () => {
    toast.warning('Session expired for security reasons');
    onSessionTimeout?.();
  };

  const handleExtendSession = () => {
    toast.success('Session extended successfully');
  };

  if (securityStatus === 'initializing') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Initializing Enhanced Security</h3>
            <p className="text-gray-600">Setting up encrypted communication with advanced protection...</p>
          </div>
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  if (securityStatus === 'error') {
    return (
      <Alert variant="destructive" className="max-w-md mx-auto">
        <ShieldX className="h-4 w-4" />
        <AlertDescription>
          <strong>Security Initialization Failed:</strong> {error}
          <button 
            onClick={initializeSecurity}
            className="ml-2 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center text-green-800">
          <ShieldCheck className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Enhanced secure connection established</span>
        </div>
      </div>
      
      <SessionTimeoutMonitor 
        onSessionTimeout={handleSessionTimeout}
        onExtendSession={handleExtendSession}
      />
      
      {children}
    </div>
  );
};
