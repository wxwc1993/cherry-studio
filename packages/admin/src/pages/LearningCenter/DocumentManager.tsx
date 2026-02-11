import { DeleteOutlined, EditOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import {
  Badge,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { learningCenterApi } from '../../services/learningCenterApi'
import { useAuthStore } from '../../store/auth'

interface DocumentCategory {
  id: string
  name: string
  order: number
  isEnabled: boolean
}

interface DocumentItem {
  id: string
  title: string
  description?: string
  coverUrl?: string
  linkUrl: string
  linkType: string
  author?: string
  categoryId?: string
  order: number
  isEnabled: boolean
  isRecommended: boolean
  viewCount: number
  createdAt: string
}

const containerStyle: CSSProperties = {
  display: 'flex',
  height: 'calc(100vh - 64px - 48px - 120px)',
  margin: -24,
  overflow: 'hidden'
}

const sidebarStyle: CSSProperties = {
  minWidth: 200,
  maxWidth: 240,
  borderRight: '1px solid var(--cs-border)',
  background: 'var(--cs-bg-1)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden'
}

const sidebarHeaderStyle: CSSProperties = {
  padding: '16px 12px 8px',
  fontWeight: 600,
  fontSize: 14,
  color: 'var(--cs-text-1)'
}

const sidebarListStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '0 8px'
}

const sidebarItemStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  margin: '2px 0',
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: active ? 'rgba(99,102,241,0.15)' : 'transparent',
  color: active ? 'var(--cs-primary-hover)' : 'var(--cs-text-1)',
  fontWeight: active ? 500 : 400,
  transition: 'background-color 0.2s ease',
  fontSize: 14
})

const sidebarFooterStyle: CSSProperties = {
  padding: '8px 12px',
  borderTop: '1px solid var(--cs-border)',
  display: 'flex',
  gap: 8
}

const mainContentStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  padding: 16
}

export default function DocumentManager() {
  const { hasPermission } = useAuthStore()
  const canWrite = hasPermission('learningCenter', 'write')

  const [categories, setCategories] = useState<DocumentCategory[]>([])
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeCategoryId, setActiveCategoryId] = useState<string | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)

  const [docModalOpen, setDocModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null)
  const [docForm] = Form.useForm()

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<DocumentCategory | null>(null)
  const [categoryForm] = Form.useForm()
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)

  const loadCategories = useCallback(async () => {
    try {
      const response = await learningCenterApi.listDocumentCategories()
      setCategories(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载分类失败')
    }
  }, [])

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = { page, pageSize }
      if (activeCategoryId) {
        params.categoryId = activeCategoryId
      }
      if (search.trim()) {
        params.search = search.trim()
      }
      const response = await learningCenterApi.listDocuments(params)
      setDocuments(response.data.data)
      setTotal(response.data.pagination?.total || 0)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载文档失败')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, activeCategoryId, search])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  const handleCategoryClick = (categoryId?: string) => {
    setActiveCategoryId(categoryId)
    setPage(1)
  }

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  // Document CRUD
  const handleAddDoc = () => {
    setEditingDoc(null)
    docForm.resetFields()
    docForm.setFieldsValue({ order: 0, isEnabled: true, isRecommended: false, linkType: 'external' })
    setDocModalOpen(true)
  }

  const handleEditDoc = (record: DocumentItem) => {
    setEditingDoc(record)
    docForm.setFieldsValue({
      title: record.title,
      description: record.description,
      coverUrl: record.coverUrl,
      linkUrl: record.linkUrl,
      linkType: record.linkType,
      author: record.author,
      categoryId: record.categoryId,
      order: record.order,
      isEnabled: record.isEnabled,
      isRecommended: record.isRecommended
    })
    setDocModalOpen(true)
  }

  const handleDeleteDoc = async (id: string) => {
    try {
      await learningCenterApi.deleteDocument(id)
      message.success('删除成功')
      loadDocuments()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleDocSubmit = async () => {
    try {
      const values = await docForm.validateFields()
      if (editingDoc) {
        await learningCenterApi.updateDocument(editingDoc.id, values)
        message.success('更新成功')
      } else {
        await learningCenterApi.createDocument(values)
        message.success('创建成功')
      }
      setDocModalOpen(false)
      loadDocuments()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  // Category CRUD
  const handleAddCategory = () => {
    setEditingCategory(null)
    categoryForm.resetFields()
    categoryForm.setFieldsValue({ order: 0, isEnabled: true })
    setCategoryModalOpen(true)
  }

  const handleEditCategory = (record: DocumentCategory) => {
    setEditingCategory(record)
    categoryForm.setFieldsValue({ name: record.name, order: record.order, isEnabled: record.isEnabled })
    setCategoryModalOpen(true)
  }

  const handleDeleteCategory = async (id: string) => {
    try {
      await learningCenterApi.deleteDocumentCategory(id)
      message.success('删除成功')
      loadCategories()
      if (activeCategoryId === id) {
        setActiveCategoryId(undefined)
      }
      loadDocuments()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields()
      if (editingCategory) {
        await learningCenterApi.updateDocumentCategory(editingCategory.id, values)
        message.success('更新成功')
      } else {
        await learningCenterApi.createDocumentCategory(values)
        message.success('创建成功')
      }
      setCategoryModalOpen(false)
      loadCategories()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const activeCategoryName = useMemo(() => {
    if (!activeCategoryId) return '全部文档'
    const cat = categories.find((c) => c.id === activeCategoryId)
    return cat?.name || '全部文档'
  }, [activeCategoryId, categories])

  const categoryOptions = useMemo(() => categories.map((c) => ({ value: c.id, label: c.name })), [categories])

  const columns: ColumnsType<DocumentItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '分类',
      dataIndex: 'categoryId',
      key: 'categoryId',
      width: 120,
      render: (categoryId) => {
        const cat = categories.find((c) => c.id === categoryId)
        return cat?.name || '未分类'
      }
    },
    {
      title: '链接类型',
      dataIndex: 'linkType',
      key: 'linkType',
      width: 100,
      render: (t) => (t === 'external' ? '外部链接' : t)
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      width: 100,
      render: (a) => a || '-'
    },
    {
      title: '推荐',
      dataIndex: 'isRecommended',
      key: 'isRecommended',
      width: 70,
      render: (v) => (v ? <Badge status="success" text="是" /> : <Badge status="default" text="否" />)
    },
    {
      title: '浏览',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 70
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 70,
      render: (isEnabled) =>
        isEnabled ? <Badge status="success" text="启用" /> : <Badge status="default" text="禁用" />
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {canWrite && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDoc(record)}>
              编辑
            </Button>
          )}
          {canWrite && (
            <Popconfirm title="确定要删除这个文档吗？" onConfirm={() => handleDeleteDoc(record.id)}>
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ]

  const categoryColumns: ColumnsType<DocumentCategory> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '排序', dataIndex: 'order', key: 'order', width: 80 },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 80,
      render: (v) => (v ? <Badge status="success" text="启用" /> : <Badge status="default" text="禁用" />)
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {canWrite && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditCategory(record)}>
              编辑
            </Button>
          )}
          {canWrite && (
            <Popconfirm
              title="确定要删除这个分类吗？关联文档将变为未分类。"
              onConfirm={() => handleDeleteCategory(record.id)}>
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
    <div style={containerStyle}>
      {/* Left sidebar */}
      <div style={sidebarStyle}>
        <div style={sidebarHeaderStyle}>文档分类</div>
        <div style={sidebarListStyle}>
          <div style={sidebarItemStyle(!activeCategoryId)} onClick={() => handleCategoryClick(undefined)}>
            <span>全部</span>
            <Badge
              count={total}
              overflowCount={999}
              style={{ backgroundColor: 'var(--cs-bg-3)', color: 'var(--cs-text-2)' }}
            />
          </div>
          {categories.map((cat) => (
            <div
              key={cat.id}
              style={sidebarItemStyle(activeCategoryId === cat.id)}
              onClick={() => handleCategoryClick(cat.id)}>
              <span>{cat.name}</span>
            </div>
          ))}
        </div>
        {canWrite && (
          <div style={sidebarFooterStyle}>
            <Button
              size="small"
              icon={<SettingOutlined />}
              onClick={() => setCategoryManagerOpen(true)}
              style={{ flex: 1 }}>
              管理分类
            </Button>
          </div>
        )}
      </div>

      {/* Right content */}
      <div style={mainContentStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <span style={{ fontWeight: 500 }}>{activeCategoryName}</span>
            <Input.Search placeholder="搜索文档" allowClear onSearch={handleSearch} style={{ width: 200 }} />
          </Space>
          {canWrite && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDoc}>
              添加文档
            </Button>
          )}
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={documents}
          loading={loading}
          pagination={false}
          scroll={{ y: 'calc(100vh - 380px)' }}
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
      </div>

      {/* Document Modal */}
      <Modal
        title={editingDoc ? '编辑文档' : '添加文档'}
        open={docModalOpen}
        onOk={handleDocSubmit}
        onCancel={() => setDocModalOpen(false)}
        width={640}
        destroyOnClose>
        <Form form={docForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input maxLength={300} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="linkUrl" label="文档链接" rules={[{ required: true, message: '请输入文档链接' }]}>
            <Input placeholder="https://example.com/document" />
          </Form.Item>
          <Form.Item name="coverUrl" label="封面图链接">
            <Input placeholder="https://example.com/cover.jpg" />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="categoryId" label="分类">
              <Select options={categoryOptions} allowClear placeholder="选择分类" />
            </Form.Item>
            <Form.Item name="linkType" label="链接类型">
              <Select
                options={[
                  { value: 'external', label: '外部链接' },
                  { value: 'pdf', label: 'PDF' },
                  { value: 'markdown', label: 'Markdown' }
                ]}
              />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="author" label="作者">
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item name="order" label="排序">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="isEnabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="isRecommended" label="推荐" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Category Manager Modal */}
      <Modal
        title="管理文档分类"
        open={categoryManagerOpen}
        onCancel={() => setCategoryManagerOpen(false)}
        footer={null}
        width={600}>
        <div style={{ marginBottom: 16 }}>
          {canWrite && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={handleAddCategory}>
              添加分类
            </Button>
          )}
        </div>
        <Table rowKey="id" columns={categoryColumns} dataSource={categories} pagination={false} size="small" />
      </Modal>

      {/* Category Edit Modal */}
      <Modal
        title={editingCategory ? '编辑分类' : '添加分类'}
        open={categoryModalOpen}
        onOk={handleCategorySubmit}
        onCancel={() => setCategoryModalOpen(false)}
        width={400}
        destroyOnClose>
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入分类名称' }]}>
            <Input maxLength={100} />
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
