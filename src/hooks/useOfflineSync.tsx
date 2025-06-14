
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PendingOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
}

export const useOfflineSync = () => {
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Load pending operations from localStorage
    const stored = localStorage.getItem('pending_operations');
    if (stored) {
      setPendingOperations(JSON.parse(stored));
    }

    // Listen for network reconnection
    const handleReconnect = () => syncPendingOperations();
    window.addEventListener('network-reconnected', handleReconnect);

    return () => window.removeEventListener('network-reconnected', handleReconnect);
  }, []);

  const addPendingOperation = (operation: Omit<PendingOperation, 'id' | 'timestamp'>) => {
    const newOperation: PendingOperation = {
      ...operation,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    const updated = [...pendingOperations, newOperation];
    setPendingOperations(updated);
    localStorage.setItem('pending_operations', JSON.stringify(updated));
  };

  const syncPendingOperations = async () => {
    if (pendingOperations.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const successful: string[] = [];

    for (const operation of pendingOperations) {
      try {
        let query = supabase.from(operation.table);

        switch (operation.operation) {
          case 'insert':
            await query.insert(operation.data);
            break;
          case 'update':
            await query.update(operation.data).eq('id', operation.data.id);
            break;
          case 'delete':
            await query.delete().eq('id', operation.data.id);
            break;
        }

        successful.push(operation.id);
      } catch (error) {
        console.error('Failed to sync operation:', operation, error);
      }
    }

    // Remove successful operations
    const remaining = pendingOperations.filter(op => !successful.includes(op.id));
    setPendingOperations(remaining);
    localStorage.setItem('pending_operations', JSON.stringify(remaining));
    
    setIsSyncing(false);
  };

  return {
    pendingOperations,
    addPendingOperation,
    syncPendingOperations,
    isSyncing,
  };
};
