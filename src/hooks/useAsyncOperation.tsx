
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export const useAsyncOperation = <T,>(
  operation: (...args: any[]) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
    showSuccessToast?: boolean;
    showErrorToast?: boolean;
  }
) => {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null
  });

  const execute = useCallback(async (...args: any[]) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const result = await operation(...args);
      setState({ data: result, loading: false, error: null });
      
      if (options?.onSuccess) {
        options.onSuccess(result);
      }
      
      if (options?.showSuccessToast) {
        toast.success('Operation completed successfully');
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Operation failed';
      setState(prev => ({ ...prev, loading: false, error: errorMessage }));
      
      if (options?.onError) {
        options.onError(errorMessage);
      }
      
      if (options?.showErrorToast) {
        toast.error(errorMessage);
      }
      
      throw error;
    }
  }, [operation, options]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
};
