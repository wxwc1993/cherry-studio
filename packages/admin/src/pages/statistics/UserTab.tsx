import { Card, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

import type { UserUsage } from './types'

interface UserTabProps {
  loading: boolean
  userData: UserUsage[]
}

export default function UserTab({ loading, userData }: UserTabProps) {
  const columns: ColumnsType<UserUsage> = [
    { title: '用户', dataIndex: 'userName', key: 'userName' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '请求数', dataIndex: 'requests', key: 'requests', sorter: (a, b) => a.requests - b.requests },
    { title: 'Token 数', dataIndex: 'tokens', key: 'tokens', sorter: (a, b) => a.tokens - b.tokens },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      sorter: (a, b) => a.cost - b.cost,
      render: (cost: number) => `¥${cost.toFixed(2)}`
    }
  ]

  return (
    <Card title="用户使用统计" loading={loading}>
      <Table rowKey="userId" columns={columns} dataSource={userData} pagination={{ pageSize: 20 }} size="small" />
    </Card>
  )
}
