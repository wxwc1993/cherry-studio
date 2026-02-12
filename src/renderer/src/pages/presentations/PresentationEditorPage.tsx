import { ArrowLeftOutlined, DownloadOutlined, PictureOutlined, RobotOutlined } from '@ant-design/icons'
import type { PresentationTask } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { Navbar, NavbarCenter, NavbarLeft } from '@renderer/components/app/Navbar'
import {
  clearActiveTasks,
  clearCurrentPresentation,
  fetchPresentation,
  generateDescriptions,
  generateImages,
  generateOutline,
  useCurrentPresentation,
  usePresentationTasks
} from '@renderer/store/presentations'
import { Button, Empty, Spin, Tabs, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'

import DescriptionEditor from './components/DescriptionEditor'
import ExportDialog from './components/ExportDialog'
import MaterialPanel from './components/MaterialPanel'
import OutlineEditor from './components/OutlineEditor'
import PageEditor from './components/PageEditor'
import SlidePreview from './components/SlidePreview'
import TaskProgress from './components/TaskProgress'

const logger = loggerService.withContext('PresentationEditorPage')

const PresentationEditorPage: FC = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { dispatch, presentation, pages, loading } = useCurrentPresentation()
  const { runningTasks } = usePresentationTasks()

  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('outline')

  // 加载演示文稿数据
  useEffect(() => {
    if (!id) return
    dispatch(fetchPresentation(id)).catch((error) => {
      logger.error('Failed to load presentation', { id, error: String(error) })
    })

    return () => {
      dispatch(clearCurrentPresentation())
      dispatch(clearActiveTasks())
    }
  }, [dispatch, id])

  // 自动选中第一页
  useEffect(() => {
    if (pages.length > 0 && !selectedPageId) {
      const sorted = [...pages].sort((a, b) => a.orderIndex - b.orderIndex)
      setSelectedPageId(sorted[0].id)
    }
  }, [pages, selectedPageId])

  const selectedPage = useMemo(() => pages.find((p) => p.id === selectedPageId) ?? null, [pages, selectedPageId])

  const hasRunningTasks = runningTasks.length > 0

  const handleBack = useCallback(() => {
    navigate('/presentations')
  }, [navigate])

  const handleSelectPage = useCallback((pageId: string) => {
    setSelectedPageId(pageId)
  }, [])

  const handleTaskCompleted = useCallback(
    (task: PresentationTask) => {
      logger.info('Task completed, refreshing data', { taskId: task.id, taskType: task.taskType })
      if (id) {
        dispatch(fetchPresentation(id)).catch((error) => {
          logger.error('Failed to refresh after task', { error: String(error) })
        })
      }
    },
    [dispatch, id]
  )

  const handleTaskFailed = useCallback((task: PresentationTask) => {
    logger.error('Task failed', { taskId: task.id, taskType: task.taskType, error: task.errorMessage })
  }, [])

  // ---- AI 操作 ----

  const handleGenerateOutline = useCallback(async () => {
    if (!id || !presentation) return
    try {
      await dispatch(
        generateOutline({
          id,
          input: {
            idea: presentation.sourceContent || presentation.title
          }
        })
      ).unwrap()
      logger.info('Outline generation started', { presentationId: id })
    } catch (error) {
      logger.error('Failed to generate outline', { error: String(error) })
    }
  }, [dispatch, id, presentation])

  const handleGenerateDescriptions = useCallback(async () => {
    if (!id) return
    try {
      await dispatch(generateDescriptions({ id })).unwrap()
      logger.info('Description generation started', { presentationId: id })
    } catch (error) {
      logger.error('Failed to generate descriptions', { error: String(error) })
    }
  }, [dispatch, id])

  const handleGenerateImages = useCallback(async () => {
    if (!id) return
    try {
      await dispatch(generateImages({ id })).unwrap()
      logger.info('Image generation started', { presentationId: id })
    } catch (error) {
      logger.error('Failed to generate images', { error: String(error) })
    }
  }, [dispatch, id])

  // ---- 加载中 ----

  if (loading.detail) {
    return (
      <Container>
        <Navbar>
          <NavbarLeft>
            <BackButton type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              {t('common.back')}
            </BackButton>
          </NavbarLeft>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('presentations.editor.loading')}</NavbarCenter>
        </Navbar>
        <LoadingContainer>
          <Spin size="large" />
        </LoadingContainer>
      </Container>
    )
  }

  if (!presentation) {
    return (
      <Container>
        <Navbar>
          <NavbarLeft>
            <BackButton type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              {t('common.back')}
            </BackButton>
          </NavbarLeft>
          <NavbarCenter style={{ borderRight: 'none' }}>{t('presentations.title')}</NavbarCenter>
        </Navbar>
        <EmptyContainer>
          <Empty description={t('presentations.editor.not_found')} />
        </EmptyContainer>
      </Container>
    )
  }

  // ---- 编辑器主面板标签 ----

  const editorTabs = [
    {
      key: 'outline',
      label: t('presentations.editor.tab_outline'),
      children: <OutlineEditor presentationId={presentation.id} pages={pages} disabled={hasRunningTasks} />
    },
    {
      key: 'description',
      label: t('presentations.editor.tab_description'),
      children: <DescriptionEditor presentationId={presentation.id} pages={pages} disabled={hasRunningTasks} />
    },
    {
      key: 'materials',
      label: t('presentations.editor.tab_materials'),
      children: <MaterialPanel presentationId={presentation.id} />
    }
  ]

  return (
    <Container>
      <Navbar>
        <NavbarLeft>
          <BackButton type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
            {t('common.back')}
          </BackButton>
        </NavbarLeft>
        <NavbarCenter style={{ borderRight: 'none' }}>{presentation.title}</NavbarCenter>
      </Navbar>

      <TaskProgress enablePolling onTaskCompleted={handleTaskCompleted} onTaskFailed={handleTaskFailed} />

      <EditorLayout>
        {/* 左侧缩略图导航 */}
        <SlidePreview pages={pages} selectedPageId={selectedPageId} onSelectPage={handleSelectPage} />

        {/* 中间编辑区 */}
        <CenterPanel>
          <ActionBar>
            <ActionGroup>
              <Tooltip title={t('presentations.editor.action_outline')}>
                <Button
                  icon={<RobotOutlined />}
                  size="small"
                  onClick={handleGenerateOutline}
                  disabled={hasRunningTasks}>
                  {t('presentations.editor.action_outline')}
                </Button>
              </Tooltip>
              <Tooltip title={t('presentations.editor.action_descriptions')}>
                <Button
                  icon={<RobotOutlined />}
                  size="small"
                  onClick={handleGenerateDescriptions}
                  disabled={hasRunningTasks || pages.length === 0}>
                  {t('presentations.editor.action_descriptions')}
                </Button>
              </Tooltip>
              <Tooltip title={t('presentations.editor.action_images')}>
                <Button
                  icon={<PictureOutlined />}
                  size="small"
                  onClick={handleGenerateImages}
                  disabled={hasRunningTasks || pages.length === 0}>
                  {t('presentations.editor.action_images')}
                </Button>
              </Tooltip>
            </ActionGroup>
            <Tooltip title={t('presentations.export.title')}>
              <Button
                icon={<DownloadOutlined />}
                size="small"
                onClick={() => setExportOpen(true)}
                disabled={hasRunningTasks || pages.length === 0}>
                {t('presentations.export.title')}
              </Button>
            </Tooltip>
          </ActionBar>

          <StyledTabs items={editorTabs} activeKey={activeTab} onChange={setActiveTab} size="small" />
        </CenterPanel>

        {/* 右侧单页编辑面板 */}
        <RightPanel>
          <PageEditor presentationId={presentation.id} page={selectedPage} disabled={hasRunningTasks} />
        </RightPanel>
      </EditorLayout>

      <ExportDialog open={exportOpen} presentationId={presentation.id} onClose={() => setExportOpen(false)} />
    </Container>
  )
}

// ============ Styled Components ============

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  height: 100%;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
`

const BackButton = styled(Button)`
  font-size: 13px;
`

const EditorLayout = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
`

const CenterPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
`

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 0.5px solid var(--color-border);
  flex-shrink: 0;
`

const ActionGroup = styled.div`
  display: flex;
  gap: 8px;
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
    padding: 12px 16px;
  }

  .ant-tabs-tabpane {
    padding: 0;
  }
`

const RightPanel = styled.div`
  width: 320px;
  min-width: 320px;
  border-left: 0.5px solid var(--color-border);
  overflow: hidden;
`

export default PresentationEditorPage
