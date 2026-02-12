import { EditOutlined, PictureOutlined, RobotOutlined } from '@ant-design/icons'
import type { DescriptionContent, PresentationPage } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { useAppDispatch } from '@renderer/store'
import { generateDescriptions, refineDescriptions, updatePage, updatePageLocally } from '@renderer/store/presentations'
import { Button, Empty, Input, Modal, Select, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('DescriptionEditor')

const LAYOUT_OPTIONS = [
  { value: 'title-only', labelKey: 'presentations.description.layout.title_only' },
  { value: 'title-content', labelKey: 'presentations.description.layout.title_content' },
  { value: 'title-image', labelKey: 'presentations.description.layout.title_image' },
  { value: 'image-full', labelKey: 'presentations.description.layout.image_full' },
  { value: 'two-column', labelKey: 'presentations.description.layout.two_column' },
  { value: 'comparison', labelKey: 'presentations.description.layout.comparison' }
]

interface DescriptionEditorProps {
  presentationId: string
  pages: PresentationPage[]
  disabled?: boolean
}

const DescriptionEditor: FC<DescriptionEditorProps> = ({ presentationId, pages, disabled = false }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [expandedPageId, setExpandedPageId] = useState<string | null>(null)
  const [generateLoading, setGenerateLoading] = useState(false)
  const [refineModalOpen, setRefineModalOpen] = useState(false)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)

  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.orderIndex - b.orderIndex), [pages])

  const hasDescriptions = useMemo(() => sortedPages.some((p) => p.descriptionContent?.text), [sortedPages])

  // ---- 编辑描述 ----

  const handleTextChange = useCallback(
    (pageId: string, text: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text
      }
      dispatch(updatePageLocally({ pageId, changes: { descriptionContent: updatedDescription } }))
    },
    [dispatch, pages]
  )

  const handleTextBlur = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { descriptionContent: page.descriptionContent }
        })
      ).catch((error) => {
        logger.error('Failed to update page description text', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  const handleImagePromptChange = useCallback(
    (pageId: string, imagePrompt: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text: page.descriptionContent?.text || '',
        imagePrompt
      }
      dispatch(updatePageLocally({ pageId, changes: { descriptionContent: updatedDescription } }))
    },
    [dispatch, pages]
  )

  const handleImagePromptBlur = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { descriptionContent: page.descriptionContent }
        })
      ).catch((error) => {
        logger.error('Failed to update page image prompt', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  const handleLayoutChange = useCallback(
    (pageId: string, layout: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text: page.descriptionContent?.text || '',
        layout
      }
      dispatch(updatePageLocally({ pageId, changes: { descriptionContent: updatedDescription } }))
      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { descriptionContent: { ...updatedDescription } }
        })
      ).catch((error) => {
        logger.error('Failed to update page layout', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  // ---- AI 生成 ----

  const handleGenerateAll = useCallback(async () => {
    setGenerateLoading(true)
    try {
      await dispatch(generateDescriptions({ id: presentationId })).unwrap()
      logger.info('Description generation task started', { presentationId })
    } catch (error) {
      logger.error('Failed to generate descriptions', { error: String(error) })
    } finally {
      setGenerateLoading(false)
    }
  }, [dispatch, presentationId])

  const handleRefine = useCallback(async () => {
    if (!refineInstruction.trim()) return

    setRefineLoading(true)
    try {
      await dispatch(
        refineDescriptions({
          id: presentationId,
          input: { instruction: refineInstruction.trim() }
        })
      ).unwrap()

      logger.info('Description refine task started', { presentationId })
      setRefineModalOpen(false)
      setRefineInstruction('')
    } catch (error) {
      logger.error('Failed to refine descriptions', { error: String(error) })
    } finally {
      setRefineLoading(false)
    }
  }, [dispatch, presentationId, refineInstruction])

  // ---- 渲染 ----

  const toggleExpand = useCallback((pageId: string) => {
    setExpandedPageId((prev) => (prev === pageId ? null : pageId))
  }, [])

  return (
    <Container>
      <Header>
        <HeaderTitle>
          {t('presentations.description.title')}
          <PageCount>
            {sortedPages.filter((p) => p.descriptionContent?.text).length}/{sortedPages.length}{' '}
            {t('presentations.description.completed')}
          </PageCount>
        </HeaderTitle>
        <HeaderActions>
          <Tooltip title={t('presentations.description.refine_tooltip')}>
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => setRefineModalOpen(true)}
              disabled={disabled || !hasDescriptions}>
              {t('presentations.description.ai_refine')}
            </Button>
          </Tooltip>
          <Button
            type="primary"
            icon={<RobotOutlined />}
            size="small"
            onClick={handleGenerateAll}
            loading={generateLoading}
            disabled={disabled || sortedPages.length === 0}>
            {t('presentations.description.generate_all')}
          </Button>
        </HeaderActions>
      </Header>

      {sortedPages.length === 0 ? (
        <EmptyContainer>
          <Empty description={t('presentations.description.no_pages')} />
        </EmptyContainer>
      ) : (
        <PageList>
          {sortedPages.map((page, index) => {
            const isExpanded = expandedPageId === page.id
            const description = page.descriptionContent
            const hasContent = !!description?.text

            return (
              <DescriptionCard key={page.id} $expanded={isExpanded} onClick={() => toggleExpand(page.id)}>
                <CardHeader>
                  <PageNumber>{index + 1}</PageNumber>
                  <PageTitle>{page.outlineContent.title}</PageTitle>
                  <StatusGroup>
                    {hasContent && (
                      <Tag color="green" style={{ fontSize: 11 }}>
                        {t('presentations.description.has_description')}
                      </Tag>
                    )}
                    {description?.imagePrompt && (
                      <Tag color="blue" style={{ fontSize: 11 }}>
                        <PictureOutlined /> {t('presentations.description.has_prompt')}
                      </Tag>
                    )}
                    {description?.layout && <Tag style={{ fontSize: 11 }}>{description.layout}</Tag>}
                  </StatusGroup>
                </CardHeader>

                {!isExpanded && hasContent && (
                  <CollapsedPreview>
                    {description!.text.length > 100 ? `${description!.text.substring(0, 100)}...` : description!.text}
                  </CollapsedPreview>
                )}

                {isExpanded && (
                  <CardBody onClick={(e) => e.stopPropagation()}>
                    <FieldGroup>
                      <FieldLabel>{t('presentations.description.text_label')}</FieldLabel>
                      <Input.TextArea
                        value={description?.text || ''}
                        onChange={(e) => handleTextChange(page.id, e.target.value)}
                        onBlur={() => handleTextBlur(page.id)}
                        placeholder={t('presentations.description.text_placeholder')}
                        disabled={disabled}
                        rows={4}
                        size="small"
                        maxLength={5000}
                        showCount
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <FieldLabel>
                        <PictureOutlined style={{ marginRight: 4 }} />
                        {t('presentations.description.image_prompt_label')}
                      </FieldLabel>
                      <Input.TextArea
                        value={description?.imagePrompt || ''}
                        onChange={(e) => handleImagePromptChange(page.id, e.target.value)}
                        onBlur={() => handleImagePromptBlur(page.id)}
                        placeholder={t('presentations.description.image_prompt_placeholder')}
                        disabled={disabled}
                        rows={2}
                        size="small"
                        maxLength={2000}
                      />
                    </FieldGroup>

                    <FieldGroup>
                      <FieldLabel>{t('presentations.description.layout_label')}</FieldLabel>
                      <Select
                        value={description?.layout || undefined}
                        onChange={(value) => handleLayoutChange(page.id, value)}
                        placeholder={t('presentations.description.layout_placeholder')}
                        disabled={disabled}
                        size="small"
                        allowClear
                        style={{ width: '100%' }}
                        options={LAYOUT_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: t(opt.labelKey)
                        }))}
                      />
                    </FieldGroup>
                  </CardBody>
                )}
              </DescriptionCard>
            )
          })}
        </PageList>
      )}

      <Modal
        title={t('presentations.description.refine_modal_title')}
        open={refineModalOpen}
        onOk={handleRefine}
        onCancel={() => {
          setRefineModalOpen(false)
          setRefineInstruction('')
        }}
        confirmLoading={refineLoading}
        okButtonProps={{ disabled: !refineInstruction.trim() }}>
        <RefineHint>{t('presentations.description.refine_hint')}</RefineHint>
        <Input.TextArea
          value={refineInstruction}
          onChange={(e) => setRefineInstruction(e.target.value)}
          placeholder={t('presentations.description.refine_placeholder')}
          rows={4}
          maxLength={5000}
          showCount
        />
      </Modal>
    </Container>
  )
}

// ============ Styled Components ============

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  margin-bottom: 8px;
  flex-shrink: 0;
`

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  user-select: none;
`

const PageCount = styled.span`
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-3);
`

const HeaderActions = styled.div`
  display: flex;
  gap: 8px;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 200px;
`

const PageList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const DescriptionCard = styled.div<{ $expanded?: boolean }>`
  border: 1px solid ${({ $expanded }) => ($expanded ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  background-color: ${({ $expanded }) => ($expanded ? 'var(--color-primary-bg)' : 'var(--color-background)')};
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const PageNumber = styled.span`
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background-color: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
`

const PageTitle = styled.span`
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StatusGroup = styled.div`
  display: flex;
  gap: 4px;
  flex-shrink: 0;
`

const CollapsedPreview = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  padding-left: 28px;
  line-height: 1.5;
`

const CardBody = styled.div`
  padding: 12px 0 4px 28px;
`

const FieldGroup = styled.div`
  margin-bottom: 10px;
`

const FieldLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 4px;
  user-select: none;
`

const RefineHint = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  margin-bottom: 12px;
`

export default DescriptionEditor
