/**
 * ServerStatus.tsx
 * 서버 연결 상태 표시 컴포넌트 (🟢/🔴)
 * Step 6 대시보드 구현 시 uiStore와 연동하여 실제 상태를 반영합니다.
 * 현재는 UI 구조만 정의합니다.
 */
import { Tag, Tooltip } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

export type ServerConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface ServerStatusProps {
  status: ServerConnectionStatus;
  lastChecked?: string; // ISO datetime
}

const statusConfig: Record<
  ServerConnectionStatus,
  { color: string; icon: React.ReactNode; label: string }
> = {
  connected: {
    color: 'success',
    icon: <CheckCircleOutlined />,
    label: '서버 연결됨',
  },
  disconnected: {
    color: 'error',
    icon: <CloseCircleOutlined />,
    label: '서버 연결 안됨',
  },
  checking: {
    color: 'processing',
    icon: <LoadingOutlined />,
    label: '연결 확인 중',
  },
};

export default function ServerStatus({ status, lastChecked }: ServerStatusProps) {
  const config = statusConfig[status];

  const tooltipTitle = lastChecked
    ? `마지막 확인: ${new Date(lastChecked).toLocaleString('ko-KR')}`
    : '서버 상태를 확인 중입니다';

  return (
    <Tooltip title={tooltipTitle}>
      <Tag color={config.color} icon={config.icon} style={{ margin: 0, cursor: 'default' }}>
        {config.label}
      </Tag>
    </Tooltip>
  );
}
