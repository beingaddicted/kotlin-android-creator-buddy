
import { useCallback, useRef, useMemo } from 'react';

export const useOptimizedOperations = () => {
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const throttleTimers = useRef<Map<string, boolean>>(new Map());

  const debounce = useCallback(<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number
  ): T => {
    return ((...args: any[]) => {
      const existingTimer = debounceTimers.current.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      const newTimer = setTimeout(() => {
        func.apply(this, args);
        debounceTimers.current.delete(key);
      }, delay);
      
      debounceTimers.current.set(key, newTimer);
    }) as T;
  }, []);

  const throttle = useCallback(<T extends (...args: any[]) => any>(
    key: string,
    func: T,
    delay: number
  ): T => {
    return ((...args: any[]) => {
      const isThrottled = throttleTimers.current.get(key);
      if (!isThrottled) {
        func.apply(this, args);
        throttleTimers.current.set(key, true);
        setTimeout(() => {
          throttleTimers.current.delete(key);
        }, delay);
      }
    }) as T;
  }, []);

  const memoize = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ) => {
    const cache = new Map<string, ReturnType<T>>();
    
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (cache.has(key)) {
        return cache.get(key)!;
      }
      
      const result = func(...args);
      cache.set(key, result);
      
      // Limit cache size to prevent memory leaks
      if (cache.size > 100) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
      }
      
      return result;
    }) as T;
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    debounceTimers.current.forEach(timer => clearTimeout(timer));
    debounceTimers.current.clear();
    throttleTimers.current.clear();
  }, []);

  return useMemo(() => ({
    debounce,
    throttle,
    memoize,
    cleanup
  }), [debounce, throttle, memoize, cleanup]);
};
