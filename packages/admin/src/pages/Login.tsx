import { Button, Card, Input, message, Space, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { authApi } from '../services/api'
import { useAuthStore } from '../store/auth'

const { Title, Text } = Typography

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [devUsername, setDevUsername] = useState('dev')
  const [devPassword, setDevPassword] = useState('dev123')
  const [devLoading, setDevLoading] = useState(false)
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const error = urlParams.get('error')

    if (error) {
      message.error('飞书授权失败: ' + (urlParams.get('error_description') || error))
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
      window.history.replaceState({}, '', window.location.pathname)
      message.success('登录成功')
      navigate('/dashboard')
    } catch (error: any) {
      window.history.replaceState({}, '', window.location.pathname)
      message.error(error.response?.data?.error?.message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleFeishuLogin = () => {
    const feishuAppId = import.meta.env.VITE_FEISHU_APP_ID
    const redirectUri = encodeURIComponent(window.location.origin + '/login')
    window.location.href = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${feishuAppId}&redirect_uri=${redirectUri}&response_type=code`
  }

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
        background: 'linear-gradient(135deg, #0a0e1a 0%, #1a1040 50%, #0a0e1a 100%)',
        backgroundSize: '400% 400%',
        position: 'relative',
        overflow: 'hidden'
      }}>
      {/* Ambient glow effects */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '10%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '10%',
          right: '15%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none'
        }}
      />

      <Card
        className="glass-card"
        style={{
          width: 420,
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          padding: '8px 0'
        }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title
              level={2}
              style={{
                marginBottom: 8,
                fontFamily: 'var(--cs-font-heading)',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
              Cherry Studio
            </Title>
            <Text style={{ color: 'var(--cs-text-2)' }}>企业管理后台</Text>
          </div>

          <Button
            type="primary"
            size="large"
            block
            loading={loading}
            onClick={handleFeishuLogin}
            style={{
              height: 48,
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              border: 'none',
              fontWeight: 600,
              fontSize: 15,
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)'
            }}>
            飞书登录
          </Button>

          {import.meta.env.DEV && (
            <div style={{ borderTop: '1px solid var(--cs-border)', paddingTop: 16 }}>
              <Text style={{ display: 'block', marginBottom: 12, color: 'var(--cs-text-3)' }}>
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
              <Button
                size="large"
                block
                loading={devLoading}
                onClick={handleDevLogin}
                style={{
                  height: 48,
                  background: 'var(--cs-bg-2)',
                  borderColor: 'var(--cs-border)',
                  color: 'var(--cs-text-1)'
                }}>
                开发者登录
              </Button>
            </div>
          )}
        </Space>
      </Card>
    </div>
  )
}
