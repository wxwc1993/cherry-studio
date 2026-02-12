import { Card, Col, Descriptions, Empty, Row, Spin, Tag, Timeline } from 'antd'

import {
  CREATION_TYPE_MAP,
  PRESENTATION_STATUS_MAP,
  type PresentationDetailData,
  type PresentationPageItem
} from './types'

interface PresentationDetailProps {
  data: PresentationDetailData | null
  loading: boolean
}

function PageTimeline({ pages }: { pages: PresentationPageItem[] }) {
  if (pages.length === 0) {
    return <Empty description="暂无页面数据" />
  }

  const timelineItems = pages
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((page) => ({
      key: page.id,
      children: (
        <div>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>
            第 {page.orderIndex + 1} 页：{page.outlineContent.title}
          </div>
          {page.outlineContent.bulletPoints && page.outlineContent.bulletPoints.length > 0 && (
            <ul style={{ margin: '4px 0', paddingLeft: 20, color: 'var(--cs-text-2)' }}>
              {page.outlineContent.bulletPoints.map((point, idx) => (
                <li key={idx}>{point}</li>
              ))}
            </ul>
          )}
          {page.descriptionContent?.text && (
            <div style={{ color: 'var(--cs-text-3)', fontSize: 12, marginTop: 4 }}>
              描述：{page.descriptionContent.text.slice(0, 100)}
              {page.descriptionContent.text.length > 100 ? '...' : ''}
            </div>
          )}
          {page.generatedImageKey && (
            <Tag color="green" style={{ marginTop: 4 }}>
              已生成图像
            </Tag>
          )}
        </div>
      )
    }))

  return <Timeline items={timelineItems} />
}

export default function PresentationDetail({ data, loading }: PresentationDetailProps) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!data) {
    return <Empty description="无数据" />
  }

  const statusConfig = PRESENTATION_STATUS_MAP[data.status]

  return (
    <div>
      <Descriptions bordered size="small" column={2} styles={{ label: { width: 120 } }}>
        <Descriptions.Item label="标题" span={2}>
          {data.title}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          {statusConfig ? <Tag color={statusConfig.color}>{statusConfig.label}</Tag> : <Tag>{data.status}</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="创建方式">
          {CREATION_TYPE_MAP[data.creationType] ?? data.creationType}
        </Descriptions.Item>
        <Descriptions.Item label="页数">{data.pageCount}</Descriptions.Item>
        <Descriptions.Item label="创建者">
          {data.userName ?? '未知'}
          {data.departmentName ? ` (${data.departmentName})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="创建时间">{data.createdAt}</Descriptions.Item>
        <Descriptions.Item label="更新时间">{data.updatedAt}</Descriptions.Item>
      </Descriptions>

      {data.sourceContent && (
        <Card title="原始输入" size="small" style={{ marginTop: 16 }}>
          <div style={{ whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto', color: 'var(--cs-text-2)' }}>
            {data.sourceContent}
          </div>
        </Card>
      )}

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title={`页面内容（共 ${data.pages.length} 页）`} size="small">
            <PageTimeline pages={data.pages} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
