import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Badge, Button, Form, Input, message, Modal, Pagination, Popconfirm, Space, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'

import { presentationsApi } from '../../services/presentationsApi'
import { useAuthStore } from '../../store/auth'
import type { TemplateItem } from './types'

export default function TemplateManagement() {
  const { hasPermission } = useAuthStore()
  const canWrite = hasPermission('presentations', 'write')
  const canAdmin = hasPermission('presentations', 'admin')

  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null)
  const [form] = Form.useForm()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, unknown> = { page, pageSize }
      if (search.trim()) {
        params.search = search.trim()
      }
      const response = await presentationsApi.listTemplates(params)
      setTemplates(response.data.data ?? [])
      setTotal(response.data.pagination?.total ?? 0)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message ?? '加载模板列表失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = () => {
    setEditingTemplate(null)
    form.resetFields()
    form.setFieldsValue({ isPublic: false })
    setModalOpen(true)
  }

  const handleEdit = (record: TemplateItem) => {
    setEditingTemplate(record)
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      isPublic: record.isPublic
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await presentationsApi.deleteTemplate(id)
      message.success('删除成功')
      loadData()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      message.error(err.response?.data?.error?.message ?? '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingTemplate) {
        await presentationsApi.updateTemplate(editingTemplate.id, values)
        message.success('更新成功')
      } else {
        await presentationsApi.createTemplate(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } }
      if (err.response) {
        message.error(err.response?.data?.error?.message ?? '操作失败')
      }
    }
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const columns: ColumnsType<TemplateItem> = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc: string | undefined) => desc ?? '-'
    },
    {
      title: '公开',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 80,
      render: (isPublic: boolean) =>
        isPublic ? <Badge status="success" text="是" /> : <Badge status="default" text="否" />
    },
    {
      title: '上传者',
      dataIndex: 'uploaderName',
      key: 'uploaderName',
      width: 120,
      render: (name: string | undefined) => name ?? '未知'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {(canWrite || canAdmin) && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canAdmin && (
            <Popconfirm title="确定要删除这个模板吗？" onConfirm={() => handleDelete(record.id)}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Input.Search placeholder="搜索模板" allowClear onSearch={handleSearch} style={{ width: 200 }} />
        {(canWrite || canAdmin) && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加模板
          </Button>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={templates}
        loading={loading}
        pagination={false}
        scroll={{ y: 'calc(100vh - 420px)' }}
      />

      {total > pageSize && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            showQuickJumper
            showTotal={(t) => `共 ${t} 条`}
            onChange={(p) => setPage(p)}
          />
        </div>
      )}

      <Modal
        title={editingTemplate ? '编辑模板' : '添加模板'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={500}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item name="isPublic" label="公开（全公司可用）" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
