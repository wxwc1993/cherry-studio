import EnterpriseDebugPanel from '@renderer/components/Debug/EnterpriseDebugPanel'
import Scrollbar from '@renderer/components/Scrollbar'
import { enterpriseApi } from '@renderer/services/EnterpriseApi'
import { useAuth, useEnterpriseMode, usePermission } from '@renderer/store/enterprise'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

interface UsageStats {
  todayMessages: number
  todayConversations: number
  todayTokens: number
  monthMessages: number
  monthConversations: number
  monthTokens: number
}

export default function EnterprisePanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated, user, logout } = useAuth()
  const { isEnterpriseMode, enterpriseServer } = useEnterpriseMode()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [showDebugPanel, setShowDebugPanel] = useState(false)

  const canViewStats = usePermission('statistics', 'read')

  useEffect(() => {
    if (isAuthenticated && canViewStats) {
      loadStats()
    }
  }, [isAuthenticated, canViewStats])

  const loadStats = useCallback(async () => {
    try {
      const response = await enterpriseApi.getUsageStats()
      const data = response.data as {
        usage?: {
          today?: { messages?: number; conversations?: number; tokens?: number }
          month?: { messages?: number; conversations?: number; tokens?: number }
        }
      }
      setStats({
        todayMessages: data.usage?.today?.messages || 0,
        todayConversations: data.usage?.today?.conversations || 0,
        todayTokens: data.usage?.today?.tokens || 0,
        monthMessages: data.usage?.month?.messages || 0,
        monthConversations: data.usage?.month?.conversations || 0,
        monthTokens: data.usage?.month?.tokens || 0
      })
    } catch {
      // 忽略错误
    }
  }, [])

  const handleLogout = useCallback(async () => {
    try {
      await enterpriseApi.logout()
    } catch {
      // 忽略错误
    }
    logout()
  }, [logout])

  const handleGoToLogin = useCallback(() => {
    navigate('/login/enterprise')
  }, [navigate])

  if (!isEnterpriseMode) {
    return (
      <Container>
        <ContentScrollbar>
          <ContentWrapper>
            <Section>
              <SectionTitle>{t('settings.enterprise.title')}</SectionTitle>
              <Card>
                <p>{t('settings.enterprise.personalMode')}</p>
                <p style={{ marginTop: 8, color: 'var(--color-text-secondary)' }}>
                  {t('settings.enterprise.personalModeHint')}
                </p>
              </Card>
              <Button onClick={handleGoToLogin}>{t('settings.enterprise.goToLogin')}</Button>
            </Section>
          </ContentWrapper>
        </ContentScrollbar>
      </Container>
    )
  }

  return (
    <Container>
      <ContentScrollbar>
        <ContentWrapper>
          <Section>
            <SectionTitle>{t('settings.enterprise.connectionStatus')}</SectionTitle>
            <Card>
              <Row>
                <Label>{t('settings.enterprise.server')}</Label>
                <Value>{enterpriseServer}</Value>
              </Row>
              <Row>
                <Label>{t('settings.enterprise.status.label')}</Label>
                <Badge type={isAuthenticated ? 'success' : 'error'}>
                  {isAuthenticated
                    ? t('settings.enterprise.status.connected')
                    : t('settings.enterprise.status.disconnected')}
                </Badge>
              </Row>
            </Card>
          </Section>

          {isAuthenticated && user && (
            <>
              <Section>
                <SectionTitle>{t('settings.enterprise.accountInfo')}</SectionTitle>
                <Card>
                  <Row>
                    <Label>{t('settings.enterprise.username')}</Label>
                    <Value>{user.name}</Value>
                  </Row>
                  <Row>
                    <Label>{t('settings.enterprise.email')}</Label>
                    <Value>{user.email}</Value>
                  </Row>
                  <Row>
                    <Label>{t('settings.enterprise.department')}</Label>
                    <Value>{user.department.name}</Value>
                  </Row>
                  <Row>
                    <Label>{t('settings.enterprise.role')}</Label>
                    <Value>{user.role.name}</Value>
                  </Row>
                </Card>
                <Button $danger onClick={handleLogout}>
                  {t('settings.enterprise.logout')}
                </Button>
              </Section>

              {canViewStats && stats && (
                <Section>
                  <SectionTitle>{t('settings.enterprise.usageStats')}</SectionTitle>
                  <StatGrid>
                    <StatCard>
                      <StatValue>{stats.todayMessages}</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.todayMessages')}</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>{stats.todayConversations}</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.todayConversations')}</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>{(stats.todayTokens / 1000).toFixed(1)}K</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.todayTokens')}</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>{stats.monthMessages}</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.monthMessages')}</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>{stats.monthConversations}</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.monthConversations')}</StatLabel>
                    </StatCard>
                    <StatCard>
                      <StatValue>{(stats.monthTokens / 1000).toFixed(1)}K</StatValue>
                      <StatLabel>{t('settings.enterprise.stats.monthTokens')}</StatLabel>
                    </StatCard>
                  </StatGrid>
                </Section>
              )}
            </>
          )}

          <Section>
            <SectionTitle>{t('settings.enterprise.debug.title')}</SectionTitle>
            <Card>
              <Row>
                <Label>{t('settings.enterprise.debug.showPanel')}</Label>
                <Button onClick={() => setShowDebugPanel(true)}>{t('settings.enterprise.debug.open')}</Button>
              </Row>
            </Card>
          </Section>
        </ContentWrapper>
      </ContentScrollbar>

      {showDebugPanel && <EnterpriseDebugPanel onClose={() => setShowDebugPanel(false)} />}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
`

const ContentScrollbar = styled(Scrollbar)`
  flex: 1;
`

const ContentWrapper = styled.div`
  padding: 20px;
  max-width: 800px;
`

const Section = styled.div`
  margin-bottom: 24px;
`

const SectionTitle = styled.h3`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--color-text);
`

const Card = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
`

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }
`

const Label = styled.span`
  color: var(--color-text-secondary);
`

const Value = styled.span`
  color: var(--color-text);
  font-weight: 500;
`

const Button = styled.button<{ $danger?: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 14px;
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

const Badge = styled.span<{ type: 'success' | 'warning' | 'error' }>`
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  ${(props) => {
    switch (props.type) {
      case 'success':
        return 'background: #f6ffed; color: #52c41a;'
      case 'warning':
        return 'background: #fffbe6; color: #faad14;'
      case 'error':
        return 'background: #fff2f0; color: #ff4d4f;'
    }
  }}
`

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
`

const StatCard = styled.div`
  background: var(--color-background-soft);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
`

const StatValue = styled.div`
  font-size: 24px;
  font-weight: bold;
  color: var(--color-primary);
`

const StatLabel = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
`
