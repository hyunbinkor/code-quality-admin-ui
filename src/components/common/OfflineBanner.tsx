/**
 * src/components/common/OfflineBanner.tsx
 *
 * 서버 연결이 끊긴 상태일 때 페이지 상단에 오프라인 모드 배너를 표시합니다.
 *
 * - serverStatus === 'disconnected'일 때만 렌더링 (connected/checking 시 null 반환)
 * - 편집 내용은 IndexedDB에 자동 저장됨을 안내
 * - "동기화 페이지로 이동" 버튼으로 /sync 접근 유도
 *
 * 배치: App.tsx의 <Content> 바로 위 (Layout > Content 사이)
 */
import { useNavigate } from 'react-router-dom';
import { Alert, Button } from 'antd';
import { DisconnectOutlined, SyncOutlined } from '@ant-design/icons';
import { useServerStatus } from '@/stores/uiStore';

export default function OfflineBanner() {
  const { serverStatus } = useServerStatus();
  const navigate         = useNavigate();

  if (serverStatus !== 'disconnected') return null;

  return (
    <Alert
      type="warning"
      showIcon
      icon={<DisconnectOutlined />}
      banner
      title={
        <span>
          <strong>오프라인 모드</strong>
          &nbsp;—&nbsp;서버에 연결할 수 없습니다.
          편집 내용은 로컬(IndexedDB)에 자동 저장됩니다.
        </span>
      }
      action={
        <Button
          size="small"
          icon={<SyncOutlined />}
          onClick={() => navigate('/sync')}
          style={{ marginLeft: 8 }}
        >
          동기화 페이지
        </Button>
      }
      style={{
        borderRadius: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderTop: 'none',
        marginBottom: 0,
      }}
    />
  );
}