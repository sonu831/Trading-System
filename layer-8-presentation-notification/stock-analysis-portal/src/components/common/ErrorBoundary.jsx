import React from 'react';
import PropTypes from 'prop-types';
import { Card, Button } from '@/components/ui';

/**
 * ErrorBoundary Component
 * Catches JavaScript errors anywhere in their child component tree.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card variant="glass" className="max-w-lg w-full text-center border-rose-500/30 bg-rose-900/10">
            <div className="text-5xl mb-4">💥</div>
            <h2 className="text-2xl font-bold text-rose-400 mb-2">Something went wrong</h2>
            <p className="text-slate-300 mb-6">
              We encountered an unexpected error while rendering this component.
            </p>
            
            {this.state.error && (
              <div className="bg-black/30 p-4 rounded text-left mb-6 overflow-auto max-h-48">
                <code className="text-xs text-rose-300 font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}

            <div className="flex justify-center gap-4">
              <Button onClick={() => window.location.reload()} variant="secondary">
                Reload Page
              </Button>
              <Button onClick={this.handleReset} variant="danger">
                Try Again
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  onReset: PropTypes.func,
};

export default ErrorBoundary;
