/**
 * src/hooks/useOnlineSync.ts
 *
 * 서버 연결 상태가 'disconnected' → 'connected'로 전환될 때
 * "서버에 동기화하시겠습니까?" 확인 모달을 표시하는 커스텀 훅.
 *
 * 동작:
 *   - uiStore의 serverStatus를 구독
 *   - 이전 상태가 'disconnected'이고 현재 상태가 'connected'인 경우에만 모달 표시
 *     (앱 최초 기동 시 'checking' → 'connected' 전환은 무시)
 *   - 모달에서 "동기화 페이지로 이동" 선택 시 /sync 페이지로 이동
 *
 * 주의:
 *   - react-router-dom의 useNavigate를 사용하므로 반드시 <BrowserRouter> 내부에서 호출해야 합니다.
 *   - App.tsx에서 AppInner 컴포넌트(라우터 내부)에 배치하세요.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { WifiOutlined } from '@ant-design/icons';
import { useUiStore, type ServerStatus } from '@/stores/uiStore';
import { useDataStore } from '@/stores/dataStore';

export default function useOnlineSync(): void {
  const serverStatus   = useUiStore((s) => s.serverStatus);
  const prevStatusRef  = useRef<ServerStatus>(serverStatus);
  const navigate       = useNavigate();

  // 로컬 데이터가 있는지 확인 (동기화 안내를 띄울 가치가 있는지)
  const hasLocalData   = useDataStore((s) => s.rules.length > 0 || s.baseVersion !== null);

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = serverStatus;

    // 'disconnected' → 'connected' 전환만 처리
    // ('checking' → 'connected'는 앱 초기 기동이므로 무시)
    if (prev !== 'disconnected' || serverStatus !== 'connected') return;

    // 로컬 데이터가 없으면 동기화 안내 불필요
    if (!hasLocalData) return;

    Modal.confirm({
      title: '서버에 연결되었습니다',
      icon: <WifiOutlined style={{ color: '#52c41a' }} />,
      content:
        '오프라인 상태에서 편집한 내용이 있을 수 있습니다. ' +
        '동기화 페이지에서 변경사항을 확인하고 서버에 반영하시겠습니까?',
      okText: '동기화 페이지로 이동',
      cancelText: '나중에',
      okButtonProps: { type: 'primary' },
      onOk: () => {
        navigate('/sync');
      },
    });
  }, [serverStatus, hasLocalData, navigate]);
}