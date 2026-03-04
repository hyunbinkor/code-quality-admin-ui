/**
 * src/components/sync/DiffViewer.tsx
 *
 * Diff 결과 시각화 컴포넌트.
 * diffData API 응답(DiffResponse)을 받아 규칙/태그 변경사항을 표시합니다.
 *
 * - added   : 초록 배경
 * - modified: 노란 배경 + 필드별 before/after
 * - deleted : 빨간 배경
 * - hasConflict: 경고 배너
 */
import { useState } from 'react';
import {
  Alert,
  Badge,
  Card,
  Col,
  Collapse,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { DiffResponse, RuleDiffModified } from '@/types/api';
import type { TagDiffModified } from '@/types/tag';
import {
  RULE_SEVERITY_COLORS,
  RULE_CATEGORY_LABELS,
} from '@/types/rule';

const { Text, Title } = Typography;

// ─────────────────────────────────────────────────────────────────────────────
// 색상 / 스타일 상수
// ─────────────────────────────────────────────────────────────────────────────

const ROW_STYLES = {
  added:    { background: '#f6ffed', borderLeft: '3px solid #52c41a' },
  modified: { background: '#fffbe6', borderLeft: '3px solid #faad14' },
  deleted:  { background: '#fff2f0', borderLeft: '3px solid #ff4d4f' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 요약 뱃지 행
// ─────────────────────────────────────────────────────────────────────────────

interface SummaryBadgesProps {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
}

function SummaryBadges({ added, modified, deleted, unchanged }: SummaryBadgesProps) {
  return (
    <Space size={8} wrap>
      <Tag icon={<PlusCircleOutlined />} color="success">추가 {added}</Tag>
      <Tag icon={<EditOutlined />}       color="warning">수정 {modified}</Tag>
      <Tag icon={<DeleteOutlined />}     color="error">삭제 {deleted}</Tag>
      <Tag icon={<CheckCircleOutlined />} color="default">변경 없음 {unchanged}</Tag>
    </Space>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 필드별 변경 테이블 (modified 행 확장)
// ─────────────────────────────────────────────────────────────────────────────

interface FieldChange {
  field: string;
  local: unknown;
  server: unknown;
}

function FieldChangesTable({ changes }: { changes: FieldChange[] }) {
  const columns: ColumnsType<FieldChange> = [
    {
      title: '필드',
      dataIndex: 'field',
      width: 160,
      render: (v: string) => <Text code style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: '서버 (현재)',
      dataIndex: 'server',
      render: (v: unknown) => (
        <Text style={{ fontSize: 12, color: '#cf1322' }}>
          {String(v ?? '(없음)')}
        </Text>
      ),
    },
    {
      title: '로컬 (내 변경)',
      dataIndex: 'local',
      render: (v: unknown) => (
        <Text style={{ fontSize: 12, color: '#389e0d' }}>
          {String(v ?? '(없음)')}
        </Text>
      ),
    },
  ];

  return (
    <Table<FieldChange>
      columns={columns}
      dataSource={changes.map((c, i) => ({ ...c, key: i }))}
      size="small"
      pagination={false}
      style={{ marginTop: 4 }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 규칙 Diff 섹션
// ─────────────────────────────────────────────────────────────────────────────

interface RuleDiffSectionProps {
  rules: DiffResponse['rules'];
}

function RuleDiffSection({ rules }: RuleDiffSectionProps) {
  const { added, modified, deleted, unchanged, summary } = rules;
  const hasChanges = summary.addedCount + summary.modifiedCount + summary.deletedCount > 0;

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>규칙 변경사항</Title>
          <SummaryBadges
            added={summary.addedCount}
            modified={summary.modifiedCount}
            deleted={summary.deletedCount}
            unchanged={summary.unchangedCount}
          />
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      {!hasChanges && (
        <Alert
          type="success"
          showIcon
          title="규칙 변경사항 없음"
          description={`${summary.unchangedCount}개 규칙 모두 서버와 동일합니다.`}
        />
      )}

      {/* ── Added ───────────────────────────────────────────────────── */}
      {added.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: 6 }}>
            <PlusCircleOutlined /> 추가됨 ({added.length}개)
          </Text>
          {added.map(({ ruleId, rule }) => (
            <div key={ruleId} style={{ ...ROW_STYLES.added, padding: '8px 12px', borderRadius: 4, marginBottom: 4 }}>
              <Space size={8} wrap>
                <Text code style={{ fontSize: 12 }}>{ruleId}</Text>
                <Text style={{ fontSize: 13 }}>{rule.title}</Text>
                {rule.severity && (
                  <Tag color={RULE_SEVERITY_COLORS[rule.severity]} style={{ fontSize: 11 }}>
                    {rule.severity}
                  </Tag>
                )}
                {rule.category && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {RULE_CATEGORY_LABELS[rule.category] ?? rule.category}
                  </Text>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* ── Modified ────────────────────────────────────────────────── */}
      {modified.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#d48806', display: 'block', marginBottom: 6 }}>
            <EditOutlined /> 수정됨 ({modified.length}개)
          </Text>
          <Collapse
            size="small"
            items={modified.map((item: RuleDiffModified) => ({
              key: item.ruleId,
              label: (
                <Space size={8} wrap style={{ ...ROW_STYLES.modified, padding: '2px 0' }}>
                  <Text code style={{ fontSize: 12 }}>{item.ruleId}</Text>
                  <Tag color="warning" style={{ fontSize: 11 }}>
                    {item.changes.length}개 필드 변경
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    변경 필드: {item.changes.map((c) => c.field).join(', ')}
                  </Text>
                </Space>
              ),
              children: <FieldChangesTable changes={item.changes} />,
            }))}
          />
        </div>
      )}

      {/* ── Deleted ─────────────────────────────────────────────────── */}
      {deleted.length > 0 && (
        <div>
          <Text strong style={{ color: '#cf1322', display: 'block', marginBottom: 6 }}>
            <DeleteOutlined /> 삭제됨 ({deleted.length}개)
          </Text>
          {deleted.map(({ ruleId, rule }) => (
            <div key={ruleId} style={{ ...ROW_STYLES.deleted, padding: '8px 12px', borderRadius: 4, marginBottom: 4 }}>
              <Space size={8} wrap>
                <Text code style={{ fontSize: 12 }}>{ruleId}</Text>
                <Text style={{ fontSize: 13 }}>{rule.title}</Text>
                {rule.severity && (
                  <Tag color={RULE_SEVERITY_COLORS[rule.severity]} style={{ fontSize: 11 }}>
                    {rule.severity}
                  </Tag>
                )}
              </Space>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 태그 Diff 섹션
// ─────────────────────────────────────────────────────────────────────────────

interface TagDiffSectionProps {
  tags: DiffResponse['tags'];
}

function TagDiffSection({ tags }: TagDiffSectionProps) {
  const { added, modified, deleted, unchanged, summary } = tags;
  const hasChanges = summary.addedCount + summary.modifiedCount + summary.deletedCount > 0;

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>태그 변경사항</Title>
          <SummaryBadges
            added={summary.addedCount}
            modified={summary.modifiedCount}
            deleted={summary.deletedCount}
            unchanged={summary.unchangedCount}
          />
        </Space>
      }
      size="small"
      style={{ marginBottom: 16 }}
    >
      {!hasChanges && (
        <Alert
          type="success"
          showIcon
          title="태그 변경사항 없음"
          description={`${summary.unchangedCount}개 태그 모두 서버와 동일합니다.`}
        />
      )}

      {/* ── Added ───────────────────────────────────────────────────── */}
      {added.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#52c41a', display: 'block', marginBottom: 6 }}>
            <PlusCircleOutlined /> 추가됨 ({added.length}개)
          </Text>
          {added.map(({ name, tag }) => (
            <div key={name} style={{ ...ROW_STYLES.added, padding: '8px 12px', borderRadius: 4, marginBottom: 4 }}>
              <Space size={8} wrap>
                <Text code style={{ fontSize: 12 }}>{name}</Text>
                <Tag color="blue" style={{ fontSize: 11 }}>{tag.category}</Tag>
                <Tag color="green" style={{ fontSize: 11 }}>Tier {tag.tier}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{tag.description}</Text>
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* ── Modified ────────────────────────────────────────────────── */}
      {modified.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ color: '#d48806', display: 'block', marginBottom: 6 }}>
            <EditOutlined /> 수정됨 ({modified.length}개)
          </Text>
          <Collapse
            size="small"
            items={(modified as TagDiffModified[]).map((item) => ({
              key: item.name,
              label: (
                <Space>
                  <Text code style={{ fontSize: 12 }}>{item.name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>태그 정의 변경</Text>
                </Space>
              ),
              children: (
                <Row gutter={16}>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>서버 (현재)</Text>
                    <pre style={{ fontSize: 11, background: '#fff2f0', padding: 8, borderRadius: 4, marginTop: 4 }}>
                      {JSON.stringify(item.server, null, 2)}
                    </pre>
                  </Col>
                  <Col span={12}>
                    <Text type="secondary" style={{ fontSize: 11 }}>로컬 (내 변경)</Text>
                    <pre style={{ fontSize: 11, background: '#f6ffed', padding: 8, borderRadius: 4, marginTop: 4 }}>
                      {JSON.stringify(item.local, null, 2)}
                    </pre>
                  </Col>
                </Row>
              ),
            }))}
          />
        </div>
      )}

      {/* ── Deleted ─────────────────────────────────────────────────── */}
      {deleted.length > 0 && (
        <div>
          <Text strong style={{ color: '#cf1322', display: 'block', marginBottom: 6 }}>
            <DeleteOutlined /> 삭제됨 ({deleted.length}개)
          </Text>
          {deleted.map(({ name, tag }) => (
            <div key={name} style={{ ...ROW_STYLES.deleted, padding: '8px 12px', borderRadius: 4, marginBottom: 4 }}>
              <Space size={8} wrap>
                <Text code style={{ fontSize: 12 }}>{name}</Text>
                <Tag color="blue" style={{ fontSize: 11 }}>{tag.category}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>{tag.description}</Text>
              </Space>
            </div>
          ))}
        </div>
      )}

      {/* 변경 없는 태그 목록 (접힌 상태) */}
      {unchanged.length > 0 && (
        <Collapse
          size="small"
          style={{ marginTop: 8 }}
          items={[{
            key: 'unchanged',
            label: <Text type="secondary" style={{ fontSize: 12 }}>변경 없는 태그 ({unchanged.length}개)</Text>,
            children: (
              <Space wrap size={4}>
                {unchanged.map((name) => (
                  <Tag key={name} style={{ fontSize: 11 }}>{name}</Tag>
                ))}
              </Space>
            ),
          }]}
        />
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 메인 DiffViewer 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

interface DiffViewerProps {
  diff: DiffResponse;
}

export default function DiffViewer({ diff }: DiffViewerProps) {
  const totalChanges =
    diff.rules.summary.addedCount    + diff.rules.summary.modifiedCount    + diff.rules.summary.deletedCount +
    diff.tags.summary.addedCount     + diff.tags.summary.modifiedCount     + diff.tags.summary.deletedCount;

  return (
    <div>
      {/* ── 버전 정보 ─────────────────────────────────────────────────────── */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12}>
          <Card size="small">
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>내 기준 버전 (baseVersion)</Text>
              <Text strong style={{ fontFamily: 'monospace' }}>{diff.baseVersion}</Text>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card size="small">
            <Space direction="vertical" size={2}>
              <Text type="secondary" style={{ fontSize: 12 }}>서버 현재 버전 (currentVersion)</Text>
              <Text strong style={{ fontFamily: 'monospace', color: diff.hasConflict ? '#cf1322' : undefined }}>
                {diff.currentVersion}
              </Text>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* ── 충돌 경고 배너 ────────────────────────────────────────────────── */}
      {diff.hasConflict && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          title="버전 충돌 감지"
          description={
            <span>
              내 기준 버전({diff.baseVersion})이 서버 현재 버전({diff.currentVersion})보다 낮습니다.
              <br />
              Push 시 <Text strong>Force 옵션</Text>을 사용하면 강제 덮어쓰기가 가능하지만,
              서버의 변경사항이 유실될 수 있습니다.
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── 전체 요약 ─────────────────────────────────────────────────────── */}
      {totalChanges === 0 ? (
        <Alert
          type="success"
          showIcon
          title="서버와 동일합니다"
          description="로컬 데이터가 서버와 완전히 일치합니다. Push가 필요하지 않습니다."
          style={{ marginBottom: 16 }}
        />
      ) : (
        <Alert
          type="info"
          showIcon
          title={`총 ${totalChanges}개 항목에 변경사항이 있습니다.`}
          description={
            <Space size={16} wrap>
              <span>
                규칙: <Badge count={diff.rules.summary.addedCount} color="green" /> 추가&nbsp;
                <Badge count={diff.rules.summary.modifiedCount} color="gold" /> 수정&nbsp;
                <Badge count={diff.rules.summary.deletedCount} color="red" /> 삭제
              </span>
              <span>
                태그: <Badge count={diff.tags.summary.addedCount} color="green" /> 추가&nbsp;
                <Badge count={diff.tags.summary.modifiedCount} color="gold" /> 수정&nbsp;
                <Badge count={diff.tags.summary.deletedCount} color="red" /> 삭제
              </span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* ── 규칙 / 태그 Diff 섹션 ────────────────────────────────────────── */}
      <RuleDiffSection rules={diff.rules} />
      <TagDiffSection  tags={diff.tags}  />
    </div>
  );
}