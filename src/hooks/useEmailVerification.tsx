
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from './useSupabaseAuth';
import { toast } from 'sonner';

export const useEmailVerification = () => {
  const { user } = useSupabaseAuth();
  const [isVerified, setIsVerified] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (user) {
      setIsVerified(!!user.email_confirmed_at);
    }
  }, [user]);

  const resendVerification = async () => {
    if (!user?.email) {
      toast.error('No email address found');
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        toast.error('Failed to resend verification email');
      } else {
        toast.success('Verification email sent! Please check your inbox.');
      }
    } catch (error) {
      toast.error('An error occurred while sending verification email');
    } finally {
      setIsResending(false);
    }
  };

  return {
    isVerified,
    isResending,
    resendVerification,
  };
};
