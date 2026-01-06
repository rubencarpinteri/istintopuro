import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
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
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] text-white p-4 text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
          <p className="text-gray-400 mb-6 max-w-md mx-auto break-words">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-[#0066CC] rounded-xl font-bold hover:bg-[#0052a3] transition-colors"
          >
            Reload Game
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}