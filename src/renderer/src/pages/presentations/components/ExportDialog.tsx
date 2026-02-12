import type { PresentationTask } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { presentationApi } from '@renderer/services/PresentationApi'
import { exportEditablePptx, exportPdf, exportPptx, usePresentationTasks } from '@renderer/store/presentations'
import { Modal, Progress, Radio, Space } from 'antd'
import type { FC } from 'react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('ExportDialog')

type ExportFormat = 'pptx' | 'pdf' | 'editable_pptx'

interface ExportDialogProps {
  open: boolean
  presentationId: string
  onClose: () => void
}

const ExportDialog: FC<ExportDialogProps> = ({ open, presentationId, onClose }) => {
  const { t } = useTranslation()
  const { dispatch } = usePresentationTasks()
  const [format, setFormat] = useState<ExportFormat>('pptx')
  const [exporting, setExporting] = useState(false)
  const [exportTask, setExportTask] = useState<PresentationTask | null>(null)
  const [error, setError] = useState<string | null>(null)

  const EXPORT_OPTIONS: Array<{ value: ExportFormat; label: string; description: string }> = [
    {
      value: 'pptx',
      label: t('presentations.export.format.pptx'),
      description: t('presentations.export.format.pptx_desc')
    },
    {
      value: 'pdf',
      label: t('presentations.export.format.pdf'),
      description: t('presentations.export.format.pdf_desc')
    },
    {
      value: 'editable_pptx',
      label: t('presentations.export.format.editable_pptx'),
      description: t('presentations.export.format.editable_pptx_desc')
    }
  ]

  const handleExport = useCallback(async () => {
    setExporting(true)
    setError(null)

    try {
      const thunkMap = {
        pptx: exportPptx,
        pdf: exportPdf,
        editable_pptx: exportEditablePptx
      }
      const task = await dispatch(thunkMap[format](presentationId)).unwrap()
      setExportTask(task)
      logger.info('Export task created', { taskId: task.id, format })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('Export failed', { error: message })
      setExporting(false)
    }
  }, [dispatch, format, presentationId])

  const handleDownload = useCallback(async () => {
    if (!exportTask) return

    try {
      const blob = await presentationApi.downloadTaskResult(exportTask.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `presentation.${format === 'editable_pptx' ? 'pptx' : format}`
      link.click()
      URL.revokeObjectURL(url)
      logger.info('Export downloaded', { taskId: exportTask.id })
      handleClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      logger.error('Download failed', { error: message })
    }
  }, [exportTask, format])

  const handleClose = useCallback(() => {
    setExporting(false)
    setExportTask(null)
    setError(null)
    setFormat('pptx')
    onClose()
  }, [onClose])

  const getProgressPercent = (): number => {
    if (!exportTask) return 0
    if (exportTask.status === 'completed') return 100
    const { completed = 0, total = 1 } = exportTask.progress
    return Math.round((completed / total) * 100)
  }

  return (
    <Modal
      title={t('presentations.export.title')}
      open={open}
      onCancel={handleClose}
      onOk={exportTask?.status === 'completed' ? handleDownload : handleExport}
      okText={exportTask?.status === 'completed' ? t('presentations.export.download') : t('presentations.export.start')}
      okButtonProps={{ loading: exporting && !exportTask, disabled: !!exportTask && exportTask.status !== 'completed' }}
      cancelText={t('common.cancel')}
      destroyOnClose>
      <Content>
        {!exportTask && (
          <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)}>
            <Space direction="vertical">
              {EXPORT_OPTIONS.map((option) => (
                <Radio key={option.value} value={option.value}>
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-gray-500 text-xs">{option.description}</div>
                  </div>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}

        {exportTask && (
          <ProgressSection>
            <div className="mb-2 text-sm">{t('presentations.export.processing')}</div>
            <Progress
              percent={getProgressPercent()}
              status={
                exportTask.status === 'failed' ? 'exception' : exportTask.status === 'completed' ? 'success' : 'active'
              }
            />
            {exportTask.progress.currentStep && (
              <div className="mt-1 text-gray-500 text-xs">{exportTask.progress.currentStep}</div>
            )}
          </ProgressSection>
        )}

        {error && <ErrorText>{error}</ErrorText>}
      </Content>
    </Modal>
  )
}

const Content = styled.div`
  padding: 16px 0;
`

const ProgressSection = styled.div`
  padding: 8px 0;
`

const ErrorText = styled.div`
  color: var(--color-error);
  font-size: 12px;
  margin-top: 8px;
`

export default ExportDialog
