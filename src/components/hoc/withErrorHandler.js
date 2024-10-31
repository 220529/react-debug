// withErrorBoundary.js
import React from "react";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

// 错误回退 UI 组件
const ErrorFallback = ({ error, resetErrorBoundary }) => {
  return (
    <div role="alert" style={{ border: "1px solid red", padding: "10px" }}>
      <h2>Oops, something went wrong!</h2>
      <p>Error details: {error.message}</p>
      <button onClick={resetErrorBoundary}>重试</button>
    </div>
  );
};

// 错误上报函数
const reportError = (error) => {
  console.error("Reporting error to monitoring service:", error);
  // 例如使用 Sentry
  // Sentry.captureException(error);
};

// 创建高阶组件
export default (WrappedComponent) => {
  return (props) => {
    return (
      <ReactErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={reportError}
      >
        <WrappedComponent {...props} />
      </ReactErrorBoundary>
    );
  };
};
