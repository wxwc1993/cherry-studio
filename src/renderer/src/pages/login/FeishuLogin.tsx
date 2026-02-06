import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { type EnterpriseUser, useEnterpriseStore } from '@renderer/store/enterprise'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
`

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 48px;
  width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`

const Logo = styled.div`
  font-size: 32px;
  font-weight: bold;
  color: #333;
  margin-bottom: 8px;
`

const Subtitle = styled.div`
  color: #666;
  margin-bottom: 32px;
`

const Button = styled.button<{ primary?: boolean }>`
  width: 100%;
  padding: 16px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-bottom: 12px;
  transition: all 0.2s;

  ${(props) =>
    props.primary
      ? `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    &:hover {
      opacity: 0.9;
    }
  `
      : `
    background: #f5f5f5;
    color: #333;
    &:hover {
      background: #eee;
    }
  `}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ErrorMessage = styled.div`
  color: #ff4d4f;
  margin-bottom: 16px;
  padding: 12px;
  background: #fff2f0;
  border-radius: 8px;
`

const ServerInput = styled.input`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`

export default function FeishuLogin() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverUrl, setServerUrl] = useState('')
  const navigate = useNavigate()
  const { setAuth, setEnterpriseMode, enterpriseServer } = useEnterpriseStore()

  useEffect(() => {
    // 检查是否有回调 code
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code) {
      handleFeishuCallback(code)
    }

    // 加载保存的服务器地址
    if (enterpriseServer) {
      setServerUrl(enterpriseServer)
    }
  }, [])

  const handleFeishuCallback = async (code: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await enterpriseApi.feishuLogin(code)
      const { user, accessToken, refreshToken } = response.data as {
        user: EnterpriseUser
        accessToken: string
        refreshToken: string
      }
      setAuth(user, accessToken, refreshToken)
      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleFeishuLogin = () => {
    if (!serverUrl) {
      setError('请输入企业服务器地址')
      return
    }

    // 保存服务器地址
    setEnterpriseMode(true, serverUrl)

    // 跳转到飞书授权页面
    // 这里需要从服务器获取飞书 App ID
    // 暂时使用环境变量
    const feishuAppId = import.meta.env.VITE_FEISHU_APP_ID
    const redirectUri = encodeURIComponent(window.location.origin + '/login/feishu')
    window.location.href = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${feishuAppId}&redirect_uri=${redirectUri}&response_type=code`
  }

  const handleBackToPersonal = () => {
    setEnterpriseMode(false)
    navigate('/')
  }

  return (
    <Container>
      <Card>
        <Logo>🍒 Cherry Studio</Logo>
        <Subtitle>企业版登录</Subtitle>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        <ServerInput
          type="url"
          placeholder="企业服务器地址 (如: https://api.example.com)"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
        />

        <Button primary onClick={handleFeishuLogin} disabled={loading}>
          {loading ? '登录中...' : '飞书登录'}
        </Button>

        <Button onClick={handleBackToPersonal}>返回个人版</Button>
      </Card>
    </Container>
  )
}
