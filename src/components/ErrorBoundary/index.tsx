import { getIntl } from '@umijs/max';
import { Button, Result } from 'antd';
import React from 'react';
import { claimAutoReload, isChunkLoadError } from './chunkError';

interface State {
  hasError: boolean;
  error?: Error;
}

/** 类组件取不到 useIntl：走 umi 的 getIntl，locale 未就绪时回退中文 */
const t = (id: string, fallback: string) => {
  try {
    return getIntl().formatMessage({ id, defaultMessage: fallback });
  } catch {
    return fallback;
  }
};

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
          title={t('error.updated.title', '站点已更新')}
          subTitle={t('error.updated.subTitle', '当前页面的资源版本已过期，刷新后即可继续使用。')}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t('error.reload', '刷新页面')}
            </Button>
          }
        />
      );
    }
    return (
      <Result
        status="error"
        title={t('error.title', '页面出现错误')}
        subTitle={this.state.error?.message}
        extra={
          <Button type="primary" onClick={this.handleReset}>
            {t('error.retry', '重试')}
          </Button>
        }
      />
    );
  }
}

export default ErrorBoundary;
