import { t } from '@/utils/i18n';
import { Button, Result } from 'antd';
import React from 'react';
import { claimAutoReload, isChunkLoadError } from './chunkError';

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 发版后旧 chunk 已被删除：自动刷新一次换到新版本（见 ./chunkError.ts）
    if (isChunkLoadError(error) && claimAutoReload(window.sessionStorage)) {
      window.location.reload();
      return;
    }
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }
    if (isChunkLoadError(this.state.error)) {
      return (
        <Result
          status="info"
          title={t('error.updated.title')}
          subTitle={t('error.updated.subTitle')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('error.reload')}
            </Button>
          }
        />
      );
    }
    return (
      <Result
        status="error"
        title={t('error.title')}
        subTitle={this.state.error?.message}
        extra={
          <Button type="primary" onClick={this.handleReset}>
            {t('error.retry')}
          </Button>
        }
      />
    );
  }
}

export default ErrorBoundary;
