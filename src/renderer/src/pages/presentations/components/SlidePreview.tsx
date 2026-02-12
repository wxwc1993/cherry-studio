import { CheckCircleFilled, FileImageOutlined } from '@ant-design/icons'
import type { PresentationPage } from '@cherry-studio/enterprise-shared'
import { presentationApi } from '@renderer/services/PresentationApi'
import { Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface SlidePreviewProps {
  pages: PresentationPage[]
  selectedPageId?: string | null
  onSelectPage: (pageId: string) => void
}

const SlidePreview: FC<SlidePreviewProps> = ({ pages, selectedPageId, onSelectPage }) => {
  const { t } = useTranslation()

  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.orderIndex - b.orderIndex), [pages])

  const getImageUrl = useCallback((storageKey: string): string => {
    return presentationApi.getImageUrl(storageKey)
  }, [])

  return (
    <Container>
      <Header>{t('presentations.preview.title')}</Header>
      <SlideList>
        {sortedPages.map((page, index) => {
          const isSelected = selectedPageId === page.id
          const hasImage = !!page.generatedImageKey
          const hasDescription = !!page.descriptionContent?.text

          return (
            <SlideItem key={page.id} $selected={isSelected} onClick={() => onSelectPage(page.id)}>
              <SlideNumber>{index + 1}</SlideNumber>
              <SlideThumb>
                {hasImage ? (
                  <ThumbImage src={getImageUrl(page.generatedImageKey!)} alt={page.outlineContent.title} />
                ) : (
                  <ThumbPlaceholder>
                    <FileImageOutlined style={{ fontSize: 20, color: 'var(--color-text-3)' }} />
                  </ThumbPlaceholder>
                )}
                {hasDescription && (
                  <Tooltip title={t('presentations.preview.has_description')}>
                    <DescriptionBadge>
                      <CheckCircleFilled />
                    </DescriptionBadge>
                  </Tooltip>
                )}
              </SlideThumb>
              <SlideTitle $selected={isSelected}>{page.outlineContent.title}</SlideTitle>
            </SlideItem>
          )
        })}
      </SlideList>
    </Container>
  )
}

// ============ Styled Components ============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 180px;
  min-width: 180px;
  border-right: 0.5px solid var(--color-border);
`

const Header = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-2);
  padding: 8px 12px;
  flex-shrink: 0;
  user-select: none;
`

const SlideList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const SlideItem = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background-color: ${({ $selected }) => ($selected ? 'var(--color-primary-bg)' : 'transparent')};
  border: 1px solid ${({ $selected }) => ($selected ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background-color: ${({ $selected }) => ($selected ? 'var(--color-primary-bg)' : 'var(--color-background-soft)')};
  }
`

const SlideNumber = styled.span`
  font-size: 10px;
  color: var(--color-text-3);
  width: 16px;
  text-align: center;
  flex-shrink: 0;
  user-select: none;
`

const SlideThumb = styled.div`
  position: relative;
  width: 64px;
  height: 36px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  border: 0.5px solid var(--color-border);
  background-color: var(--color-background-soft);
`

const ThumbImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`

const ThumbPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

const DescriptionBadge = styled.span`
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  color: var(--color-success);
  line-height: 1;
`

const SlideTitle = styled.div<{ $selected?: boolean }>`
  flex: 1;
  font-size: 11px;
  color: ${({ $selected }) => ($selected ? 'var(--color-text-1)' : 'var(--color-text-2)')};
  font-weight: ${({ $selected }) => ($selected ? 500 : 400)};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
`

export default SlidePreview
