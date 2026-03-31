import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950">
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-[2.5rem] border dark:border-neutral-800 shadow-xl max-w-md w-full text-center space-y-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-600 dark:text-red-400 w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Something went wrong</h2>
              <p className="text-neutral-500 text-sm">
                An unexpected error occurred. Please try refreshing the page.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-[10px] bg-neutral-100 dark:bg-neutral-800 p-4 rounded-xl overflow-auto max-h-32 text-left text-red-500">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-amber-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
            >
              <RefreshCcw className="w-5 h-5" />
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
