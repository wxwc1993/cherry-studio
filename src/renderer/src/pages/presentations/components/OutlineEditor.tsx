import { DeleteOutlined, HolderOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons'
import type { OutlineContent, PresentationPage } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import Sortable from '@renderer/components/dnd/Sortable'
import { useAppDispatch } from '@renderer/store'
import {
  createPage,
  deletePage,
  refineOutline,
  reorderPages,
  reorderPagesLocally,
  updatePage,
  updatePageLocally
} from '@renderer/store/presentations'
import { Button, Input, Modal, Popconfirm, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('OutlineEditor')

interface OutlineEditorProps {
  presentationId: string
  pages: PresentationPage[]
  disabled?: boolean
}

const OutlineEditor: FC<OutlineEditorProps> = ({ presentationId, pages, disabled = false }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [refineModalOpen, setRefineModalOpen] = useState(false)
  const [refineInstruction, setRefineInstruction] = useState('')
  const [refineLoading, setRefineLoading] = useState(false)

  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.orderIndex - b.orderIndex), [pages])

  // ---- 编辑大纲 ----

  const handleTitleChange = useCallback(
    (pageId: string, title: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const updatedOutline: OutlineContent = { ...page.outlineContent, title }
      dispatch(updatePageLocally({ pageId, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, pages]
  )

  const handleTitleBlur = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { outlineContent: page.outlineContent }
        })
      ).catch((error) => {
        logger.error('Failed to update page title', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  const handleBulletChange = useCallback(
    (pageId: string, bulletIndex: number, value: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const bullets = [...(page.outlineContent.bulletPoints || [])]
      bullets[bulletIndex] = value
      const updatedOutline: OutlineContent = { ...page.outlineContent, bulletPoints: bullets }
      dispatch(updatePageLocally({ pageId, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, pages]
  )

  const handleBulletBlur = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { outlineContent: page.outlineContent }
        })
      ).catch((error) => {
        logger.error('Failed to update page bullets', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  const handleAddBullet = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const bullets = [...(page.outlineContent.bulletPoints || []), '']
      const updatedOutline: OutlineContent = { ...page.outlineContent, bulletPoints: bullets }
      dispatch(updatePageLocally({ pageId, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, pages]
  )

  const handleRemoveBullet = useCallback(
    (pageId: string, bulletIndex: number) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const bullets = (page.outlineContent.bulletPoints || []).filter((_, i) => i !== bulletIndex)
      const updatedOutline: OutlineContent = { ...page.outlineContent, bulletPoints: bullets }
      dispatch(updatePageLocally({ pageId, changes: { outlineContent: updatedOutline } }))
      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { outlineContent: { ...page.outlineContent, bulletPoints: bullets } }
        })
      ).catch((error) => {
        logger.error('Failed to remove bullet', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  const handleNotesChange = useCallback(
    (pageId: string, notes: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      const updatedOutline: OutlineContent = { ...page.outlineContent, notes }
      dispatch(updatePageLocally({ pageId, changes: { outlineContent: updatedOutline } }))
    },
    [dispatch, pages]
  )

  const handleNotesBlur = useCallback(
    (pageId: string) => {
      const page = pages.find((p) => p.id === pageId)
      if (!page) return

      dispatch(
        updatePage({
          id: presentationId,
          pageId,
          input: { outlineContent: page.outlineContent }
        })
      ).catch((error) => {
        logger.error('Failed to update page notes', { pageId, error: String(error) })
      })
    },
    [dispatch, pages, presentationId]
  )

  // ---- 排序 ----

  const handleSortEnd = useCallback(
    ({ oldIndex, newIndex }: { oldIndex: number; newIndex: number }) => {
      if (oldIndex === newIndex) return

      const newOrder = [...sortedPages]
      const [moved] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, moved)
      const pageIds = newOrder.map((p) => p.id)

      dispatch(reorderPagesLocally(pageIds))
      dispatch(reorderPages({ id: presentationId, input: { pageIds } })).catch((error) => {
        logger.error('Failed to reorder pages', { error: String(error) })
      })
    },
    [dispatch, presentationId, sortedPages]
  )

  // ---- 添加/删除页面 ----

  const handleAddPage = useCallback(() => {
    const nextIndex = sortedPages.length
    dispatch(
      createPage({
        id: presentationId,
        input: {
          orderIndex: nextIndex,
          outlineContent: {
            title: t('presentations.outline.new_page_title')
          }
        }
      })
    ).catch((error) => {
      logger.error('Failed to create page', { error: String(error) })
    })
  }, [dispatch, presentationId, sortedPages.length, t])

  const handleDeletePage = useCallback(
    (pageId: string) => {
      dispatch(deletePage({ id: presentationId, pageId })).catch((error) => {
        logger.error('Failed to delete page', { pageId, error: String(error) })
      })
    },
    [dispatch, presentationId]
  )

  // ---- AI 优化 ----

  const handleRefine = useCallback(async () => {
    if (!refineInstruction.trim()) return

    setRefineLoading(true)
    try {
      const outlinePages = sortedPages.map((p) => p.outlineContent)
      await dispatch(
        refineOutline({
          id: presentationId,
          input: {
            instruction: refineInstruction.trim(),
            pages: outlinePages
          }
        })
      ).unwrap()

      logger.info('Outline refine task started', { presentationId })
      setRefineModalOpen(false)
      setRefineInstruction('')
    } catch (error) {
      logger.error('Failed to refine outline', { error: String(error) })
    } finally {
      setRefineLoading(false)
    }
  }, [dispatch, presentationId, refineInstruction, sortedPages])

  // ---- 渲染大纲项 ----

  const renderOutlineItem = useCallback(
    (page: PresentationPage, { dragging }: { dragging: boolean }) => {
      const isEditing = editingPageId === page.id
      const pageIndex = sortedPages.findIndex((p) => p.id === page.id)

      return (
        <OutlineCard $dragging={dragging} $editing={isEditing} onClick={() => setEditingPageId(page.id)}>
          <CardHeader>
            <DragHandle>
              <HolderOutlined />
            </DragHandle>
            <PageNumber>{pageIndex + 1}</PageNumber>
            <TitleInput
              value={page.outlineContent.title}
              onChange={(e) => handleTitleChange(page.id, e.target.value)}
              onBlur={() => handleTitleBlur(page.id)}
              placeholder={t('presentations.outline.title_placeholder')}
              disabled={disabled}
              variant="borderless"
              size="small"
            />
            <Popconfirm
              title={t('presentations.outline.delete_confirm')}
              onConfirm={(e) => {
                e?.stopPropagation()
                handleDeletePage(page.id)
              }}
              onCancel={(e) => e?.stopPropagation()}
              okButtonProps={{ danger: true }}
              disabled={disabled || sortedPages.length <= 1}>
              <Tooltip title={t('common.delete')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  disabled={disabled || sortedPages.length <= 1}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </CardHeader>

          {isEditing && (
            <CardBody>
              <SectionLabel>{t('presentations.outline.bullets')}</SectionLabel>
              {(page.outlineContent.bulletPoints || []).map((bullet, idx) => (
                <BulletRow key={idx}>
                  <BulletDot />
                  <Input
                    value={bullet}
                    onChange={(e) => handleBulletChange(page.id, idx, e.target.value)}
                    onBlur={() => handleBulletBlur(page.id)}
                    placeholder={t('presentations.outline.bullet_placeholder')}
                    disabled={disabled}
                    size="small"
                    variant="borderless"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveBullet(page.id, idx)
                    }}
                    disabled={disabled}
                  />
                </BulletRow>
              ))}
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  handleAddBullet(page.id)
                }}
                disabled={disabled}
                block>
                {t('presentations.outline.add_bullet')}
              </Button>

              <SectionLabel style={{ marginTop: 12 }}>{t('presentations.outline.notes')}</SectionLabel>
              <Input.TextArea
                value={page.outlineContent.notes || ''}
                onChange={(e) => handleNotesChange(page.id, e.target.value)}
                onBlur={() => handleNotesBlur(page.id)}
                placeholder={t('presentations.outline.notes_placeholder')}
                disabled={disabled}
                rows={2}
                size="small"
                variant="borderless"
              />
            </CardBody>
          )}

          {!isEditing && page.outlineContent.bulletPoints && page.outlineContent.bulletPoints.length > 0 && (
            <CollapsedBullets>
              {page.outlineContent.bulletPoints.slice(0, 3).map((bullet, idx) => (
                <Tag key={idx} style={{ fontSize: 11 }}>
                  {bullet.length > 30 ? `${bullet.substring(0, 30)}...` : bullet}
                </Tag>
              ))}
              {page.outlineContent.bulletPoints.length > 3 && (
                <Tag style={{ fontSize: 11 }}>+{page.outlineContent.bulletPoints.length - 3}</Tag>
              )}
            </CollapsedBullets>
          )}
        </OutlineCard>
      )
    },
    [
      disabled,
      editingPageId,
      handleAddBullet,
      handleBulletBlur,
      handleBulletChange,
      handleDeletePage,
      handleNotesBlur,
      handleNotesChange,
      handleRemoveBullet,
      handleTitleBlur,
      handleTitleChange,
      sortedPages,
      t
    ]
  )

  return (
    <Container>
      <Header>
        <HeaderTitle>
          {t('presentations.outline.title')}
          <PageCount>
            {sortedPages.length} {t('presentations.outline.pages')}
          </PageCount>
        </HeaderTitle>
        <HeaderActions>
          <Button
            icon={<RobotOutlined />}
            size="small"
            onClick={() => setRefineModalOpen(true)}
            disabled={disabled || sortedPages.length === 0}>
            {t('presentations.outline.ai_refine')}
          </Button>
          <Button icon={<PlusOutlined />} size="small" onClick={handleAddPage} disabled={disabled}>
            {t('presentations.outline.add_page')}
          </Button>
        </HeaderActions>
      </Header>

      <OutlineList>
        <Sortable
          items={sortedPages}
          itemKey="id"
          onSortEnd={handleSortEnd}
          renderItem={renderOutlineItem}
          gap="8px"
          restrictions={{ scrollableAncestor: true }}
        />
      </OutlineList>

      <Modal
        title={t('presentations.outline.refine_modal_title')}
        open={refineModalOpen}
        onOk={handleRefine}
        onCancel={() => {
          setRefineModalOpen(false)
          setRefineInstruction('')
        }}
        confirmLoading={refineLoading}
        okButtonProps={{ disabled: !refineInstruction.trim() }}>
        <RefineHint>{t('presentations.outline.refine_hint')}</RefineHint>
        <Input.TextArea
          value={refineInstruction}
          onChange={(e) => setRefineInstruction(e.target.value)}
          placeholder={t('presentations.outline.refine_placeholder')}
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

const OutlineList = styled.div`
  flex: 1;
  overflow-y: auto;
`

const OutlineCard = styled.div<{ $dragging?: boolean; $editing?: boolean }>`
  border: 1px solid ${({ $editing }) => ($editing ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  background-color: ${({ $editing }) => ($editing ? 'var(--color-primary-bg)' : 'var(--color-background)')};
  padding: 8px 12px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: ${({ $dragging }) => ($dragging ? 0.5 : 1)};

  &:hover {
    border-color: var(--color-primary);
  }
`

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const DragHandle = styled.span`
  cursor: grab;
  color: var(--color-text-3);
  font-size: 14px;
  display: flex;
  align-items: center;

  &:active {
    cursor: grabbing;
  }
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

const TitleInput = styled(Input)`
  flex: 1;
  font-weight: 500;
`

const CardBody = styled.div`
  padding: 8px 0 4px 28px;
`

const SectionLabel = styled.div`
  font-size: 11px;
  color: var(--color-text-3);
  margin-bottom: 4px;
  user-select: none;
`

const BulletRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`

const BulletDot = styled.span`
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background-color: var(--color-text-3);
  flex-shrink: 0;
`

const CollapsedBullets = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 0 0 28px;
`

const RefineHint = styled.div`
  font-size: 13px;
  color: var(--color-text-2);
  margin-bottom: 12px;
`

export default OutlineEditor
