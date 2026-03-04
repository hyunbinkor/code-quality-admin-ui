/**
 * src/pages/DashboardPage.tsx
 *
 * 대시보드 페이지.
 *   - 서버 연결 상태 표시 (ServerStatus 컴포넌트)
 *   - /api/data/stats 통계 위젯 (규칙 수, 태그 수, 카테고리 분포)
 *   - 마지막 Pull / Push 시각 (dataStore에서 읽기)
 *
 * [Fix] antd v6 deprecated API 수정
 *   - Statistic: valueStyle → styles={{ content: { ... } }}
 *   - Alert: message → title
 */
import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Typography,
  Space,
  Button,
  Progress,
  Divider,
  Alert,
  Spin,
  Tooltip,
} from 'antd';
import {
  FileTextOutlined,
  TagsOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ApiOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import ServerStatus from '@/components/common/ServerStatus';
import { getStats } from '@/api/dataApi';
import { useDataStore } from '@/stores/dataStore';
import { useUiStore } from '@/stores/uiStore';
import type { StatsResponse } from '@/types/api';
import { RULE_CATEGORY_LABELS } from '@/types/rule';

const { Title, Text } = Typography;

const CATEGORY_COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#f5222d',
  '#722ed1', '#13c2c2', '#eb2f96', '#faad14', '#a0d911',
];

function formatDateTime(iso: string | null): string {
  if (!iso) return '없음';
  return new Date(iso).toLocaleString('ko-KR', {
    year:   'numeric',
    month:  '2-digit',
    day:    '2-digit',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function DashboardPage() {
  const lastPullAt  = useDataStore((s) => s.lastPullAt);
  const lastPushAt  = useDataStore((s) => s.lastPushAt);
  const rules       = useDataStore((s) => s.rules);
  const notifyError = useUiStore((s) => s.notifyError);

  const [stats, setStats]               = useState<StatsResponse['stats'] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError]     = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await getStats();
      setStats(res.stats);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '통계 조회 실패';
      setStatsError(msg);
      notifyError('통계 조회 실패', msg);
    } finally {
      setStatsLoading(false);
    }
  }, [notifyError]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // 로컬 규칙 기반 카테고리별 집계
  const categoryCounts = rules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.category] = (acc[rule.category] ?? 0) + 1;
    return acc;
  }, {});
  const totalRules  = rules.length;
  const activeRules = rules.filter((r) => r.isActive).length;

  return (
    <div>
      {/* ── 타이틀 ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>대시보드</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchStats} loading={statsLoading}>
          통계 새로고침
        </Button>
      </div>

      {/* ── 서버 연결 상태 ───────────────────────────────────────────────── */}
      <Card title={<Space><ApiOutlined />서버 연결 상태</Space>} size="small" style={{ marginBottom: 24 }}>
        <Space size={16}>
          <ServerStatus />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {import.meta.env.VITE_API_URL || 'http://localhost:3000'}
            &nbsp;·&nbsp;30초 간격 자동 확인
          </Text>
        </Space>
      </Card>

      {/* ── 통계 카드 4개 ────────────────────────────────────────────────── */}
      <Spin spinning={statsLoading}>
        {statsError && (
          <Alert
            type="warning"
            showIcon
            title="서버 통계를 불러오지 못했습니다."
            description="서버 연결을 확인하세요. 아래 수치는 로컬 데이터 기준입니다."
            closable
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="전체 규칙"
                value={stats?.rules.count ?? (totalRules || '—')}
                prefix={<FileTextOutlined />}
                suffix={stats || totalRules > 0 ? '개' : ''}
                styles={{ content: { color: '#1677ff' } }}
              />
              {!stats && totalRules > 0 && (
                <Text type="secondary" style={{ fontSize: 11 }}>로컬 기준</Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="활성 규칙"
                value={totalRules > 0 ? activeRules : '—'}
                prefix={<FileTextOutlined />}
                suffix={totalRules > 0 ? '개' : ''}
                styles={{ content: { color: '#52c41a' } }}
              />
              {totalRules > 0 && (
                <Progress
                  percent={Math.round((activeRules / totalRules) * 100)}
                  size="small"
                  strokeColor="#52c41a"
                  style={{ marginTop: 8 }}
                />
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="태그 수"
                value={stats?.tags.count ?? '—'}
                prefix={<TagsOutlined />}
                suffix={stats ? '개' : ''}
                styles={{ content: { color: '#722ed1' } }}
              />
              {stats && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  복합 태그 {stats.tags.compoundCount}개 포함
                </Text>
              )}
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="카테고리 수"
                value={stats?.tags.categories.length ?? '—'}
                prefix={<AppstoreOutlined />}
                suffix={stats ? '개' : ''}
                styles={{ content: { color: '#fa8c16' } }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>

      {/* ── 카테고리별 규칙 분포 (로컬 데이터 기준) ─────────────────────── */}
      {totalRules > 0 && (
        <Card
          title={
            <Space>
              <AppstoreOutlined />
              카테고리별 규칙 분포
              <Text type="secondary" style={{ fontSize: 12 }}>(로컬 기준)</Text>
            </Space>
          }
          size="small"
          style={{ marginTop: 16 }}
        >
          <Row gutter={[8, 8]}>
            {Object.entries(categoryCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count], idx) => (
                <Col key={cat} xs={24} sm={12} lg={8}>
                  <Tooltip title={`${RULE_CATEGORY_LABELS[cat as keyof typeof RULE_CATEGORY_LABELS] ?? cat}: ${count}개`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 12, width: 160, flexShrink: 0 }} ellipsis>
                        {RULE_CATEGORY_LABELS[cat as keyof typeof RULE_CATEGORY_LABELS] ?? cat}
                      </Text>
                      <Progress
                        percent={Math.round((count / totalRules) * 100)}
                        size="small"
                        strokeColor={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        format={() => `${count}`}
                        style={{ flex: 1, margin: 0 }}
                      />
                    </div>
                  </Tooltip>
                </Col>
              ))}
          </Row>
        </Card>
      )}

      {/* ── 동기화 정보 ──────────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title={<Space><ClockCircleOutlined />동기화 정보</Space>}>
            <Statistic
              title="마지막 Pull"
              value={formatDateTime(lastPullAt)}
              styles={{ content: { fontSize: 15, color: lastPullAt ? '#1677ff' : '#bfbfbf' } }}
            />
            <Divider style={{ margin: '16px 0' }} />
            <Statistic
              title="마지막 Push"
              value={formatDateTime(lastPushAt)}
              styles={{ content: { fontSize: 15, color: lastPushAt ? '#52c41a' : '#bfbfbf' } }}
            />
            <Divider style={{ margin: '16px 0' }} />
            <Statistic
              title="로컬 데이터"
              value={totalRules > 0 ? `규칙 ${totalRules}개 로드됨` : 'Pull이 필요합니다'}
              styles={{ content: { fontSize: 15, color: totalRules > 0 ? '#52c41a' : '#bfbfbf' } }}
            />
          </Card>
        </Col>

        {stats && stats.tags.categories.length > 0 && (
          <Col xs={24} lg={12}>
            <Card title="태그 카테고리 (서버 기준)" size="small">
              <Space wrap>
                {stats.tags.categories.map((cat) => (
                  <Text key={cat} code style={{ fontSize: 12 }}>{cat}</Text>
                ))}
              </Space>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}