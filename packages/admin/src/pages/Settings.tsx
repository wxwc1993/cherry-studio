import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Divider, Form, Input, InputNumber, message, Space, Switch, Tabs } from 'antd'
import { useEffect, useState } from 'react'

import { adminApi } from '../services/api'

interface SystemSettings {
  general: {
    siteName: string
    logo?: string
    defaultLanguage: string
    sessionTimeout: number
  }
  security: {
    maxLoginAttempts: number
    lockoutDuration: number
    passwordMinLength: number
    requireMFA: boolean
    allowedIPs?: string[]
  }
  feishu: {
    appId: string
    appSecret: string
    encryptKey?: string
    verificationToken?: string
  }
  storage: {
    type: 'local' | 'minio' | 's3'
    endpoint?: string
    bucket?: string
    accessKey?: string
    secretKey?: string
  }
  email: {
    enabled: boolean
    smtpHost?: string
    smtpPort?: number
    smtpUser?: string
    smtpPassword?: string
    fromAddress?: string
  }
}

export default function Settings() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generalForm] = Form.useForm()
  const [securityForm] = Form.useForm()
  const [feishuForm] = Form.useForm()
  const [storageForm] = Form.useForm()
  const [emailForm] = Form.useForm()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await adminApi.getSettings()
      const settings: SystemSettings = response.data.data

      generalForm.setFieldsValue(settings.general)
      securityForm.setFieldsValue(settings.security)
      feishuForm.setFieldsValue(settings.feishu)
      storageForm.setFieldsValue(settings.storage)
      emailForm.setFieldsValue(settings.email)
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '加载设置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (section: string, form: any) => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await adminApi.updateSettings({ [section]: values })
      message.success('保存成功')
    } catch (error: any) {
      if (error.response) {
        message.error(error.response?.data?.error?.message || '保存失败')
      }
    } finally {
      setSaving(false)
    }
  }

  const tabItems = [
    {
      key: 'general',
      label: '基本设置',
      children: (
        <Card loading={loading}>
          <Form form={generalForm} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="siteName" label="站点名称" rules={[{ required: true, message: '请输入站点名称' }]}>
              <Input placeholder="Cherry Studio 企业版" />
            </Form.Item>
            <Form.Item name="logo" label="Logo URL">
              <Input placeholder="https://example.com/logo.png" />
            </Form.Item>
            <Form.Item name="defaultLanguage" label="默认语言" initialValue="zh-CN">
              <Input placeholder="zh-CN" />
            </Form.Item>
            <Form.Item
              name="sessionTimeout"
              label="会话超时 (分钟)"
              initialValue={30}
              rules={[{ required: true, message: '请输入会话超时时间' }]}>
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
            <Divider />
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSave('general', generalForm)}
                loading={saving}>
                保存
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'security',
      label: '安全设置',
      children: (
        <Card loading={loading}>
          <Form form={securityForm} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="maxLoginAttempts" label="最大登录尝试次数" initialValue={5}>
              <InputNumber min={3} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="lockoutDuration" label="锁定时长 (分钟)" initialValue={30}>
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="passwordMinLength" label="密码最小长度" initialValue={8}>
              <InputNumber min={6} max={32} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="requireMFA" label="强制双因素认证" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="allowedIPs" label="IP 白名单" extra="每行一个 IP 或 CIDR，留空表示不限制">
              <Input.TextArea rows={4} placeholder="192.168.1.0/24&#10;10.0.0.1" />
            </Form.Item>
            <Divider />
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSave('security', securityForm)}
                loading={saving}>
                保存
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'feishu',
      label: '飞书集成',
      children: (
        <Card loading={loading}>
          <Alert
            message="飞书配置说明"
            description="请在飞书开放平台创建应用，获取 App ID 和 App Secret。回调地址设置为: {your-domain}/api/v1/auth/feishu/callback"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Form form={feishuForm} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="appId" label="App ID" rules={[{ required: true, message: '请输入 App ID' }]}>
              <Input placeholder="cli_xxxxx" />
            </Form.Item>
            <Form.Item name="appSecret" label="App Secret" rules={[{ required: true, message: '请输入 App Secret' }]}>
              <Input.Password placeholder="输入 App Secret" />
            </Form.Item>
            <Form.Item name="encryptKey" label="Encrypt Key">
              <Input.Password placeholder="可选，事件订阅加密密钥" />
            </Form.Item>
            <Form.Item name="verificationToken" label="Verification Token">
              <Input placeholder="可选，事件订阅验证令牌" />
            </Form.Item>
            <Divider />
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSave('feishu', feishuForm)}
                loading={saving}>
                保存
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'storage',
      label: '存储配置',
      children: (
        <Card loading={loading}>
          <Form form={storageForm} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="type" label="存储类型" initialValue="local">
              <Input placeholder="local / minio / s3" />
            </Form.Item>
            <Form.Item name="endpoint" label="存储端点">
              <Input placeholder="http://minio:9000" />
            </Form.Item>
            <Form.Item name="bucket" label="存储桶">
              <Input placeholder="cherry-studio" />
            </Form.Item>
            <Form.Item name="accessKey" label="Access Key">
              <Input placeholder="访问密钥" />
            </Form.Item>
            <Form.Item name="secretKey" label="Secret Key">
              <Input.Password placeholder="秘密密钥" />
            </Form.Item>
            <Divider />
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSave('storage', storageForm)}
                loading={saving}>
                保存
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    },
    {
      key: 'email',
      label: '邮件配置',
      children: (
        <Card loading={loading}>
          <Form form={emailForm} layout="vertical" style={{ maxWidth: 600 }}>
            <Form.Item name="enabled" label="启用邮件通知" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="smtpHost" label="SMTP 服务器">
              <Input placeholder="smtp.example.com" />
            </Form.Item>
            <Form.Item name="smtpPort" label="SMTP 端口" initialValue={587}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="smtpUser" label="SMTP 用户名">
              <Input placeholder="user@example.com" />
            </Form.Item>
            <Form.Item name="smtpPassword" label="SMTP 密码">
              <Input.Password placeholder="密码" />
            </Form.Item>
            <Form.Item name="fromAddress" label="发件人地址">
              <Input placeholder="noreply@example.com" />
            </Form.Item>
            <Divider />
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSave('email', emailForm)}
                loading={saving}>
                保存
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSettings}>
                重置
              </Button>
            </Space>
          </Form>
        </Card>
      )
    }
  ]

  return <Tabs items={tabItems} />
}
