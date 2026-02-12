import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Image, Input, InputNumber, message, Modal, Popconfirm, Select, Space, Switch, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useState } from 'react'

import { learningCenterApi } from '../../services/learningCenterApi'
import { useAuthStore } from '../../store/auth'

interface Banner {
  id: string
  title: string
  imageUrl: string
  linkUrl?: string
  linkType?: string
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

export default function BannerManager() {
  const [loading, setLoading] = useState(false)
  const [banners, setBanners] = useState<Banner[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
  const [form] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canWrite = hasPermission('learningCenter', 'write')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await learningCenterApi.listBanners()
      setBanners(response.data.data)
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载 Banner 列表失败'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = () => {
    setEditingBanner(null)
    form.resetFields()
    form.setFieldsValue({ order: 0, isEnabled: true, linkType: 'external' })
    setModalOpen(true)
  }

  const handleEdit = (record: Banner) => {
    setEditingBanner(record)
    form.setFieldsValue({
      title: record.title,
      imageUrl: record.imageUrl,
      linkUrl: record.linkUrl,
      linkType: record.linkType || 'external',
      order: record.order,
      isEnabled: record.isEnabled
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await learningCenterApi.deleteBanner(id)
      message.success('删除成功')
      loadData()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'))
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingBanner) {
        await learningCenterApi.updateBanner(editingBanner.id, values)
        message.success('更新成功')
      } else {
        await learningCenterApi.createBanner(values)
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

  const handleToggleEnabled = async (record: Banner) => {
    try {
      await learningCenterApi.updateBanner(record.id, { isEnabled: !record.isEnabled })
      message.success(record.isEnabled ? '已禁用' : '已启用')
      loadData()
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '操作失败'))
    }
  }

  const columns: ColumnsType<Banner> = [
    {
      title: '图片',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 120,
      render: (url) => <Image src={url} width={80} height={45} style={{ objectFit: 'cover', borderRadius: 4 }} />
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title'
    },
    {
      title: '链接',
      dataIndex: 'linkUrl',
      key: 'linkUrl',
      ellipsis: true,
      render: (url) => url || '-'
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
            <Popconfirm title="确定要删除这个 Banner 吗？" onConfirm={() => handleDelete(record.id)}>
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
            添加 Banner
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={banners} loading={loading} pagination={false} />

      <Modal
        title={editingBanner ? '编辑 Banner' : '添加 Banner'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={200} />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片链接" rules={[{ required: true, message: '请输入图片链接' }]}>
            <Input placeholder="https://example.com/banner.jpg" />
          </Form.Item>
          <Form.Item name="linkUrl" label="跳转链接">
            <Input placeholder="https://example.com" />
          </Form.Item>
          <Form.Item name="linkType" label="链接类型">
            <Select
              options={[
                { value: 'external', label: '外部链接' },
                { value: 'course', label: '课程' },
                { value: 'document', label: '文档' }
              ]}
            />
          </Form.Item>
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
