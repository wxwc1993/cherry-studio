import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, message, Modal, Popconfirm, Select, Space, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { type FC, useCallback, useEffect, useState } from 'react'

import { assistantPresetsApi } from '../../services/api'

interface PresetTag {
  id: string
  name: string
  locale: string
  order: number
  presetCount?: number
}

interface TagManagerProps {
  open: boolean
  onClose: () => void
  canWrite: boolean
  canAdmin: boolean
  onTagsChanged: () => void
}

const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' }
]

const TagManager: FC<TagManagerProps> = ({ open, onClose, canWrite, canAdmin, onTagsChanged }) => {
  const [tags, setTags] = useState<PresetTag[]>([])
  const [loading, setLoading] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<PresetTag | null>(null)
  const [filterLocale, setFilterLocale] = useState<string | undefined>(undefined)
  const [form] = Form.useForm()

  const loadTags = useCallback(async () => {
    try {
      setLoading(true)
      const params = filterLocale ? { locale: filterLocale } : {}
      const response = await assistantPresetsApi.listTags(params)
      setTags(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载标签失败')
    } finally {
      setLoading(false)
    }
  }, [filterLocale])

  useEffect(() => {
    if (open) {
      loadTags()
    }
  }, [open, loadTags])

  const handleAdd = () => {
    setEditingTag(null)
    form.resetFields()
    form.setFieldsValue({ locale: filterLocale || 'zh-CN', order: 0 })
    setEditModalOpen(true)
  }

  const handleEdit = (tag: PresetTag) => {
    setEditingTag(tag)
    form.setFieldsValue({
      name: tag.name,
      locale: tag.locale,
      order: tag.order
    })
    setEditModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await assistantPresetsApi.deleteTag(id)
      message.success('删除成功')
      loadTags()
      onTagsChanged()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingTag) {
        await assistantPresetsApi.updateTag(editingTag.id, values)
        message.success('更新成功')
      } else {
        await assistantPresetsApi.createTag(values)
        message.success('创建成功')
      }
      setEditModalOpen(false)
      loadTags()
      onTagsChanged()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const columns: ColumnsType<PresetTag> = [
    {
      title: '标签名',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: '语言',
      dataIndex: 'locale',
      key: 'locale',
      width: 100,
      render: (locale: string) => {
        const option = localeOptions.find((o) => o.value === locale)
        return option?.label || locale
      }
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      width: 80,
      sorter: (a, b) => a.order - b.order
    },
    {
      title: '预设数',
      dataIndex: 'presetCount',
      key: 'presetCount',
      width: 80,
      render: (count?: number) => count ?? 0
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
          {canAdmin && (
            <Popconfirm title="删除标签将移除与预设的关联，确定删除吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  return (
    <>
      <Modal title="标签管理" open={open} onCancel={onClose} footer={null} width={700} destroyOnClose>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Select
            allowClear
            placeholder="筛选语言"
            style={{ width: 150 }}
            options={localeOptions}
            value={filterLocale}
            onChange={setFilterLocale}
          />
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增标签
            </Button>
          )}
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={tags}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ y: 400 }}
        />
      </Modal>

      <Modal
        title={editingTag ? '编辑标签' : '新增标签'}
        open={editModalOpen}
        onOk={handleSubmit}
        onCancel={() => setEditModalOpen(false)}
        width={400}
        destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="标签名称" rules={[{ required: true, message: '请输入标签名称' }]}>
            <Input placeholder="例如：职业、写作" maxLength={50} />
          </Form.Item>
          <Form.Item name="locale" label="语言" rules={[{ required: true, message: '请选择语言' }]}>
            <Select options={localeOptions} placeholder="请选择语言" />
          </Form.Item>
          <Form.Item name="order" label="排序权重" initialValue={0}>
            <Input type="number" min={0} placeholder="数字越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default TagManager
