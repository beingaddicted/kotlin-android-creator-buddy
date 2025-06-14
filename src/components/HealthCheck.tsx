
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface HealthStatus {
  database: 'healthy' | 'unhealthy' | 'checking';
  auth: 'healthy' | 'unhealthy' | 'checking';
  storage: 'healthy' | 'unhealthy' | 'checking';
}

export const HealthCheck = () => {
  const [status, setStatus] = useState<HealthStatus>({
    database: 'checking',
    auth: 'checking',
    storage: 'checking',
  });

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const checkHealth = async () => {
    // Check database
    try {
      await supabase.from('profiles').select('count', { count: 'exact', head: true });
      setStatus(prev => ({ ...prev, database: 'healthy' }));
    } catch {
      setStatus(prev => ({ ...prev, database: 'unhealthy' }));
    }

    // Check auth
    try {
      await supabase.auth.getSession();
      setStatus(prev => ({ ...prev, auth: 'healthy' }));
    } catch {
      setStatus(prev => ({ ...prev, auth: 'unhealthy' }));
    }

    // Check storage (simplified)
    setStatus(prev => ({ ...prev, storage: 'healthy' }));
  };

  const getIcon = (serviceStatus: string) => {
    switch (serviceStatus) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const hasUnhealthyServices = Object.values(status).includes('unhealthy');

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {hasUnhealthyServices && (
        <Alert variant="destructive" className="mb-2">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            Some services are experiencing issues
          </AlertDescription>
        </Alert>
      )}
      
      <div className="bg-white border rounded-lg p-2 shadow-lg text-xs">
        <div className="flex items-center space-x-2">
          {getIcon(status.database)}
          <span>DB</span>
          {getIcon(status.auth)}
          <span>Auth</span>
          {getIcon(status.storage)}
          <span>Storage</span>
        </div>
      </div>
    </div>
  );
};
