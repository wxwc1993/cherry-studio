import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import type { ApiLogEntry } from '@renderer/services/EnterpriseApi'
import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { useEnterpriseStore } from '@renderer/store/enterprise'

interface Props {
  onClose: () => void
}

export default function EnterpriseDebugPanel({ onClose }: Props) {
  const { t } = useTranslation()
  const { isEnterpriseMode, isAuthenticated, enterpriseServer, accessToken, refreshToken, clearAuth } =
    useEnterpriseStore()

  const [logs, setLogs] = useState<ApiLogEntry[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  const refreshLogs = useCallback(() => {
    setLogs(enterpriseApi.getLogs())
  }, [])

  useEffect(() => {
    refreshLogs()
    if (autoRefresh) {
      const interval = setInterval(refreshLogs, 2000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [autoRefresh, refreshLogs])

  const handleClearAuth = useCallback(() => {
    clearAuth()
  }, [clearAuth])

  const handleClearLogs = useCallback(() => {
    enterpriseApi.clearLogs()
    refreshLogs()
  }, [refreshLogs])

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString()
  }

  const getTokenExpiry = (token: string | null): string => {
    if (!token) return t('settings.enterprise.debug.noToken')

    try {
      const parts = token.split('.')
      if (parts.length !== 3) return t('settings.enterprise.debug.invalidToken')

      const payload = JSON.parse(atob(parts[1]))
      if (!payload.exp) return t('settings.enterprise.debug.noExpiry')

      const expDate = new Date(payload.exp * 1000)
      const now = new Date()

      if (expDate < now) {
        return t('settings.enterprise.debug.expired')
      }

      const diffMs = expDate.getTime() - now.getTime()
      const diffMins = Math.floor(diffMs / 60000)

      if (diffMins < 60) {
        return t('settings.enterprise.debug.expiresInMinutes', { minutes: diffMins })
      }

      const diffHours = Math.floor(diffMins / 60)
      return t('settings.enterprise.debug.expiresInHours', { hours: diffHours })
    } catch {
      return t('settings.enterprise.debug.parseError')
    }
  }

  return (
    <Container>
      <Header>
        <Title>{t('settings.enterprise.debug.title')}</Title>
        <CloseButton onClick={onClose}>&times;</CloseButton>
      </Header>

      <Content>
        <Section>
          <SectionTitle>{t('settings.enterprise.debug.status')}</SectionTitle>
          <StatusGrid>
            <StatusItem>
              <StatusLabel>{t('settings.enterprise.debug.enterpriseMode')}</StatusLabel>
              <StatusValue $success={isEnterpriseMode}>
                {isEnterpriseMode ? t('common.on') : t('common.off')}
              </StatusValue>
            </StatusItem>
            <StatusItem>
              <StatusLabel>{t('settings.enterprise.debug.authenticated')}</StatusLabel>
              <StatusValue $success={isAuthenticated}>{isAuthenticated ? t('common.yes') : t('common.no')}</StatusValue>
            </StatusItem>
            <StatusItem>
              <StatusLabel>{t('settings.enterprise.debug.server')}</StatusLabel>
              <StatusValue>{enterpriseServer || '-'}</StatusValue>
            </StatusItem>
          </StatusGrid>
        </Section>

        <Section>
          <SectionTitle>{t('settings.enterprise.debug.tokens')}</SectionTitle>
          <TokenInfo>
            <TokenRow>
              <TokenLabel>Access Token</TokenLabel>
              <TokenValue>{getTokenExpiry(accessToken)}</TokenValue>
            </TokenRow>
            <TokenRow>
              <TokenLabel>Refresh Token</TokenLabel>
              <TokenValue>{getTokenExpiry(refreshToken)}</TokenValue>
            </TokenRow>
          </TokenInfo>
        </Section>

        <Section>
          <SectionHeader>
            <SectionTitle>{t('settings.enterprise.debug.apiLogs')}</SectionTitle>
            <HeaderActions>
              <AutoRefreshToggle>
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                {t('settings.enterprise.debug.autoRefresh')}
              </AutoRefreshToggle>
              <SmallButton onClick={handleClearLogs}>{t('settings.enterprise.debug.clearLogs')}</SmallButton>
            </HeaderActions>
          </SectionHeader>
          <LogList>
            {logs.length === 0 ? (
              <EmptyMessage>{t('settings.enterprise.debug.noLogs')}</EmptyMessage>
            ) : (
              logs.map((log, index) => (
                <LogEntry key={index} $success={log.success}>
                  <LogTime>{formatTime(log.timestamp)}</LogTime>
                  <LogMethod>{log.method}</LogMethod>
                  <LogEndpoint>{log.endpoint}</LogEndpoint>
                  {log.statusCode && <LogStatus $success={log.success}>{log.statusCode}</LogStatus>}
                  {log.duration !== undefined && <LogDuration>{log.duration}ms</LogDuration>}
                  {log.error && <LogError>{log.error}</LogError>}
                </LogEntry>
              ))
            )}
          </LogList>
        </Section>

        <Section>
          <SectionTitle>{t('settings.enterprise.debug.actions')}</SectionTitle>
          <ButtonGroup>
            <ActionButton onClick={refreshLogs}>{t('settings.enterprise.debug.refreshLogs')}</ActionButton>
            <ActionButton $danger onClick={handleClearAuth}>
              {t('settings.enterprise.debug.clearAuth')}
            </ActionButton>
          </ButtonGroup>
        </Section>
      </Content>
    </Container>
  )
}

const Container = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  max-height: 80vh;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  display: flex;
  flex-direction: column;
`

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
`

const Title = styled.h2`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
`

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: 0;
  line-height: 1;

  &:hover {
    color: var(--color-text);
  }
`

const Content = styled.div`
  padding: 20px;
  overflow-y: auto;
  flex: 1;
`

const Section = styled.div`
  margin-bottom: 24px;

  &:last-child {
    margin-bottom: 0;
  }
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`

const SectionTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: 0.5px;
`

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
`

const StatusItem = styled.div`
  background: var(--color-background-soft);
  padding: 12px;
  border-radius: 8px;
`

const StatusLabel = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
`

const StatusValue = styled.div<{ $success?: boolean }>`
  font-size: 14px;
  font-weight: 500;
  color: ${(props) => (props.$success ? '#52c41a' : 'var(--color-text)')};
  word-break: break-all;
`

const TokenInfo = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 12px;
`

const TokenRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`

const TokenLabel = styled.span`
  color: var(--color-text-secondary);
  font-size: 14px;
`

const TokenValue = styled.span`
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
`

const AutoRefreshToggle = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
`

const SmallButton = styled.button`
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  background: var(--color-background);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);

  &:hover {
    background: var(--color-background-soft);
  }
`

const LogList = styled.div`
  max-height: 200px;
  overflow-y: auto;
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 8px;
`

const EmptyMessage = styled.div`
  text-align: center;
  padding: 20px;
  color: var(--color-text-secondary);
  font-size: 14px;
`

const LogEntry = styled.div<{ $success: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  font-size: 12px;
  font-family: monospace;
  border-left: 3px solid ${(props) => (props.$success ? '#52c41a' : '#ff4d4f')};
  margin-bottom: 4px;
  background: var(--color-background);
  border-radius: 4px;

  &:last-child {
    margin-bottom: 0;
  }
`

const LogTime = styled.span`
  color: var(--color-text-secondary);
  flex-shrink: 0;
`

const LogMethod = styled.span`
  font-weight: 600;
  color: var(--color-primary);
  flex-shrink: 0;
  width: 50px;
`

const LogEndpoint = styled.span`
  color: var(--color-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const LogStatus = styled.span<{ $success: boolean }>`
  color: ${(props) => (props.$success ? '#52c41a' : '#ff4d4f')};
  flex-shrink: 0;
`

const LogDuration = styled.span`
  color: var(--color-text-secondary);
  flex-shrink: 0;
`

const LogError = styled.span`
  color: #ff4d4f;
  font-size: 11px;
  flex-shrink: 0;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 12px;
`

const ActionButton = styled.button<{ $danger?: boolean }>`
  padding: 10px 16px;
  border-radius: 6px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  ${(props) =>
    props.$danger
      ? `
    background: #ff4d4f;
    color: white;
    &:hover { background: #ff7875; }
  `
      : `
    background: var(--color-primary);
    color: white;
    &:hover { opacity: 0.9; }
  `}
`
