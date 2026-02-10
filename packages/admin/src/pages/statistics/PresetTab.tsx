import { FireOutlined } from '@ant-design/icons'
import { Card, Col, List, Row, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

import { ECHARTS_THEME_NAME } from '../../theme'
import type { PresetUsage } from './types'

interface PresetTabProps {
  loading: boolean
  presetData: PresetUsage[]
}

export default function PresetTab({ loading, presetData }: PresetTabProps) {
  const pieOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle'
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          data: presetData.slice(0, 10).map((p) => ({
            name: p.emoji ? `${p.emoji} ${p.presetName}` : p.presetName,
            value: p.requests
          })),
          label: { show: false },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold'
            }
          }
        }
      ]
    }),
    [presetData]
  )

  const columns: ColumnsType<PresetUsage> = [
    {
      title: '预设',
      dataIndex: 'presetName',
      key: 'presetName',
      render: (name: string, record: PresetUsage) => (
        <span>
          {record.emoji ? `${record.emoji} ` : ''}
          {name}
        </span>
      )
    },
    { title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },
    { title: 'Token 数', dataIndex: 'tokens', key: 'tokens', sorter: (a, b) => a.tokens - b.tokens },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => `¥${cost.toFixed(2)}`
    },
    { title: '独立用户', dataIndex: 'uniqueUsers', key: 'uniqueUsers', sorter: (a, b) => a.uniqueUsers - b.uniqueUsers }
  ]

  const top20 = presetData.slice(0, 20)

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                <FireOutlined style={{ color: 'var(--cs-error)', marginRight: 8 }} />
                热度排行 Top 20
              </span>
            }
            loading={loading}>
            {top20.length > 0 ? (
              <List
                size="small"
                dataSource={top20}
                style={{ maxHeight: 380, overflow: 'auto' }}
                renderItem={(item, index) => (
                  <List.Item style={{ padding: '8px 0', borderBottomColor: 'var(--cs-border)' }}>
                    <span>
                      <Tag
                        color={index < 3 ? 'magenta' : index < 10 ? 'orange' : 'default'}
                        style={{ minWidth: 28, textAlign: 'center' }}>
                        {index + 1}
                      </Tag>
                      {item.emoji ? `${item.emoji} ` : ''}
                      {item.presetName}
                    </span>
                    <span style={{ color: 'var(--cs-text-3)', fontSize: 12 }}>
                      {item.requests} 次 · {item.uniqueUsers} 用户 · {item.tokens} tokens
                    </span>
                  </List.Item>
                )}
              />
            ) : (
              <div
                style={{
                  height: 380,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cs-text-3)'
                }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="预设使用占比" loading={loading}>
            {presetData.length > 0 ? (
              <ReactECharts theme={ECHARTS_THEME_NAME} option={pieOption} style={{ height: 380 }} />
            ) : (
              <div
                style={{
                  height: 380,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cs-text-3)'
                }}>
                暂无数据
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Card title="助手预设使用详情" loading={loading} style={{ marginTop: 16 }}>
        <Table rowKey="presetId" columns={columns} dataSource={presetData} pagination={{ pageSize: 20 }} size="small" />
      </Card>
    </div>
  )
}
