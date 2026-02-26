/**
 * ErrorBoundary.tsx
 * React 에러 바운더리 컴포넌트.
 * 하위 컴포넌트에서 발생하는 런타임 에러를 캐치하여 UI가 완전히 깨지는 것을 방지합니다.
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Result } from 'antd';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Result
          status="error"
          title="오류가 발생했습니다"
          subTitle={this.state.error?.message ?? '알 수 없는 오류'}
          extra={
            <Button type="primary" onClick={this.handleReset}>
              다시 시도
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
