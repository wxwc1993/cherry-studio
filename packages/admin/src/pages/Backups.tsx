import { useEffect, useState } from 'react'
import { Table, Button, Space, Modal, Form, Select, Tag, message, Popconfirm, Card, Progress, Upload } from 'antd'
import {
  CloudUploadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { adminApi } from '../services/api'
import dayjs from 'dayjs'

interface Backup {
  id: string
  type: 'full' | 'incremental'
  status: 'pending' | 'running' | 'completed' | 'failed'
  size: number
  filePath: string
  createdAt: string
  completedAt?: string
  error?: string
}

const backupTypeOptions = [
  { label: '全量备份', value: 'full' },
  { label: '增量备份', value: 'incremental' }
]

export default function Backups() {
  const [loading, setLoading] = useState(false)
  const [backups, setBackups] = useState<Backup[]>([])
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [restoreModalOpen, setRestoreModalOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const response = await adminApi.listBackups()
      setBackups(response.data.data)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载备份列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    form.resetFields()
    setCreateModalOpen(true)
  }

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields()
      setCreating(true)
      await adminApi.createBackup({ type: values.type })
      message.success('备份任务已创建')
      setCreateModalOpen(false)
      loadData()
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '创建备份失败')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = (backup: Backup) => {
    setSelectedBackup(backup)
    setRestoreModalOpen(true)
  }

  const handleRestoreConfirm = async () => {
    if (!selectedBackup) return
    try {
      setRestoring(true)
      await adminApi.restore({ backupId: selectedBackup.id })
      message.success('恢复任务已启动')
      setRestoreModalOpen(false)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '恢复失败')
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await adminApi.deleteBackup(id)
      message.success('删除成功')
      loadData()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '删除失败')
    }
  }

  const handleDownload = async (backup: Backup) => {
    try {
      const response = await adminApi.downloadBackup(backup.id)
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `backup-${backup.type}-${dayjs(backup.createdAt).format('YYYYMMDD-HHmmss')}.tar.gz`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '下载失败')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
  }

  const columns: ColumnsType<Backup> = [
    {
      title: '备份类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => <Tag color={type === 'full' ? 'blue' : 'green'}>{type === 'full' ? '全量' : '增量'}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const colors: Record<string, string> = {
          pending: 'default',
          running: 'processing',
          completed: 'success',
          failed: 'error'
        }
        const labels: Record<string, string> = {
          pending: '等待中',
          running: '进行中',
          completed: '已完成',
          failed: '失败'
        }
        return (
          <Space>
            <Tag color={colors[status]}>{labels[status]}</Tag>
            {status === 'running' && <Progress type="circle" percent={50} size={20} />}
            {status === 'failed' && record.error && (
              <span style={{ color: '#ff4d4f', fontSize: 12 }}>{record.error}</span>
            )}
          </Space>
        )
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size) => formatFileSize(size)
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      render: (date) => (date ? dayjs(date).format('YYYY-MM-DD HH:mm:ss') : '-')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<CloudDownloadOutlined />}
            onClick={() => handleDownload(record)}
            disabled={record.status !== 'completed'}>
            下载
          </Button>
          <Button
            type="link"
            icon={<ReloadOutlined />}
            onClick={() => handleRestore(record)}
            disabled={record.status !== 'completed'}>
            恢复
          </Button>
          <Popconfirm title="确定要删除这个备份吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Card
        title="备份管理"
        extra={
          <Space>
            <Upload
              accept=".tar.gz,.zip"
              showUploadList={false}
              beforeUpload={async (file) => {
                const formData = new FormData()
                formData.append('file', file)
                try {
                  await adminApi.uploadBackup(formData)
                  message.success('上传成功')
                  loadData()
                } catch (error: any) {
                  message.error(error.response?.data?.error?.message || '上传失败')
                }
                return false
              }}>
              <Button icon={<UploadOutlined />}>上传备份</Button>
            </Upload>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={handleCreate}>
              创建备份
            </Button>
          </Space>
        }>
        <Table rowKey="id" columns={columns} dataSource={backups} loading={loading} pagination={false} />
      </Card>

      <Card title="备份策略" style={{ marginTop: 16 }}>
        <p>
          <strong>增量备份：</strong> 每日 02:00 自动执行，保留 7 天
        </p>
        <p>
          <strong>全量备份：</strong> 每周日 03:00 自动执行，保留 4 周
        </p>
        <p>
          <strong>归档备份：</strong> 每月 1 日自动执行，保留 12 个月
        </p>
      </Card>

      <Modal
        title="创建备份"
        open={createModalOpen}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateModalOpen(false)}
        confirmLoading={creating}
        destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item
            name="type"
            label="备份类型"
            initialValue="full"
            rules={[{ required: true, message: '请选择备份类型' }]}>
            <Select options={backupTypeOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="确认恢复"
        open={restoreModalOpen}
        onOk={handleRestoreConfirm}
        onCancel={() => setRestoreModalOpen(false)}
        confirmLoading={restoring}
        okText="确认恢复"
        okButtonProps={{ danger: true }}>
        <p>
          <strong>警告：</strong> 恢复操作将覆盖当前所有数据！
        </p>
        <p>确定要从以下备份恢复吗？</p>
        <p>
          <strong>备份类型：</strong> {selectedBackup?.type === 'full' ? '全量' : '增量'}
        </p>
        <p>
          <strong>创建时间：</strong> {selectedBackup && dayjs(selectedBackup.createdAt).format('YYYY-MM-DD HH:mm:ss')}
        </p>
        <p>
          <strong>大小：</strong> {selectedBackup && formatFileSize(selectedBackup.size)}
        </p>
      </Modal>
    </div>
  )
}
