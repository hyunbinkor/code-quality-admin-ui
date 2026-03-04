/**
 * src/components/common/ErrorBoundary.tsx
 *
 * React 에러 바운더리 컴포넌트.
 * 하위 컴포넌트에서 발생하는 런타임 에러를 캐치하여
 * UI 전체가 깨지는 것을 방지하고 복구 UI를 제공합니다.
 *
 * Step 14 변경사항:
 *   - "다시 시도" 버튼: 에러 상태 초기화 (state reset)
 *   - "페이지 새로고침" 버튼: window.location.reload() → 완전 초기화
 *   - 에러 상세(message) 표시
 *   - 개발 환경에서 stack trace 노출
 *
 * 사용 예시:
 *   // 최상단 (main.tsx) — 전체 보호
 *   <ErrorBoundary><App /></ErrorBoundary>
 *
 *   // 특정 섹션 보호 (에러가 해당 섹션만 격리)
 *   <ErrorBoundary fallback={<Alert type="error" message="위젯 오류" />}>
 *     <SomeWidget />
 *   </ErrorBoundary>
 */
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Result, Space, Typography, Collapse } from 'antd';
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  children: ReactNode;
  /** 커스텀 폴백 UI. 지정하지 않으면 기본 Result 폴백 표시 */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 개발 환경에서만 스택 출력 (운영 환경에서는 외부 로거로 전송 가능)
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary] 컴포넌트 에러:', error);
      console.error('[ErrorBoundary] 컴포넌트 스택:', info.componentStack);
    }
    this.setState({ errorInfo: info });
  }

  /** 에러 상태 초기화 — 같은 컴포넌트 트리를 다시 렌더링 시도 */
  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  /** 페이지 전체 새로고침 — IndexedDB 데이터는 유지됨 */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // 커스텀 폴백이 있으면 사용
    if (this.props.fallback) {
      return this.props.fallback;
    }

    const { error, errorInfo } = this.state;
    const isDev = import.meta.env.DEV;

    const stackItems = isDev && (error?.stack || errorInfo?.componentStack)
      ? [
          {
            key: 'stack',
            label: '에러 상세 (개발 환경)',
            children: (
              <pre
                style={{
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: 300,
                  overflow: 'auto',
                  background: '#f5f5f5',
                  padding: 12,
                  borderRadius: 4,
                }}
              >
                {error?.stack ?? ''}
                {errorInfo?.componentStack ? `\n\n컴포넌트 스택:${errorInfo.componentStack}` : ''}
              </pre>
            ),
          },
        ]
      : [];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 600, width: '100%' }}>
          <Result
            status="error"
            title="오류가 발생했습니다"
            subTitle={
              <Space direction="vertical" size={4}>
                <Text type="secondary">
                  예상치 못한 오류로 이 영역을 표시할 수 없습니다.
                </Text>
                {error?.message && (
                  <Text code style={{ fontSize: 12, wordBreak: 'break-all' }}>
                    {error.message}
                  </Text>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button icon={<RollbackOutlined />} onClick={this.handleReset}>
                  다시 시도
                </Button>
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={this.handleReload}
                >
                  페이지 새로고침
                </Button>
              </Space>
            }
          />

          {stackItems.length > 0 && (
            <Collapse size="small" items={stackItems} style={{ marginTop: 16 }} />
          )}
        </div>
      </div>
    );
  }
}