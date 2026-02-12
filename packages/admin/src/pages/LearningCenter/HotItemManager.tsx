import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'

import { learningCenterApi } from '../../services/learningCenterApi'
import { useAuthStore } from '../../store/auth'

interface HotItem {
  id: string
  title: string
  linkUrl: string
  tag?: string
  heatValue: number
  order: number
  isEnabled: boolean
  createdAt: string
}

// 从 Axios 错误响应中提取错误消息
function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
    return axiosError.response?.data?.error?.message || fallback
  }
  return fallback
}

const tagOptions = [
  { value: '热', label: '热' },
  { value: '新', label: '新' }
]

export default function HotItemManager() {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<HotItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<HotItem | null>(null)
  const [form] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canWrite = hasPermission('learningCenter', 'write')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await learningCenterApi.listHotItems()
      setItems(response.data.data)
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载热搜列表失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ order: 0, isEnabled: true, heatValue: 0 })
    setModalOpen(true)
  }

  const handleEdit = (record: HotItem) => {
    setEditingItem(record)
    form.setFieldsValue({
      title: record.title,
      linkUrl: record.linkUrl,
      tag: record.tag,
      heatValue: record.heatValue,
      order: record.order,
      isEnabled: record.isEnabled
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await learningCenterApi.deleteHotItem(id)
      message.success('删除成功')
      loadData()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'))
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingItem) {
        await learningCenterApi.updateHotItem(editingItem.id, values)
        message.success('更新成功')
      } else {
        await learningCenterApi.createHotItem(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        message.error(getErrorMessage(error, '操作失败'))
      }
    }
  }

  const handleToggleEnabled = async (record: HotItem) => {
    try {
      await learningCenterApi.updateHotItem(record.id, { isEnabled: !record.isEnabled })
      message.success(record.isEnabled ? '已禁用' : '已启用')
      loadData()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '操作失败'))
    }
  }

  const formatHeatValue = (value: number) => {
    if (value >= 10000) {
      return `${(value / 10000).toFixed(1)}万`
    }
    return String(value)
  }

  const columns: ColumnsType<HotItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '链接',
      dataIndex: 'linkUrl',
      key: 'linkUrl',
      ellipsis: true,
      render: (url) => (
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
      )
    },
    {
      title: '标签',
      dataIndex: 'tag',
      key: 'tag',
      width: 80,
      render: (tag) => {
        if (!tag) return '-'
        const color = tag === '热' ? 'red' : 'blue'
        return <span style={{ color, fontWeight: 500 }}>{tag}</span>
      }
    },
    {
      title: '热度',
      dataIndex: 'heatValue',
      key: 'heatValue',
      width: 100,
      render: (v) => formatHeatValue(v),
      sorter: (a, b) => a.heatValue - b.heatValue
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a, b) => a.order - b.order
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 80,
      render: (isEnabled, record) => (
        <Switch checked={isEnabled} onChange={() => handleToggleEnabled(record)} disabled={!canWrite} size="small" />
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {canWrite && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canWrite && (
            <Popconfirm title="确定要删除这条热搜吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {canWrite && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加热搜
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} />

      <Modal
        title={editingItem ? '编辑热搜' : '添加热搜'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={300} />
          </Form.Item>
          <Form.Item name="linkUrl" label="链接" rules={[{ required: true, message: '请输入链接' }]}>
            <Input placeholder="https://example.com/article" />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="tag" label="标签">
              <Select options={tagOptions} allowClear placeholder="无标签" />
            </Form.Item>
            <Form.Item name="heatValue" label="热度值">
              <InputNumber min={0} style={{ width: '100%' }} addonAfter="万" />
            </Form.Item>
          </Space>
          <Form.Item name="order" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isEnabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
