import * as React from 'react';

// 定义一个错误边界组件
// import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, errorInfo) {
    console.log(`error, errorInfo`, error, errorInfo);
    if (window.elasticApmInstance) {
      window.elasticApmInstance.captureError(error);
    }
    // You can also log the error to an error reporting service
    // logErrorToMyService(error, errorInfo);
  }

  render() {
    console.log("this.state", this.state);
    const { hasError, errorMessage } = this.state;
    const { children } = this.props;
    if (hasError) {
      // You can render any custom fallback UI
      return (
        <div>
          <span>服务器错误，请稍后访问</span>
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
