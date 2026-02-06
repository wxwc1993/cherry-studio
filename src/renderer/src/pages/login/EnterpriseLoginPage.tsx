import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { Button, Input, Segmented, Spin } from 'antd'

import { useEnterpriseConfig } from '@renderer/hooks/useEnterpriseConfig'
import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { type EnterpriseUser, useEnterpriseStore } from '@renderer/store/enterprise'

type LoginMode = 'feishu' | 'dev'

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

  useEffect(() => {
    // Check for Feishu callback code
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')

    if (code && config?.serverUrl) {
      handleFeishuCallback(code)
    }
  }, [config])

  const handleFeishuCallback = useCallback(
    async (code: string) => {
      if (!config?.serverUrl) {
        setError(t('settings.enterprise.login.error.noServerConfig'))
        return
      }

      setLoading(true)
      setError(null)

      // Save server address before login
      setEnterpriseMode(true, config.serverUrl)

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
        const message = err instanceof Error ? err.message : t('settings.enterprise.login.error.failed')
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [config, navigate, setAuth, setEnterpriseMode, t]
  )

  const handleFeishuLogin = useCallback(() => {
    if (!config?.serverUrl) {
      setError(t('settings.enterprise.login.error.noServerConfig'))
      return
    }

    // Save server address
    setEnterpriseMode(true, config.serverUrl)

    // Redirect to Feishu authorization page
    const feishuAppId = config.feishuAppId
    if (!feishuAppId) {
      setError(t('settings.enterprise.login.error.noServerConfig'))
      return
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/login/enterprise')
    window.location.href = `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${feishuAppId}&redirect_uri=${redirectUri}&response_type=code`
  }, [config, setEnterpriseMode, t])

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
