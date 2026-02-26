/**
 * LoadingSpinner.tsx
 * 전체 화면 또는 컨테이너 내 로딩 스피너 컴포넌트
 */
import { Spin } from 'antd';

interface LoadingSpinnerProps {
  /** 스피너 텍스트 (기본: '로딩 중...') */
  tip?: string;
  /** 전체 화면 오버레이 여부 */
  fullscreen?: boolean;
}

export default function LoadingSpinner({
  tip = '로딩 중...',
  fullscreen = false,
}: LoadingSpinnerProps) {
  if (fullscreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.7)',
          zIndex: 9999,
        }}
      >
        <Spin size="large" tip={tip} />
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
      }}
    >
      <Spin size="large" tip={tip} />
    </div>
  );
}
