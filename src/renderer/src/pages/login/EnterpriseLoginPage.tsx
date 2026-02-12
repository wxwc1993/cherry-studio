import { loggerService } from '@logger'
import { useEnterpriseConfig } from '@renderer/hooks/useEnterpriseConfig'
import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { type EnterpriseUser, useEnterpriseStore } from '@renderer/store/enterprise'
import { Button, Input, Segmented, Spin } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

type LoginMode = 'feishu' | 'dev'

const POLL_INTERVAL_MS = 2000
const POLL_MAX_ATTEMPTS = 60

export default function EnterpriseLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth, setEnterpriseMode } = useEnterpriseStore()
  const { config, loading: configLoading } = useEnterpriseConfig()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginMode, setLoginMode] = useState<LoginMode>('feishu')

  // Developer login form
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // 用于取消轮询的 ref
  const pollingRef = useRef(false)

  // 飞书授权窗口引用，用于登录成功后关闭窗口
  const feishuWindowRef = useRef<Window | null>(null)

  // 组件卸载时取消轮询，关闭授权窗口，防止内存泄漏和状态更新
  useEffect(() => {
    return () => {
      pollingRef.current = false
      // 尝试关闭飞书授权窗口
      if (feishuWindowRef.current) {
        feishuWindowRef.current.close()
        feishuWindowRef.current = null
      }
    }
  }, [])

  const startPolling = useCallback(
    async (sessionId: string) => {
      setLoading(true)
      setError(null)
      pollingRef.current = true

      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        if (!pollingRef.current) {
          setLoading(false)
          return
        }

        try {
          const response = await enterpriseApi.feishuPoll(sessionId)
          const data = response.data as {
            status: string
            user?: EnterpriseUser
            accessToken?: string
            refreshToken?: string
            error?: string
          }

          if (data.status === 'success' && data.user && data.accessToken && data.refreshToken) {
            pollingRef.current = false
            // 关闭飞书授权窗口
            if (feishuWindowRef.current) {
              feishuWindowRef.current.close()
              feishuWindowRef.current = null
            }
            setAuth(data.user, data.accessToken, data.refreshToken)
            navigate('/')
            return
          }

          if (data.status === 'error') {
            pollingRef.current = false
            setError(data.error || t('settings.enterprise.login.error.failed'))
            setLoading(false)
            return
          }

          // status === 'pending'，继续等待
        } catch (err) {
          // 网络错误，记录后继续重试
          loggerService.withContext('EnterpriseLogin').warn('Feishu poll network error, retrying', { attempt: i, err })
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }

      // 超时
      pollingRef.current = false
      setError(t('settings.enterprise.login.error.timeout'))
      setLoading(false)
    },
    [setAuth, navigate, t]
  )

  const handleFeishuLogin = useCallback(() => {
    if (!config?.serverUrl) {
      setError(t('settings.enterprise.login.error.noServerConfig'))
      return
    }

    setEnterpriseMode(true, config.serverUrl)

    const feishuAppId = config.feishuAppId
    if (!feishuAppId) {
      setError(t('settings.enterprise.login.error.noServerConfig'))
      return
    }

    // 生成随机 sessionId 用于关联轮询
    const sessionId = crypto.randomUUID()

    // 使用企业服务器地址作为 redirect_uri
    const redirectUri = encodeURIComponent(`${config.serverUrl}/api/v1/auth/feishu/callback`)

    // 用新窗口打开飞书授权页，保存窗口引用用于登录成功后关闭
    feishuWindowRef.current = window.open(
      `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${feishuAppId}&redirect_uri=${redirectUri}&state=${sessionId}&response_type=code`,
      'feishu-oauth',
      'width=720,height=720'
    )

    // 开始轮询登录结果
    startPolling(sessionId)
  }, [config, setEnterpriseMode, startPolling, t])

  const handleDevLogin = useCallback(async () => {
    if (!config?.serverUrl) {
      setError(t('settings.enterprise.login.error.noServerConfig'))
      return
    }

    if (!username.trim()) {
      setError(t('settings.enterprise.login.error.usernameRequired'))
      return
    }

    if (!password) {
      setError(t('settings.enterprise.login.error.passwordRequired'))
      return
    }

    // Save server address
    setEnterpriseMode(true, config.serverUrl)

    setLoading(true)
    setError(null)

    try {
      const response = await enterpriseApi.devLogin(username, password)
      const { user, accessToken, refreshToken } = response.data as {
        user: EnterpriseUser
        accessToken: string
        refreshToken: string
      }
      setAuth(user, accessToken, refreshToken)
      navigate('/')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('settings.enterprise.login.error.failed')
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [config, username, password, setEnterpriseMode, setAuth, navigate, t])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && loginMode === 'dev') {
        handleDevLogin()
      }
    },
    [loginMode, handleDevLogin]
  )

  if (configLoading) {
    return (
      <Container>
        <Spin size="large" />
      </Container>
    )
  }

  return (
    <Container>
      <Card>
        <Logo>Cherry Studio</Logo>
        <Subtitle>{t('settings.enterprise.login.title')}</Subtitle>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {!config?.serverUrl && <InfoMessage>{t('settings.enterprise.login.error.noServerConfig')}</InfoMessage>}

        <FormGroup>
          <StyledSegmented
            value={loginMode}
            onChange={(value) => setLoginMode(value as LoginMode)}
            options={[
              { label: t('settings.enterprise.login.feishuLogin'), value: 'feishu' },
              { label: t('settings.enterprise.login.devLogin'), value: 'dev' }
            ]}
            block
          />
        </FormGroup>

        {loginMode === 'feishu' ? (
          <LoginButton
            onClick={handleFeishuLogin}
            loading={loading}
            disabled={!config?.serverUrl}
            block
            size="large"
            shape="round">
            {t('settings.enterprise.login.feishuLogin')}
          </LoginButton>
        ) : (
          <>
            <FormGroup>
              <StyledInput
                placeholder={t('settings.enterprise.login.username')}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                size="large"
                variant="filled"
                disabled={!config?.serverUrl}
              />
            </FormGroup>
            <FormGroup>
              <StyledPasswordInput
                placeholder={t('settings.enterprise.login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                size="large"
                variant="filled"
                disabled={!config?.serverUrl}
              />
            </FormGroup>
            <LoginButton
              onClick={handleDevLogin}
              loading={loading}
              disabled={!config?.serverUrl}
              block
              size="large"
              shape="round">
              {t('settings.enterprise.login.loginButton')}
            </LoginButton>
          </>
        )}
      </Card>
    </Container>
  )
}

const Container = styled.div`
  min-height: 100vh;
  width: 100%;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
`

const Card = styled.div`
  background: var(--color-background-soft);
  border-radius: var(--list-item-border-radius);
  padding: 48px;
  width: 400px;
  text-align: center;
`

const Logo = styled.div`
  font-size: 28px;
  font-weight: bold;
  color: var(--color-text-1);
  margin-bottom: 8px;
`

const Subtitle = styled.div`
  color: var(--color-text-2);
  margin-bottom: 32px;
`

const FormGroup = styled.div`
  margin-bottom: 16px;
`

const StyledInput = styled(Input)`
  &.ant-input-lg {
    height: 40px;
    border-radius: 20px;
  }

  &.ant-input-filled {
    background: var(--color-background-mute);
    border: none;

    &:hover,
    &:focus {
      background: var(--color-background-mute);
    }
  }
`

const StyledPasswordInput = styled(Input.Password)`
  &.ant-input-password.ant-input-affix-wrapper-lg {
    height: 40px;
    border-radius: 20px;
  }

  &.ant-input-filled {
    background: var(--color-background-mute);
    border: none;

    &:hover,
    &:focus {
      background: var(--color-background-mute);
    }
  }
`

const StyledSegmented = styled(Segmented)`
  &.ant-segmented {
    background: var(--color-background-mute);
    border-radius: 20px;
    padding: 4px;
  }

  .ant-segmented-item {
    border-radius: 16px;
  }

  .ant-segmented-item-selected {
    background: var(--color-background);
  }
`

const LoginButton = styled(Button)`
  &.ant-btn {
    height: 40px;
    font-size: 14px;
    background: var(--color-background-mute);
    border: none;
    color: var(--color-text-1);

    &:hover {
      background: var(--color-background-soft) !important;
      color: var(--color-text-1) !important;
    }

    &:disabled {
      opacity: 0.5;
    }
  }
`

const ErrorMessage = styled.div`
  color: var(--color-error);
  margin-bottom: 16px;
  padding: 12px;
  background: transparent;
  border: 0.5px solid var(--color-error);
  border-radius: 8px;
`

const InfoMessage = styled.div`
  color: var(--color-warning);
  margin-bottom: 16px;
  padding: 12px;
  background: transparent;
  border: 0.5px solid var(--color-warning);
  border-radius: 8px;
`
