/**
 * src/components/sync/PushConfirm.tsx
 *
 * Push 확인 다이얼로그.
 * - Diff 결과 요약 표시
 * - pushData API 호출 → 성공/충돌/오류 처리
 * - VERSION_CONFLICT(409): 경고 + force Push / Pull 먼저 옵션
 */
import { useState } from 'react';
import {
  Modal,
  Button,
  Space,
  Alert,
  Typography,
  Divider,
  Tag,
  Spin,
  Row,
  Col,
  Card,
  Statistic,
} from 'antd';
import {
  CloudUploadOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloudDownloadOutlined,
} from '@ant-design/icons';
import { pushData } from '@/api/dataApi';
import { isPushConflict, isPushSuccess } from '@/types/api';
import type { DiffResponse } from '@/types/api';

const { Text, Title } = Typography;

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

type PushPhase =
  | 'confirm'    // 초기 확인
  | 'pushing'    // API 호출 중
  | 'conflict'   // VERSION_CONFLICT 409
  | 'success'    // Push 성공
  | 'error';     // 기타 오류

interface PushConfirmProps {
  open: boolean;
  diff: DiffResponse | null;          // Diff 결과 (없으면 요약 생략)
  baseVersion: number | null;
  ruleCount: number;
  tagCount: number;
  onPushSuccess: (newVersion: number) => void;  // 성공 시 부모에 newVersion 전달
  onPullRequested: () => void;                   // "Pull 먼저" 버튼 클릭
  onClose: () => void;
  getPushPayload: (force: boolean) => Parameters<typeof pushData>[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// 변경사항 요약 서브 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

function DiffSummary({ diff }: { diff: DiffResponse }) {
  const r = diff.rules.summary;
  const t = diff.tags.summary;
  const totalChanges = r.addedCount + r.modifiedCount + r.deletedCount
    + t.addedCount + t.modifiedCount + t.deletedCount;

  if (totalChanges === 0) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        title="변경사항 없음"
        description="서버와 완전히 동일합니다. Push가 필요하지 않습니다."
        style={{ marginBottom: 12 }}
      />
    );
  }

  return (
    <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
      <Row gutter={16}>
        <Col span={12}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            규칙 변경
          </Text>
          <Space size={4} wrap>
            {r.addedCount    > 0 && <Tag color="success">+{r.addedCount} 추가</Tag>}
            {r.modifiedCount > 0 && <Tag color="warning">~{r.modifiedCount} 수정</Tag>}
            {r.deletedCount  > 0 && <Tag color="error">-{r.deletedCount} 삭제</Tag>}
            {r.addedCount + r.modifiedCount + r.deletedCount === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>변경 없음</Text>
            )}
          </Space>
        </Col>
        <Col span={12}>
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            태그 변경
          </Text>
          <Space size={4} wrap>
            {t.addedCount    > 0 && <Tag color="success">+{t.addedCount} 추가</Tag>}
            {t.modifiedCount > 0 && <Tag color="warning">~{t.modifiedCount} 수정</Tag>}
            {t.deletedCount  > 0 && <Tag color="error">-{t.deletedCount} 삭제</Tag>}
            {t.addedCount + t.modifiedCount + t.deletedCount === 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>변경 없음</Text>
            )}
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

export default function PushConfirm({
  open,
  diff,
  baseVersion,
  ruleCount,
  tagCount,
  onPushSuccess,
  onPullRequested,
  onClose,
  getPushPayload,
}: PushConfirmProps) {
  const [phase, setPhase]               = useState<PushPhase>('confirm');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [conflictInfo, setConflictInfo] = useState<{
    baseVersion: number;
    currentVersion: number;
  } | null>(null);
  const [successInfo, setSuccessInfo]   = useState<{
    newVersion: number;
    pushedAt: string;
    backupPath: string;
    rules: { total: number; success: number; failed: number };
    tags: { total: number };
  } | null>(null);

  // ── 공통 Push 호출 ────────────────────────────────────────────────────────
  const executePush = async (force: boolean) => {
    setPhase('pushing');
    setErrorMessage('');

    try {
      const payload  = getPushPayload(force);
      const response = await pushData(payload);

      if (isPushSuccess(response)) {
        setSuccessInfo({
          newVersion:  response.newVersion,
          pushedAt:    response.pushedAt,
          backupPath:  response.backupPath,
          rules:       response.rules,
          tags:        response.tags,
        });
        setPhase('success');
        onPushSuccess(response.newVersion);
      } else if (isPushConflict(response)) {
        setConflictInfo({
          baseVersion:    response.baseVersion,
          currentVersion: response.currentVersion,
        });
        setPhase('conflict');
      } else {
        setErrorMessage('알 수 없는 서버 응답입니다.');
        setPhase('error');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Push 요청 실패');
      setPhase('error');
    }
  };

  const handlePush      = () => executePush(false);
  const handleForcePush = () => executePush(true);

  const handleClose = () => {
    setPhase('confirm');
    setErrorMessage('');
    setConflictInfo(null);
    setSuccessInfo(null);
    onClose();
  };

  const handlePullRequested = () => {
    handleClose();
    onPullRequested();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 렌더 — Phase별 분기
  // ─────────────────────────────────────────────────────────────────────────

  // ── pushing ───────────────────────────────────────────────────────────────
  const renderPushing = () => (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <Spin size="large" />
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">서버에 데이터를 업로드하는 중...</Text>
      </div>
    </div>
  );

  // ── success ───────────────────────────────────────────────────────────────
  const renderSuccess = () => (
    <div>
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        title="Push 완료"
        description="로컬 데이터가 서버에 성공적으로 업로드되었습니다."
        style={{ marginBottom: 16 }}
      />
      {successInfo && (
        <Card size="small" style={{ background: '#f6ffed' }}>
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Statistic
                title="새 버전 (newVersion)"
                value={successInfo.newVersion}
                styles={{ content: { fontSize: 13, fontFamily: 'monospace' }}}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Push 완료 시각"
                value={new Date(successInfo.pushedAt).toLocaleString('ko-KR')}
                styles={{ content: { fontSize: 12 }}}
              />
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>규칙: </Text>
              <Text style={{ fontSize: 12 }}>
                {successInfo.rules.success} / {successInfo.rules.total} 성공
                {successInfo.rules.failed > 0 && (
                  <Tag color="error" style={{ marginLeft: 4 }}>
                    {successInfo.rules.failed} 실패
                  </Tag>
                )}
              </Text>
            </Col>
            <Col span={12}>
              <Text type="secondary" style={{ fontSize: 12 }}>태그: </Text>
              <Text style={{ fontSize: 12 }}>{successInfo.tags.total}개</Text>
            </Col>
            <Col span={24}>
              <Text type="secondary" style={{ fontSize: 11 }}>
                백업 경로: <Text code style={{ fontSize: 11 }}>{successInfo.backupPath}</Text>
              </Text>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );

  // ── conflict ──────────────────────────────────────────────────────────────
  const renderConflict = () => (
    <div>
      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        title="버전 충돌 (VERSION_CONFLICT)"
        description={
          <div>
            <Text>서버 데이터가 변경되었습니다. Push 이후 다른 사람이 서버를 수정했거나, Pull 없이 오랜 시간이 지났습니다.</Text>
            <br />
            {conflictInfo && (
              <Space style={{ marginTop: 8 }}>
                <Tag>내 baseVersion: {conflictInfo.baseVersion}</Tag>
                <Tag color="orange">서버 currentVersion: {conflictInfo.currentVersion}</Tag>
              </Space>
            )}
          </div>
        }
        style={{ marginBottom: 16 }}
      />

      <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f', marginBottom: 12 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text strong style={{ fontSize: 13 }}>선택할 수 있는 방법</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Text strong style={{ color: '#52c41a' }}>① Pull 먼저:</Text>{' '}
            서버의 최신 데이터를 가져온 뒤 내 변경사항을 다시 적용하고 Push합니다. (권장)
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <Text strong style={{ color: '#cf1322' }}>② 강제 Push:</Text>{' '}
            서버 변경사항을 무시하고 내 로컬 데이터로 덮어씁니다. 서버 변경사항이 <Text strong>유실</Text>될 수 있습니다.
          </Text>
        </Space>
      </Card>

      <Row gutter={12}>
        <Col span={12}>
          <Button
            block
            icon={<CloudDownloadOutlined />}
            onClick={handlePullRequested}
            style={{ borderColor: '#1677ff', color: '#1677ff' }}
          >
            Pull 먼저 (권장)
          </Button>
        </Col>
        <Col span={12}>
          <Button
            block
            danger
            icon={<ExclamationCircleOutlined />}
            onClick={handleForcePush}
          >
            강제 Push (덮어쓰기)
          </Button>
        </Col>
      </Row>
    </div>
  );

  // ── error ─────────────────────────────────────────────────────────────────
  const renderError = () => (
    <div>
      <Alert
        type="error"
        showIcon
        title="Push 실패"
        description={errorMessage}
        style={{ marginBottom: 16 }}
      />
      <Button
        icon={<CloudUploadOutlined />}
        onClick={handlePush}
        block
      >
        다시 시도
      </Button>
    </div>
  );

  // ── confirm ───────────────────────────────────────────────────────────────
  const renderConfirm = () => (
    <div>
      <Alert
        type="info"
        showIcon
        title="Push 전 확인"
        description="로컬 데이터를 서버에 업로드합니다. 서버의 기존 데이터는 자동 백업됩니다."
        style={{ marginBottom: 16 }}
      />

      {/* 업로드 데이터 요약 */}
      <Card size="small" style={{ marginBottom: 12, background: '#f0f5ff' }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic
              title="업로드 규칙 수"
              value={ruleCount}
              suffix="개"
              styles={{ content: { fontSize: 20 }}}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="업로드 태그 수"
              value={tagCount}
              suffix="개"
              styles={{ content: { fontSize: 20 }}}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="기준 버전"
              value={baseVersion ?? '-'}
              styles={{ content: { fontSize: 14, fontFamily: 'monospace' }}}
            />
          </Col>
        </Row>
      </Card>

      {/* Diff 요약 */}
      {diff ? (
        <DiffSummary diff={diff} />
      ) : (
        <Alert
          type="warning"
          showIcon
          title="Diff 결과가 없습니다."
          description="Diff를 먼저 실행하면 변경사항을 확인하고 Push할 수 있습니다. 그냥 Push하면 로컬 전체 데이터가 업로드됩니다."
          style={{ marginBottom: 12 }}
        />
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // 푸터 버튼
  // ─────────────────────────────────────────────────────────────────────────

  const renderFooter = () => {
    if (phase === 'pushing')  return null;
    if (phase === 'conflict') return (
      <Button onClick={handleClose}>닫기</Button>
    );
    if (phase === 'success')  return (
      <Button type="primary" onClick={handleClose}>확인</Button>
    );
    if (phase === 'error')    return (
      <Space>
        <Button onClick={handleClose}>닫기</Button>
        <Button type="primary" onClick={handlePush} icon={<CloudUploadOutlined />}>
          다시 시도
        </Button>
      </Space>
    );
    // confirm
    return (
      <Space>
        <Button onClick={handleClose}>취소</Button>
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          onClick={handlePush}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          Push 실행
        </Button>
      </Space>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 모달 제목
  // ─────────────────────────────────────────────────────────────────────────

  const titleMap: Record<PushPhase, React.ReactNode> = {
    confirm:  <Space><CloudUploadOutlined />Push 확인</Space>,
    pushing:  <Space><CloudUploadOutlined />Push 중...</Space>,
    conflict: <Space><WarningOutlined style={{ color: '#faad14' }} />버전 충돌</Space>,
    success:  <Space><CheckCircleOutlined style={{ color: '#52c41a' }} />Push 완료</Space>,
    error:    <Space><ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />Push 실패</Space>,
  };

  return (
    <Modal
      title={titleMap[phase]}
      open={open}
      onCancel={phase === 'pushing' ? undefined : handleClose}
      closable={phase !== 'pushing'}
      maskClosable={phase !== 'pushing'}
      footer={renderFooter()}
      width={560}
      destroyOnHidden={false}
    >
      {phase === 'confirm'  && renderConfirm()}
      {phase === 'pushing'  && renderPushing()}
      {phase === 'success'  && renderSuccess()}
      {phase === 'conflict' && renderConflict()}
      {phase === 'error'    && renderError()}
    </Modal>
  );
}