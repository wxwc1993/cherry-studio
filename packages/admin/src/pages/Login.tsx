import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Typography, Space, message, Input } from 'antd'
import { useAuthStore } from '../store/auth'
import { authApi } from '../services/api'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [devUsername, setDevUsername] = useState('dev')
  const [devPassword, setDevPassword] = useState('dev123')
  const [devLoading, setDevLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  // 处理飞书 OAuth 回调
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      message.error('飞书授权失败: ' + (urlParams.get('error_description') || error))
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (code) {
      handleFeishuCallback(code)
    }
  }, [])

  const handleFeishuCallback = async (code: string) => {
    setLoading(true)
    try {
      const response = await authApi.feishuLogin(code)
      const { user, accessToken, refreshToken } = response.data.data
      setAuth(user, accessToken, refreshToken)
      // 清除 URL 参数
      window.history.replaceState({}, '', window.location.pathname)
      message.success('登录成功')
      navigate('/dashboard')
    } catch (error: any) {
      // 清除 URL 参数避免重复尝试
      window.history.replaceState({}, '', window.location.pathname)
      message.error(error.response?.data?.error?.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleFeishuLogin = () => {
    // 重定向到飞书授权
    const feishuAppId = import.meta.env.VITE_FEISHU_APP_ID
    const redirectUri = encodeURIComponent(window.location.origin + '/login')
    window.location.href = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${feishuAppId}&redirect_uri=${redirectUri}&response_type=code`
  }

  // 开发环境：真实后端登录
  const handleDevLogin = async () => {
    setDevLoading(true)
    try {
      const response = await authApi.devLogin(devUsername, devPassword)
      const { user, accessToken, refreshToken } = response.data.data
      setAuth(user, accessToken, refreshToken)
      message.success('登录成功')
      navigate('/dashboard')
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || '开发者登录失败')
    } finally {
      setDevLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
      <Card style={{ width: 400, textAlign: 'center' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={2} style={{ marginBottom: 8 }}>
              Cherry Studio
            </Title>
            <Text type="secondary">企业管理后台</Text>
          </div>

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleFeishuLogin}
            style={{ height: 48 }}>
            飞书登录
          </Button>

          {import.meta.env.DEV && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                开发者登录 (仅开发环境)
              </Text>
              <Input
                placeholder="用户名"
                value={devUsername}
                onChange={(e) => setDevUsername(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <Input.Password
                placeholder="密码"
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                style={{ marginBottom: 12 }}
              />
              <Button size="large" block loading={devLoading} onClick={handleDevLogin} style={{ height: 48 }}>
                开发者登录
              </Button>
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}
