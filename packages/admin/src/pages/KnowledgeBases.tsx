import {
  DeleteOutlined,
  EditOutlined,
  FileOutlined,
  FolderOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Form,
  Input,
  List,
  message,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Upload
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadFile } from 'antd/es/upload/interface'
import { useEffect, useState } from 'react'

import { departmentsApi, knowledgeBasesApi, usersApi } from '../services/api'
import { useAuthStore } from '../store/auth'

interface KnowledgeBase {
  id: string
  name: string
  description?: string
  visibility: 'private' | 'department' | 'public'
  ownerDepartment: { id: string; name: string }
  documentCount: number
  createdAt: string
}

interface KBDocument {
  id: string
  fileName: string
  fileSize: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
}

interface Department {
  id: string
  name: string
}

interface User {
  id: string
  name: string
  email: string
}

const visibilityOptions = [
  { label: '私有', value: 'private' },
  { label: '部门可见', value: 'department' },
  { label: '全部可见', value: 'public' }
]

const permissionLevelOptions = [
  { label: '查看者', value: 'viewer' },
  { label: '编辑者', value: 'editor' },
  { label: '管理员', value: 'admin' }
]

export default function KnowledgeBases() {
  const [loading, setLoading] = useState(false)
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [permissionModalOpen, setPermissionModalOpen] = useState(false)
  const [editingKB, setEditingKB] = useState<KnowledgeBase | null>(null)
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = useState<KBDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [permissionTargetType, setPermissionTargetType] = useState<'department' | 'user'>('department')
  const [form] = Form.useForm()
  const [permissionForm] = Form.useForm()
  const { hasPermission } = useAuthStore()

  const canWrite = hasPermission('knowledgeBases', 'write')
  const canAdmin = hasPermission('knowledgeBases', 'admin')

  useEffect(() => {
    loadData()
    loadDepartmentsAndUsers()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await knowledgeBasesApi.list()
      setKnowledgeBases(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载知识库列表失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDepartmentsAndUsers = async () => {
    try {
      const [deptRes, userRes] = await Promise.all([departmentsApi.list(), usersApi.options()])
      setDepartments(deptRes.data.data)
      setUsers(userRes.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载部门和用户信息失败')
    }
  }

  const loadDocuments = async (kbId: string) => {
    try {
      const response = await knowledgeBasesApi.getDocuments(kbId)
      setDocuments(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载文档列表失败')
    }
  }

  const handleAdd = () => {
    setEditingKB(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (kb: KnowledgeBase) => {
    setEditingKB(kb)
    form.setFieldsValue({
      name: kb.name,
      description: kb.description,
      visibility: kb.visibility,
      ownerDepartmentId: kb.ownerDepartment.id
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await knowledgeBasesApi.delete(id)
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingKB) {
        await knowledgeBasesApi.update(editingKB.id, values)
        message.success('更新成功')
      } else {
        await knowledgeBasesApi.create(values)
        message.success('创建成功')
      }
      setModalOpen(false)
      loadData()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const handleViewDetails = (kb: KnowledgeBase) => {
    setSelectedKB(kb)
    loadDocuments(kb.id)
    setDetailModalOpen(true)
  }

  const handlePermissions = (kb: KnowledgeBase) => {
    setSelectedKB(kb)
    permissionForm.resetFields()
    setPermissionTargetType('department')
    setPermissionModalOpen(true)
  }

  const handleTargetTypeChange = (value: 'department' | 'user') => {
    setPermissionTargetType(value)
    permissionForm.setFieldValue('targetId', undefined)
  }

  const handlePermissionSubmit = async () => {
    try {
      const values = await permissionForm.validateFields()
      await knowledgeBasesApi.updatePermissions(selectedKB!.id, {
        targetType: values.targetType,
        targetId: values.targetId,
        level: values.level
      })
      message.success('权限更新成功')
      setPermissionModalOpen(false)
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '操作失败')
      }
    }
  }

  const handleUpload = async (file: UploadFile) => {
    if (!selectedKB) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file as any)
      await knowledgeBasesApi.uploadDocument(selectedKB.id, formData)
      message.success('上传成功')
      loadDocuments(selectedKB.id)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    if (!selectedKB) return
    try {
      await knowledgeBasesApi.deleteDocument(selectedKB.id, docId)
      message.success('删除成功')
      loadDocuments(selectedKB.id)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const columns: ColumnsType<KnowledgeBase> = [
    {
      title: '知识库名称',
      dataIndex: 'name',
      key: 'name',
      render: (name) => (
        <Space>
          <FolderOutlined />
          {name}
        </Space>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '所属部门',
      dataIndex: ['ownerDepartment', 'name'],
      key: 'ownerDepartment'
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      key: 'visibility',
      render: (visibility) => {
        const colors: Record<string, string> = {
          private: 'default',
          department: 'blue',
          public: 'green'
        }
        const labels: Record<string, string> = {
          private: '私有',
          department: '部门可见',
          public: '全部可见'
        }
        return <Tag color={colors[visibility]}>{labels[visibility]}</Tag>
      }
    },
    {
      title: '文档数',
      dataIndex: 'documentCount',
      key: 'documentCount'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleViewDetails(record)}>
            查看
          </Button>
          {canWrite && (
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </Button>
          )}
          {canAdmin && (
            <Button type="link" onClick={() => handlePermissions(record)}>
              权限
            </Button>
          )}
          {canAdmin && (
            <Popconfirm title="确定要删除这个知识库吗？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
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
            创建知识库
          </Button>
        )}
      </div>

      <Table rowKey="id" columns={columns} dataSource={knowledgeBases} loading={loading} pagination={false} />

      <Modal
        title={editingKB ? '编辑知识库' : '创建知识库'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="知识库名称" rules={[{ required: true, message: '请输入知识库名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ownerDepartmentId" label="所属部门" rules={[{ required: true, message: '请选择所属部门' }]}>
            <Select options={departments.map((d) => ({ label: d.name, value: d.id }))} placeholder="请选择所属部门" />
          </Form.Item>
          <Form.Item name="visibility" label="可见性" initialValue="department">
            <Select options={visibilityOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedKB?.name}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose>
        <Tabs
          items={[
            {
              key: 'documents',
              label: '文档列表',
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Upload
                      beforeUpload={(file) => {
                        handleUpload(file as any)
                        return false
                      }}
                      showUploadList={false}>
                      <Button icon={<UploadOutlined />} loading={uploading}>
                        上传文档
                      </Button>
                    </Upload>
                  </div>
                  <List
                    dataSource={documents}
                    renderItem={(doc) => (
                      <List.Item
                        actions={[
                          <Popconfirm
                            key="delete"
                            title="确定要删除这个文档吗？"
                            onConfirm={() => handleDeleteDocument(doc.id)}>
                            <Button type="link" danger size="small">
                              删除
                            </Button>
                          </Popconfirm>
                        ]}>
                        <List.Item.Meta
                          avatar={<Avatar icon={<FileOutlined />} />}
                          title={doc.fileName}
                          description={
                            <Space>
                              <span>{formatFileSize(doc.fileSize)}</span>
                              {doc.status === 'processing' && <Progress percent={50} size="small" status="active" />}
                              {doc.status === 'completed' && <Tag color="green">已完成</Tag>}
                              {doc.status === 'failed' && <Tag color="red">失败</Tag>}
                              {doc.status === 'pending' && <Tag>待处理</Tag>}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )
            },
            {
              key: 'info',
              label: '基本信息',
              children: (
                <div>
                  <p>
                    <strong>名称：</strong> {selectedKB?.name}
                  </p>
                  <p>
                    <strong>描述：</strong> {selectedKB?.description || '无'}
                  </p>
                  <p>
                    <strong>所属部门：</strong> {selectedKB?.ownerDepartment.name}
                  </p>
                  <p>
                    <strong>可见性：</strong> {visibilityOptions.find((o) => o.value === selectedKB?.visibility)?.label}
                  </p>
                  <p>
                    <strong>文档数：</strong> {selectedKB?.documentCount}
                  </p>
                </div>
              )
            }
          ]}
        />
      </Modal>

      <Modal
        title="知识库权限设置"
        open={permissionModalOpen}
        onOk={handlePermissionSubmit}
        onCancel={() => setPermissionModalOpen(false)}
        destroyOnClose>
        <Form form={permissionForm} layout="vertical">
          <Form.Item name="targetType" label="授权类型" rules={[{ required: true, message: '请选择授权类型' }]}>
            <Select
              onChange={handleTargetTypeChange}
              options={[
                { label: '部门', value: 'department' },
                { label: '用户', value: 'user' }
              ]}
            />
          </Form.Item>
          <Form.Item name="targetId" label="授权对象" rules={[{ required: true, message: '请选择授权对象' }]}>
            <Select
              placeholder={permissionTargetType === 'department' ? '请选择部门' : '请选择用户'}
              showSearch
              optionFilterProp="label"
              options={
                permissionTargetType === 'department'
                  ? departments.map((d) => ({ label: d.name, value: d.id }))
                  : users.map((u) => ({ label: `${u.name} (${u.email})`, value: u.id }))
              }
            />
          </Form.Item>
          <Form.Item name="level" label="权限级别" rules={[{ required: true, message: '请选择权限级别' }]}>
            <Select options={permissionLevelOptions} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
