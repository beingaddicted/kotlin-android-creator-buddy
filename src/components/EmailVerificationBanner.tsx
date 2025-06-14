
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mail, AlertCircle } from 'lucide-react';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

export const EmailVerificationBanner = () => {
  const { user } = useSupabaseAuth();
  const { isVerified, isResending, resendVerification } = useEmailVerification();

  if (!user || isVerified) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Please verify your email address to access all features.</span>
        <Button
          variant="outline"
          size="sm"
          onClick={resendVerification}
          disabled={isResending}
          className="ml-4"
        >
          {isResending ? (
            'Sending...'
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Resend
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
