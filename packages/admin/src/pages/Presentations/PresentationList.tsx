import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { Button, DatePicker, Input, message, Modal, Pagination, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

import { presentationsApi } from '../../services/presentationsApi'
import { useAuthStore } from '../../store/auth'
import PresentationDetail from './PresentationDetail'
import {
  CREATION_TYPE_MAP,
  PRESENTATION_STATUS_MAP,
  type PresentationDetailData,
  type PresentationListFilters,
  type PresentationListItem
} from './types'

const { RangePicker } = DatePicker

const STATUS_OPTIONS = Object.entries(PRESENTATION_STATUS_MAP).map(([value, { label }]) => ({
  value,
  label
}))

const DEFAULT_FILTERS: PresentationListFilters = {
  page: 1,
  pageSize: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc'
}

export default function PresentationList() {
  const { hasPermission } = useAuthStore()
  const canRead = hasPermission('presentations', 'read')

  const [items, setItems] = useState<PresentationListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<PresentationListFilters>(DEFAULT_FILTERS)
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null)

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailData, setDetailData] = useState<PresentationDetailData | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadData = useCallback(async () => {
    if (!canRead) return

    try {
      setLoading(true)
      const params = {
        ...filters,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD')
      }
      const response = await presentationsApi.list(params)
      setItems(response.data.data ?? [])
      setTotal(response.data.pagination?.total ?? 0)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message ?? '加载演示文稿列表失败')
    } finally {
      setLoading(false)
    }
  }, [canRead, filters, dateRange])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleViewDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true)
      setDetailOpen(true)
      const response = await presentationsApi.get(id)
      setDetailData(response.data.data)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message ?? '加载详情失败')
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleSearch = useCallback((value: string) => {
    setFilters((prev) => ({ ...prev, search: value || undefined, page: 1 }))
  }, [])

  const handleStatusChange = useCallback((value: string | undefined) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }))
  }, [])

  const handleDateRangeChange = useCallback((dates: [Dayjs, Dayjs] | null) => {
    setDateRange(dates)
    setFilters((prev) => ({ ...prev, page: 1 }))
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  const columns: ColumnsType<PresentationListItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 250
    },
    {
      title: '创建方式',
      dataIndex: 'creationType',
      key: 'creationType',
      width: 100,
      render: (type: string) => CREATION_TYPE_MAP[type] ?? type
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: string) => {
        const config = PRESENTATION_STATUS_MAP[status]
        return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>{status}</Tag>
      }
    },
    {
      title: '页数',
      dataIndex: 'pageCount',
      key: 'pageCount',
      width: 70,
      align: 'center'
    },
    {
      title: '创建者',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (name: string, record) => (
        <span>
          {name ?? '未知'}
          {record.departmentName ? (
            <span style={{ color: 'var(--cs-text-3)', marginLeft: 4 }}>({record.departmentName})</span>
          ) : null}
        </span>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 170,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
          查看
        </Button>
      )
    }
  ]

  if (!canRead) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--cs-text-3)' }}>暂无权限查看此页面</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Input.Search
            placeholder="搜索标题"
            allowClear
            onSearch={handleSearch}
            style={{ width: 200 }}
            prefix={<SearchOutlined />}
          />
          <Select
            style={{ width: 130 }}
            placeholder="筛选状态"
            allowClear
            options={STATUS_OPTIONS}
            onChange={handleStatusChange}
          />
          <RangePicker onChange={(dates) => handleDateRangeChange(dates as [Dayjs, Dayjs] | null)} />
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        pagination={false}
        scroll={{ y: 'calc(100vh - 420px)' }}
      />

      {total > filters.pageSize && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={filters.page}
            pageSize={filters.pageSize}
            total={total}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
            onChange={handlePageChange}
          />
        </div>
      )}

      <Modal
        title="演示文稿详情"
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={800}
        destroyOnClose>
        <PresentationDetail data={detailData} loading={detailLoading} />
      </Modal>
    </div>
  )
}
