
import { useState, useCallback } from 'react';
import { RateLimiter } from '@/utils/security';

export const useRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const [rateLimiter] = useState(() => new RateLimiter(maxAttempts, windowMs));
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const checkRateLimit = useCallback((key: string): boolean => {
    const allowed = rateLimiter.isAllowed(key);
    
    if (!allowed) {
      const remaining = rateLimiter.getRemainingTime(key);
      setIsRateLimited(true);
      setRemainingTime(remaining);
      
      // Auto-reset when time expires
      setTimeout(() => {
        setIsRateLimited(false);
        setRemainingTime(0);
      }, remaining);
      
      return false;
    }

    setIsRateLimited(false);
    setRemainingTime(0);
    return true;
  }, [rateLimiter]);

  return {
    checkRateLimit,
    isRateLimited,
    remainingTime: Math.ceil(remainingTime / 1000) // Convert to seconds
  };
};
