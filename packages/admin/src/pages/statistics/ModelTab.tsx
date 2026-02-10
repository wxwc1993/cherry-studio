import { Card, Col, Row, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

import { ECHARTS_THEME_NAME } from '../../theme'
import type { ModelUsage } from './types'

interface ModelTabProps {
  loading: boolean
  modelData: ModelUsage[]
}

export default function ModelTab({ loading, modelData }: ModelTabProps) {
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
          data: modelData.map((m) => ({
            name: m.modelName,
            value: m.messages
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
    [modelData]
  )

  const tokenPieOption = useMemo(
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
          data: modelData.map((m) => ({
            name: m.modelName,
            value: m.tokens
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
    [modelData]
  )

  const columns: ColumnsType<ModelUsage> = [
    { title: '模型', dataIndex: 'modelName', key: 'modelName' },
    { title: '消息数', dataIndex: 'messages', key: 'messages', sorter: (a, b) => a.messages - b.messages },
    {
      title: '对话数',
      dataIndex: 'conversations',
      key: 'conversations',
      sorter: (a, b) => a.conversations - b.conversations
    },
    { title: 'Token 数', dataIndex: 'tokens', key: 'tokens', sorter: (a, b) => a.tokens - b.tokens },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => `¥${cost.toFixed(2)}`
    },
    {
      title: '平均延迟',
      dataIndex: 'avgLatency',
      key: 'avgLatency',
      sorter: (a, b) => (a.avgLatency || 0) - (b.avgLatency || 0),
      render: (val: number | undefined) => (val ? `${val}ms` : '-')
    }
  ]

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="模型消息分布" loading={loading}>
            {modelData.length > 0 ? (
              <ReactECharts theme={ECHARTS_THEME_NAME} option={pieOption} style={{ height: 350 }} />
            ) : (
              <div
                style={{
                  height: 350,
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
          <Card title="模型 Token 分布" loading={loading}>
            {modelData.length > 0 ? (
              <ReactECharts theme={ECHARTS_THEME_NAME} option={tokenPieOption} style={{ height: 350 }} />
            ) : (
              <div
                style={{
                  height: 350,
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

      <Card title="模型使用详情" loading={loading} style={{ marginTop: 16 }}>
        <Table rowKey="modelId" columns={columns} dataSource={modelData} pagination={false} size="small" />
      </Card>
    </div>
  )
}
