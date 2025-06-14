
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';

export const NetworkStatus = () => {
  const { isOnline, wasOffline } = useNetworkStatus();

  if (isOnline && !wasOffline) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Alert variant={isOnline ? 'default' : 'destructive'}>
        {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        <AlertDescription>
          {isOnline 
            ? 'Back online! Data will be synced automatically.' 
            : 'You\'re offline. Some features may not work properly.'
          }
        </AlertDescription>
      </Alert>
    </div>
  );
};
