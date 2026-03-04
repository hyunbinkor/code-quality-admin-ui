/**
 * src/components/common/ServerStatus.tsx
 *
 * 서버 연결 상태 표시 컴포넌트 (🟢/🔴).
 * uiStore의 serverStatus를 구독합니다.
 *
 * ⚠️ TSX 파싱 주의:
 *   Record<K, { ... }> 멀티라인 제네릭에서 '>'를 JSX 닫는 태그로
 *   오해하는 버그를 피하기 위해 값 타입을 interface로 분리합니다.
 */
import { Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useServerStatus } from '@/stores/uiStore';
import type { ServerStatus as ServerStatusType } from '@/stores/uiStore';

/** statusConfig 값 타입 — 인터페이스로 분리해야 TSX 파싱 오류를 피할 수 있음 */
interface StatusConfigEntry {
  color: string;
  icon: React.ReactNode;
  label: string;
}

export default function ServerStatus() {
  const { serverStatus, lastCheckedAt, serverVersion } = useServerStatus();

  // JSX를 값으로 갖는 객체는 컴포넌트 내부에 정의
  // 타입 주석은 Record<K, Interface> 형태로 한 줄에 맞춰 TSX 파싱 충돌 방지
  const statusConfig: Record<ServerStatusType, StatusConfigEntry> = {
    connected:    { color: 'success',    icon: <CheckCircleOutlined />, label: '서버 연결됨' },
    disconnected: { color: 'error',      icon: <CloseCircleOutlined />, label: '서버 연결 안됨' },
    checking:     { color: 'processing', icon: <LoadingOutlined />,     label: '연결 확인 중' },
  };

  const config = statusConfig[serverStatus];

  const tooltipTitle = [
    lastCheckedAt
      ? `마지막 확인: ${new Date(lastCheckedAt).toLocaleString('ko-KR')}`
      : '아직 확인하지 않았습니다.',
    serverVersion ? `서버 버전: v${serverVersion}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip title={tooltipTitle}>
      <Tag
        color={config.color}
        icon={config.icon}
        style={{ margin: 0, cursor: 'default' }}
      >
        {config.label}
      </Tag>
    </Tooltip>
  );
}