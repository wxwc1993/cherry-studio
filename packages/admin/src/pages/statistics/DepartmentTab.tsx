import { Card, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import ReactECharts from 'echarts-for-react'
import { useMemo } from 'react'

import { ECHARTS_THEME_NAME } from '../../theme'
import type { DepartmentUsage } from './types'

interface DepartmentTabProps {
  loading: boolean
  departmentData: DepartmentUsage[]
}

interface DepartmentTreeNode extends DepartmentUsage {
  key: string
  children?: DepartmentTreeNode[]
}

function buildDepartmentTree(data: DepartmentUsage[]): DepartmentTreeNode[] {
  const nodeMap = new Map<string, DepartmentTreeNode>()
  const roots: DepartmentTreeNode[] = []

  for (const dept of data) {
    nodeMap.set(dept.departmentId, { ...dept, key: dept.departmentId })
  }

  for (const dept of data) {
    const node = nodeMap.get(dept.departmentId)!
    if (dept.parentId && nodeMap.has(dept.parentId)) {
      const parent = nodeMap.get(dept.parentId)!
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export default function DepartmentTab({ loading, departmentData }: DepartmentTabProps) {
  const treeData = useMemo(() => buildDepartmentTree(departmentData), [departmentData])

  const barOption = useMemo(() => {
    const top10 = [...departmentData].sort((a, b) => b.messages - a.messages).slice(0, 10)
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['消息数', '对话数', 'Token 数'] },
      xAxis: {
        type: 'category',
        data: top10.map((d) => d.departmentName),
        axisLabel: { rotate: 30 }
      },
      yAxis: [
        { type: 'value', name: '消息 / 对话' },
        { type: 'value', name: 'Token 数' }
      ],
      series: [
        {
          name: '消息数',
          type: 'bar',
          data: top10.map((d) => d.messages),
          barMaxWidth: 32
        },
        {
          name: '对话数',
          type: 'bar',
          data: top10.map((d) => d.conversations),
          barMaxWidth: 32
        },
        {
          name: 'Token 数',
          type: 'line',
          yAxisIndex: 1,
          data: top10.map((d) => d.tokens)
        }
      ],
      grid: { bottom: 60 }
    }
  }, [departmentData])

  const columns: ColumnsType<DepartmentTreeNode> = [
    { title: '部门', dataIndex: 'departmentName', key: 'departmentName' },
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
    { title: '活跃用户', dataIndex: 'userCount', key: 'userCount', sorter: (a, b) => a.userCount - b.userCount }
  ]

  return (
    <div>
      <Card title="部门间对比 (Top 10)" loading={loading}>
        {departmentData.length > 0 ? (
          <ReactECharts theme={ECHARTS_THEME_NAME} option={barOption} style={{ height: 350 }} />
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

      <Card title="部门层级统计" loading={loading} style={{ marginTop: 16 }}>
        <Table
          rowKey="key"
          columns={columns}
          dataSource={treeData}
          pagination={false}
          size="small"
          expandable={{ defaultExpandAllRows: true }}
        />
      </Card>
    </div>
  )
}
