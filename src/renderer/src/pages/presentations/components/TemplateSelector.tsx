import type { PresentationTemplate } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { presentationApi } from '@renderer/services/PresentationApi'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { fetchTemplates, selectPresentationLoading, selectTemplates } from '@renderer/store/presentations'
import { Card, Empty, Spin } from 'antd'
import type { FC } from 'react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('TemplateSelector')

interface TemplateSelectorProps {
  selectedId?: string
  onSelect: (template: PresentationTemplate) => void
}

const TemplateSelector: FC<TemplateSelectorProps> = ({ selectedId, onSelect }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const templates = useAppSelector(selectTemplates)
  const loading = useAppSelector(selectPresentationLoading)

  useEffect(() => {
    if (templates.length === 0) {
      dispatch(fetchTemplates())
        .unwrap()
        .catch((error) => {
          logger.error('Failed to fetch templates', { error: String(error) })
        })
    }
  }, [dispatch, templates.length])

  const sortedTemplates = useMemo(() => {
    return [...templates].sort((a, b) => {
      if (a.isPublic !== b.isPublic) return a.isPublic ? -1 : 1
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [templates])

  const getPreviewUrl = (template: PresentationTemplate): string | null => {
    if (!template.previewImageKey) return null
    return `${presentationApi.getImageUrl(template.previewImageKey)}`
  }

  if (loading.templates) {
    return (
      <LoadingContainer>
        <Spin tip={t('presentations.template.loading')} />
      </LoadingContainer>
    )
  }

  if (sortedTemplates.length === 0) {
    return <Empty description={t('presentations.template.empty')} />
  }

  return (
    <Grid>
      {sortedTemplates.map((template) => {
        const previewUrl = getPreviewUrl(template)
        const isSelected = selectedId === template.id
        return (
          <TemplateCard
            key={template.id}
            $selected={isSelected}
            hoverable
            onClick={() => onSelect(template)}
            cover={
              previewUrl ? (
                <PreviewImage src={previewUrl} alt={template.name} />
              ) : (
                <PlaceholderCover>
                  <span className="text-2xl">📊</span>
                </PlaceholderCover>
              )
            }>
            <Card.Meta
              title={template.name}
              description={template.description || t('presentations.template.no_desc')}
            />
          </TemplateCard>
        )
      })}
    </Grid>
  )
}

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`

const TemplateCard = styled(Card)<{ $selected?: boolean }>`
  cursor: pointer;
  border: 2px solid ${({ $selected }) => ($selected ? 'var(--color-primary)' : 'transparent')};
  transition: border-color 0.2s;

  .ant-card-body {
    padding: 8px 12px;
  }

  .ant-card-meta-title {
    font-size: 13px;
  }

  .ant-card-meta-description {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`

const PreviewImage = styled.img`
  width: 100%;
  height: 120px;
  object-fit: cover;
`

const PlaceholderCover = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 120px;
  background-color: var(--color-background-soft);
`

export default TemplateSelector
