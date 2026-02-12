import { EditOutlined, PictureOutlined, ReloadOutlined, ScissorOutlined } from '@ant-design/icons'
import type { DescriptionContent, OutlineContent, PresentationPage } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { presentationApi } from '@renderer/services/PresentationApi'
import { useAppDispatch } from '@renderer/store'
import { editImage, generateSingleImage, updatePage, updatePageLocally } from '@renderer/store/presentations'
import { Button, Empty, Input, Modal, Select, Tabs, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('PageEditor')

const LAYOUT_OPTIONS = [
  { value: 'title-only', labelKey: 'presentations.description.layout.title_only' },
  { value: 'title-content', labelKey: 'presentations.description.layout.title_content' },
  { value: 'title-image', labelKey: 'presentations.description.layout.title_image' },
  { value: 'image-full', labelKey: 'presentations.description.layout.image_full' },
  { value: 'two-column', labelKey: 'presentations.description.layout.two_column' },
  { value: 'comparison', labelKey: 'presentations.description.layout.comparison' }
]

interface PageEditorProps {
  presentationId: string
  page: PresentationPage | null
  disabled?: boolean
}

const PageEditor: FC<PageEditorProps> = ({ presentationId, page, disabled = false }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [editImageModalOpen, setEditImageModalOpen] = useState(false)
  const [editInstruction, setEditInstruction] = useState('')
  const [editImageLoading, setEditImageLoading] = useState(false)
  const [generateLoading, setGenerateLoading] = useState(false)

  const imageUrl = useMemo(() => {
    if (!page?.generatedImageKey) return null
    return presentationApi.getImageUrl(page.generatedImageKey)
  }, [page?.generatedImageKey])

  // ---- 大纲编辑 ----

  const handleTitleChange = useCallback(
    (title: string) => {
      if (!page) return
      const updatedOutline: OutlineContent = { ...page.outlineContent, title }
      dispatch(updatePageLocally({ pageId: page.id, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, page]
  )

  const handleTitleBlur = useCallback(() => {
    if (!page) return
    dispatch(
      updatePage({
        id: presentationId,
        pageId: page.id,
        input: { outlineContent: page.outlineContent }
      })
    ).catch((error) => {
      logger.error('Failed to update page title', { pageId: page.id, error: String(error) })
    })
  }, [dispatch, page, presentationId])

  const handleBulletChange = useCallback(
    (index: number, value: string) => {
      if (!page) return
      const bullets = [...(page.outlineContent.bulletPoints || [])]
      bullets[index] = value
      const updatedOutline: OutlineContent = { ...page.outlineContent, bulletPoints: bullets }
      dispatch(updatePageLocally({ pageId: page.id, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, page]
  )

  const handleBulletBlur = useCallback(() => {
    if (!page) return
    dispatch(
      updatePage({
        id: presentationId,
        pageId: page.id,
        input: { outlineContent: page.outlineContent }
      })
    ).catch((error) => {
      logger.error('Failed to update page bullets', { pageId: page.id, error: String(error) })
    })
  }, [dispatch, page, presentationId])

  const handleNotesChange = useCallback(
    (notes: string) => {
      if (!page) return
      const updatedOutline: OutlineContent = { ...page.outlineContent, notes }
      dispatch(updatePageLocally({ pageId: page.id, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, page]
  )

  const handleNotesBlur = useCallback(() => {
    if (!page) return
    dispatch(
      updatePage({
        id: presentationId,
        pageId: page.id,
        input: { outlineContent: page.outlineContent }
      })
    ).catch((error) => {
      logger.error('Failed to update page notes', { pageId: page.id, error: String(error) })
    })
  }, [dispatch, page, presentationId])

  // ---- 描述编辑 ----

  const handleDescriptionTextChange = useCallback(
    (text: string) => {
      if (!page) return
      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text
      }
      dispatch(updatePageLocally({ pageId: page.id, changes: { descriptionContent: updatedDescription } }))
    },
    [dispatch, page]
  )

  const handleDescriptionTextBlur = useCallback(() => {
    if (!page) return
    dispatch(
      updatePage({
        id: presentationId,
        pageId: page.id,
        input: { descriptionContent: page.descriptionContent }
      })
    ).catch((error) => {
      logger.error('Failed to update page description', { pageId: page.id, error: String(error) })
    })
  }, [dispatch, page, presentationId])

  const handleImagePromptChange = useCallback(
    (imagePrompt: string) => {
      if (!page) return
      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text: page.descriptionContent?.text || '',
        imagePrompt
      }
      dispatch(updatePageLocally({ pageId: page.id, changes: { descriptionContent: updatedDescription } }))
    },
    [dispatch, page]
  )

  const handleImagePromptBlur = useCallback(() => {
    if (!page) return
    dispatch(
      updatePage({
        id: presentationId,
        pageId: page.id,
        input: { descriptionContent: page.descriptionContent }
      })
    ).catch((error) => {
      logger.error('Failed to update image prompt', { pageId: page.id, error: String(error) })
    })
  }, [dispatch, page, presentationId])

  const handleLayoutChange = useCallback(
    (layout: string) => {
      if (!page) return
      const updatedDescription: DescriptionContent = {
        ...page.descriptionContent,
        text: page.descriptionContent?.text || '',
        layout
      }
      dispatch(updatePageLocally({ pageId: page.id, changes: { descriptionContent: updatedDescription } }))
      dispatch(
        updatePage({
          id: presentationId,
          pageId: page.id,
          input: { descriptionContent: { ...updatedDescription } }
        })
      ).catch((error) => {
        logger.error('Failed to update layout', { pageId: page.id, error: String(error) })
      })
    },
    [dispatch, page, presentationId]
  )

  // ---- 图像操作 ----

  const handleRegenerateImage = useCallback(async () => {
    if (!page) return
    setGenerateLoading(true)
    try {
      await dispatch(generateSingleImage({ id: presentationId, pageId: page.id })).unwrap()
      logger.info('Single image generation started', { pageId: page.id })
    } catch (error) {
      logger.error('Failed to generate single image', { pageId: page.id, error: String(error) })
    } finally {
      setGenerateLoading(false)
    }
  }, [dispatch, page, presentationId])

  const handleEditImage = useCallback(async () => {
    if (!page || !editInstruction.trim()) return
    setEditImageLoading(true)
    try {
      await dispatch(
        editImage({
          id: presentationId,
          pageId: page.id,
          input: { instruction: editInstruction.trim() }
        })
      ).unwrap()
      logger.info('Image edit task started', { pageId: page.id })
      setEditImageModalOpen(false)
      setEditInstruction('')
    } catch (error) {
      logger.error('Failed to edit image', { pageId: page.id, error: String(error) })
    } finally {
      setEditImageLoading(false)
    }
  }, [dispatch, editInstruction, page, presentationId])

  // ---- 空状态 ----

  if (!page) {
    return (
      <EmptyContainer>
        <Empty description={t('presentations.editor.select_page')} />
      </EmptyContainer>
    )
  }

  const tabItems = [
    {
      key: 'outline',
      label: t('presentations.editor.tab_outline'),
      children: (
        <TabContent>
          <FieldGroup>
            <FieldLabel>{t('presentations.outline.title_placeholder')}</FieldLabel>
            <Input
              value={page.outlineContent.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder={t('presentations.outline.title_placeholder')}
              disabled={disabled}
              size="small"
            />
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>{t('presentations.outline.bullets')}</FieldLabel>
            {(page.outlineContent.bulletPoints || []).map((bullet, idx) => (
              <Input
                key={idx}
                value={bullet}
                onChange={(e) => handleBulletChange(idx, e.target.value)}
                onBlur={handleBulletBlur}
                placeholder={t('presentations.outline.bullet_placeholder')}
                disabled={disabled}
                size="small"
                style={{ marginBottom: 4 }}
              />
            ))}
          </FieldGroup>

          <FieldGroup>
            <FieldLabel>{t('presentations.outline.notes')}</FieldLabel>
            <Input.TextArea
              value={page.outlineContent.notes || ''}
              onChange={(e) => handleNotesChange(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder={t('presentations.outline.notes_placeholder')}
              disabled={disabled}
              rows={3}
              size="small"
            />
          </FieldGroup>
        </TabContent>
      )
    },
    {
      key: 'description',
      label: t('presentations.editor.tab_description'),
      children: (
        <TabContent>
          <FieldGroup>
            <FieldLabel>{t('presentations.description.text_label')}</FieldLabel>
            <Input.TextArea
              value={page.descriptionContent?.text || ''}
              onChange={(e) => handleDescriptionTextChange(e.target.value)}
              onBlur={handleDescriptionTextBlur}
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
              value={page.descriptionContent?.imagePrompt || ''}
              onChange={(e) => handleImagePromptChange(e.target.value)}
              onBlur={handleImagePromptBlur}
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
              value={page.descriptionContent?.layout || undefined}
              onChange={handleLayoutChange}
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
        </TabContent>
      )
    },
    {
      key: 'image',
      label: t('presentations.editor.tab_image'),
      children: (
        <TabContent>
          {imageUrl ? (
            <ImagePreviewSection>
              <ImagePreview src={imageUrl} alt={page.outlineContent.title} />
              <ImageActions>
                <Tooltip title={t('presentations.editor.regenerate_image')}>
                  <Button
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={handleRegenerateImage}
                    loading={generateLoading}
                    disabled={disabled}>
                    {t('presentations.editor.regenerate_image')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('presentations.editor.edit_image')}>
                  <Button
                    icon={<ScissorOutlined />}
                    size="small"
                    onClick={() => setEditImageModalOpen(true)}
                    disabled={disabled || !imageUrl}>
                    {t('presentations.editor.edit_image')}
                  </Button>
                </Tooltip>
              </ImageActions>
            </ImagePreviewSection>
          ) : (
            <NoImageContainer>
              <Empty
                image={<PictureOutlined style={{ fontSize: 48, color: 'var(--color-text-3)' }} />}
                description={t('presentations.editor.no_image')}>
                <Button
                  type="primary"
                  size="small"
                  icon={<PictureOutlined />}
                  onClick={handleRegenerateImage}
                  loading={generateLoading}
                  disabled={disabled}>
                  {t('presentations.editor.generate_image')}
                </Button>
              </Empty>
            </NoImageContainer>
          )}
        </TabContent>
      )
    }
  ]

  return (
    <Container>
      <PageHeader>
        <PageIndex>
          {t('presentations.editor.page_label')} {page.orderIndex + 1}
        </PageIndex>
        <PageTitleText>{page.outlineContent.title}</PageTitleText>
      </PageHeader>

      <StyledTabs items={tabItems} size="small" />

      <Modal
        title={t('presentations.editor.edit_image_modal_title')}
        open={editImageModalOpen}
        onOk={handleEditImage}
        onCancel={() => {
          setEditImageModalOpen(false)
          setEditInstruction('')
        }}
        confirmLoading={editImageLoading}
        okButtonProps={{ disabled: !editInstruction.trim() }}>
        {imageUrl && <ModalImagePreview src={imageUrl} alt="Current" />}
        <EditHint>
          <EditOutlined style={{ marginRight: 4 }} />
          {t('presentations.editor.edit_image_hint')}
        </EditHint>
        <Input.TextArea
          value={editInstruction}
          onChange={(e) => setEditInstruction(e.target.value)}
          placeholder={t('presentations.editor.edit_image_placeholder')}
          rows={3}
          maxLength={2000}
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
  overflow: hidden;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`

const PageHeader = styled.div`
  padding: 8px 16px;
  border-bottom: 0.5px solid var(--color-border);
  flex-shrink: 0;
`

const PageIndex = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 2px;
  user-select: none;
`

const PageTitleText = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const StyledTabs = styled(Tabs)`
  flex: 1;
  overflow: hidden;

  .ant-tabs-nav {
    margin: 0;
    padding: 0 16px;
  }

  .ant-tabs-content-holder {
    overflow-y: auto;
  }

  .ant-tabs-content {
    height: 100%;
  }

  .ant-tabs-tabpane {
    padding: 0;
  }
`

const TabContent = styled.div`
  padding: 12px 16px;
`

const FieldGroup = styled.div`
  margin-bottom: 12px;
`

const FieldLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 4px;
  user-select: none;
`

const ImagePreviewSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ImagePreview = styled.img`
  width: 100%;
  border-radius: 6px;
  border: 0.5px solid var(--color-border);
`

const ImageActions = styled.div`
  display: flex;
  gap: 8px;
`

const NoImageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
`

const ModalImagePreview = styled.img`
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 6px;
  border: 0.5px solid var(--color-border);
  margin-bottom: 12px;
`

const EditHint = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  margin-bottom: 8px;
`

export default PageEditor
