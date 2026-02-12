import type { PresentationTask, PresentationTaskStatus } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { pollTask, removeTask, usePresentationTasks } from '@renderer/store/presentations'
import { Badge, Button, List, Progress, Tag, Tooltip } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('TaskProgress')

const POLL_INTERVAL = 2000

const STATUS_COLOR_MAP: Record<PresentationTaskStatus, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning'
}

const TASK_TYPE_I18N_MAP: Record<string, string> = {
  generate_outline: 'presentations.task.generate_outline',
  generate_descriptions: 'presentations.task.generate_descriptions',
  generate_images: 'presentations.task.generate_images',
  generate_single_image: 'presentations.task.generate_single_image',
  edit_image: 'presentations.task.edit_image',
  export_pptx: 'presentations.task.export_pptx',
  export_pdf: 'presentations.task.export_pdf',
  export_editable_pptx: 'presentations.task.export_editable_pptx',
  refine_outline: 'presentations.task.refine_outline',
  refine_descriptions: 'presentations.task.refine_descriptions',
  parse_reference_file: 'presentations.task.parse_reference_file'
}

interface TaskProgressProps {
  /** 控制是否自动轮询 */
  enablePolling?: boolean
  /** 任务完成回调 */
  onTaskCompleted?: (task: PresentationTask) => void
  /** 任务失败回调 */
  onTaskFailed?: (task: PresentationTask) => void
}

const TaskProgress: FC<TaskProgressProps> = ({ enablePolling = true, onTaskCompleted, onTaskFailed }) => {
  const { t } = useTranslation()
  const { dispatch, activeTasks, runningTasks } = usePresentationTasks()
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const getProgressPercent = useCallback((task: PresentationTask): number => {
    if (task.status === 'completed') return 100
    if (task.status === 'failed' || task.status === 'cancelled') return 0
    const { completed = 0, total = 0 } = task.progress
    if (total <= 0) return task.status === 'running' ? 50 : 0
    return Math.round((completed / total) * 100)
  }, [])

  useEffect(() => {
    if (!enablePolling || runningTasks.length === 0) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    pollTimerRef.current = setInterval(() => {
      for (const task of runningTasks) {
        dispatch(pollTask(task.id))
          .unwrap()
          .then((updatedTask) => {
            if (updatedTask.status === 'completed') {
              onTaskCompleted?.(updatedTask)
            } else if (updatedTask.status === 'failed') {
              onTaskFailed?.(updatedTask)
            }
          })
          .catch((error) => {
            logger.error('Failed to poll task', { taskId: task.id, error: String(error) })
          })
      }
    }, POLL_INTERVAL)

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [enablePolling, runningTasks, dispatch, onTaskCompleted, onTaskFailed])

  const handleDismiss = useCallback(
    (taskId: string) => {
      dispatch(removeTask(taskId))
    },
    [dispatch]
  )

  const taskList = Object.values(activeTasks)
  if (taskList.length === 0) return null

  return (
    <Container>
      <Header>
        <Badge count={runningTasks.length} size="small" offset={[8, 0]}>
          <span className="font-medium text-sm">{t('presentations.task.active_tasks')}</span>
        </Badge>
      </Header>
      <List
        size="small"
        dataSource={taskList}
        renderItem={(task) => {
          const percent = getProgressPercent(task)
          const isTerminal = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
          return (
            <List.Item
              key={task.id}
              actions={
                isTerminal
                  ? [
                      <Button key="dismiss" type="link" size="small" onClick={() => handleDismiss(task.id)}>
                        {t('presentations.task.dismiss')}
                      </Button>
                    ]
                  : undefined
              }>
              <TaskItem>
                <TaskHeader>
                  <span className="text-xs">
                    {t(TASK_TYPE_I18N_MAP[task.taskType] || 'presentations.task.unknown')}
                  </span>
                  <Tag color={STATUS_COLOR_MAP[task.status]}>{t(`presentations.task.status.${task.status}`)}</Tag>
                </TaskHeader>
                {task.status === 'running' && (
                  <Tooltip title={task.progress.currentStep}>
                    <Progress percent={percent} size="small" status="active" />
                  </Tooltip>
                )}
                {task.status === 'failed' && task.errorMessage && <ErrorText>{task.errorMessage}</ErrorText>}
              </TaskItem>
            </List.Item>
          )
        }}
      />
    </Container>
  )
}

const Container = styled.div`
  background-color: var(--color-background-soft);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
`

const Header = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 0.5px solid var(--color-border);
`

const TaskItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
`

const TaskHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const ErrorText = styled.span`
  font-size: 12px;
  color: var(--color-error);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export default TaskProgress
