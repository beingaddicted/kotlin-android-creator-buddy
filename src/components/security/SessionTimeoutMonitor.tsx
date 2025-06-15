
import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, Clock, AlertTriangle } from 'lucide-react';
import { EnhancedSecurityManager } from '@/services/security/EnhancedSecurityManager';

interface SessionTimeoutMonitorProps {
  onSessionTimeout: () => void;
  onExtendSession: () => void;
}

export const SessionTimeoutMonitor = ({ onSessionTimeout, onExtendSession }: SessionTimeoutMonitorProps) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const securityManager = (window as any).securityManager as EnhancedSecurityManager;
    if (!securityManager) return;

    const checkSession = () => {
      // Update activity on any user interaction
      securityManager.updateActivity();

      // Check for session timeout
      if (securityManager.checkSessionTimeout()) {
        onSessionTimeout();
        return;
      }

      // Check if we should show warning
      const shouldWarn = securityManager.shouldShowSessionWarning();
      setShowWarning(shouldWarn);

      if (shouldWarn) {
        // Calculate time remaining (simplified)
        setTimeRemaining(5 * 60); // 5 minutes in seconds
      }
    };

    // Check session every 30 seconds
    const interval = setInterval(checkSession, 30000);

    // Check on activity events
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      if (securityManager) {
        securityManager.updateActivity();
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      clearInterval(interval);
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, [onSessionTimeout]);

  const handleExtendSession = () => {
    const securityManager = (window as any).securityManager as EnhancedSecurityManager;
    if (securityManager) {
      securityManager.extendSession();
    }
    setShowWarning(false);
    onExtendSession();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!showWarning) return null;

  return (
    <Alert className="fixed top-4 right-4 max-w-md z-50 border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="text-orange-800">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Session Expiring Soon</p>
            <p className="text-sm">Your session will expire in {formatTime(timeRemaining)}</p>
          </div>
          <div className="flex gap-2 ml-4">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleExtendSession}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Clock className="w-3 h-3 mr-1" />
              Extend
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
