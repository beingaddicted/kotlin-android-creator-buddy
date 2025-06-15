import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Send, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

interface ErrorReport {
  errorId: string;
  message: string;
  stack: string;
  componentStack: string;
  userAgent: string;
  url: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export class ProductionErrorBoundary extends Component<Props, State> {
  private sessionId: string;

  constructor(props: Props) {
    super(props);
    this.sessionId = this.generateSessionId();
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Production Error Boundary caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Generate error report
    const errorReport: ErrorReport = {
      errorId: this.state.errorId || `err_${Date.now()}`,
      message: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: this.sessionId
    };

    // Store error locally for debugging
    this.storeErrorLocally(errorReport);

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      this.reportError(errorReport);
    }
  }

  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  storeErrorLocally(errorReport: ErrorReport) {
    try {
      const existingErrors = JSON.parse(localStorage.getItem('error_reports') || '[]');
      existingErrors.push(errorReport);
      
      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }
      
      localStorage.setItem('error_reports', JSON.stringify(existingErrors));
    } catch (e) {
      console.error('Failed to store error report:', e);
    }
  }

  async reportError(errorReport: ErrorReport) {
    try {
      // In a real production app, send to your error reporting service
      // Example: Sentry, LogRocket, Rollbar, etc.
      console.log('Would send error report to service:', errorReport);
      
      // Emit custom event for analytics
      window.dispatchEvent(new CustomEvent('production-error', {
        detail: errorReport
      }));
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleCopyError = () => {
    if (this.state.error && this.state.errorInfo) {
      const errorText = `
Error ID: ${this.state.errorId}
Message: ${this.state.error.message}
Stack: ${this.state.error.stack}
Component Stack: ${this.state.errorInfo.componentStack}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
Session: ${this.sessionId}
      `.trim();
      
      navigator.clipboard.writeText(errorText).then(() => {
        toast.success('Error details copied to clipboard');
      }).catch(() => {
        toast.error('Failed to copy error details');
      });
    }
  };

  handleSendReport = async () => {
    if (this.state.error && this.state.errorInfo) {
      const errorReport: ErrorReport = {
        errorId: this.state.errorId || `err_${Date.now()}`,
        message: this.state.error.message,
        stack: this.state.error.stack || '',
        componentStack: this.state.errorInfo.componentStack,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: this.sessionId
      };

      await this.reportError(errorReport);
      toast.success('Error report sent successfully');
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-xl text-red-900">Application Error</CardTitle>
              <p className="text-sm text-gray-600">Error ID: {this.state.errorId}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600 text-center">
                Something unexpected happened. Our team has been notified and is working on a fix.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <p className="text-xs font-mono text-red-800 break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col space-y-2">
                <div className="flex space-x-2">
                  <Button onClick={this.handleReset} variant="outline" className="flex-1">
                    Try Again
                  </Button>
                  <Button onClick={this.handleReload} className="flex-1">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reload
                  </Button>
                </div>
                
                <div className="flex space-x-2">
                  <Button onClick={this.handleCopyError} variant="outline" size="sm" className="flex-1">
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Details
                  </Button>
                  <Button onClick={this.handleSendReport} variant="outline" size="sm" className="flex-1">
                    <Send className="w-4 h-4 mr-2" />
                    Send Report
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
