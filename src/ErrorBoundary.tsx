import React from 'react';

type Fallback = React.ReactNode | ((error: Error | null) => React.ReactNode);

export class ErrorBoundary extends React.Component<
  { fallback: Fallback, children: React.ReactNode },
  { hasError: boolean, error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: any) {
    if (this.props.children !== prevProps.children) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      return typeof fallback === 'function' ? fallback(this.state.error) : fallback;
    }
    return this.props.children;
  }
}
