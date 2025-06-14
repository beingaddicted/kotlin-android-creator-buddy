
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export const useOptimisticUpdates = <T,>(queryKey: string[]) => {
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateOptimistically = useCallback(async (
    updateFn: (oldData: T) => T,
    mutationFn: () => Promise<T>,
    options?: {
      onSuccess?: (data: T) => void;
      onError?: (error: Error) => void;
    }
  ) => {
    setIsUpdating(true);
    
    // Get current data
    const previousData = queryClient.getQueryData<T>(queryKey);
    
    if (!previousData) {
      setIsUpdating(false);
      return;
    }

    // Optimistically update
    const optimisticData = updateFn(previousData);
    queryClient.setQueryData(queryKey, optimisticData);

    try {
      // Perform actual mutation
      const result = await mutationFn();
      
      // Update with real data
      queryClient.setQueryData(queryKey, result);
      options?.onSuccess?.(result);
      
    } catch (error) {
      // Revert on error
      queryClient.setQueryData(queryKey, previousData);
      options?.onError?.(error as Error);
      toast.error('Update failed, changes reverted');
    } finally {
      setIsUpdating(false);
    }
  }, [queryClient, queryKey]);

  return { updateOptimistically, isUpdating };
};
