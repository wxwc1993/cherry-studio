import { DeleteOutlined, FileTextOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons'
import type { PresentationMaterial, PresentationReferenceFile } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { presentationApi } from '@renderer/services/PresentationApi'
import { Button, Empty, List, Popconfirm, Spin, Tabs, Upload } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('MaterialPanel')

interface MaterialPanelProps {
  presentationId: string
}

const MaterialPanel: FC<MaterialPanelProps> = ({ presentationId }) => {
  const { t } = useTranslation()
  const [materials, setMaterials] = useState<PresentationMaterial[]>([])
  const [referenceFiles, setReferenceFiles] = useState<PresentationReferenceFile[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [loadingRefs, setLoadingRefs] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true)
    try {
      const response = await presentationApi.listMaterials(presentationId)
      setMaterials(response.data)
    } catch (error) {
      logger.error('Failed to fetch materials', { error: String(error) })
    } finally {
      setLoadingMaterials(false)
    }
  }, [presentationId])

  const fetchReferenceFiles = useCallback(async () => {
    setLoadingRefs(true)
    try {
      const response = await presentationApi.listReferenceFiles(presentationId)
      setReferenceFiles(response.data)
    } catch (error) {
      logger.error('Failed to fetch reference files', { error: String(error) })
    } finally {
      setLoadingRefs(false)
    }
  }, [presentationId])

  useEffect(() => {
    fetchMaterials()
    fetchReferenceFiles()
  }, [fetchMaterials, fetchReferenceFiles])

  const handleUploadMaterial = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const response = await presentationApi.uploadMaterial(presentationId, file)
        setMaterials((prev) => [...prev, response.data])
        logger.info('Material uploaded', { fileName: file.name })
      } catch (error) {
        logger.error('Failed to upload material', { error: String(error) })
      } finally {
        setUploading(false)
      }
    },
    [presentationId]
  )

  const handleUploadReference = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const response = await presentationApi.uploadReferenceFile(presentationId, file)
        setReferenceFiles((prev) => [...prev, response.data])
        logger.info('Reference file uploaded', { fileName: file.name })
      } catch (error) {
        logger.error('Failed to upload reference file', { error: String(error) })
      } finally {
        setUploading(false)
      }
    },
    [presentationId]
  )

  const handleDeleteMaterial = useCallback(async (materialId: string) => {
    try {
      await presentationApi.deleteMaterial(materialId)
      setMaterials((prev) => prev.filter((m) => m.id !== materialId))
      logger.info('Material deleted', { materialId })
    } catch (error) {
      logger.error('Failed to delete material', { error: String(error) })
    }
  }, [])

  const handleDeleteReference = useCallback(async (fileId: string) => {
    try {
      await presentationApi.deleteReferenceFile(fileId)
      setReferenceFiles((prev) => prev.filter((f) => f.id !== fileId))
      logger.info('Reference file deleted', { fileId })
    } catch (error) {
      logger.error('Failed to delete reference file', { error: String(error) })
    }
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const materialTab = (
    <div>
      <Upload
        beforeUpload={(file) => {
          handleUploadMaterial(file as File)
          return false
        }}
        showUploadList={false}
        disabled={uploading}>
        <Button icon={<UploadOutlined />} loading={uploading} size="small" className="mb-2">
          {t('presentations.material.upload')}
        </Button>
      </Upload>
      {loadingMaterials ? (
        <Spin size="small" />
      ) : materials.length === 0 ? (
        <Empty description={t('presentations.material.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={materials}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <Popconfirm
                  key="delete"
                  title={t('presentations.material.delete_confirm')}
                  onConfirm={() => handleDeleteMaterial(item.id)}
                  okButtonProps={{ danger: true }}>
                  <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              ]}>
              <List.Item.Meta
                avatar={<PictureOutlined />}
                title={<span className="text-xs">{item.fileName}</span>}
                description={<span className="text-xs">{formatFileSize(item.fileSize)}</span>}
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  const referenceTab = (
    <div>
      <Upload
        beforeUpload={(file) => {
          handleUploadReference(file as File)
          return false
        }}
        showUploadList={false}
        accept=".pdf,.docx,.doc,.txt,.md"
        disabled={uploading}>
        <Button icon={<UploadOutlined />} loading={uploading} size="small" className="mb-2">
          {t('presentations.reference.upload')}
        </Button>
      </Upload>
      {loadingRefs ? (
        <Spin size="small" />
      ) : referenceFiles.length === 0 ? (
        <Empty description={t('presentations.reference.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          size="small"
          dataSource={referenceFiles}
          renderItem={(item) => (
            <List.Item
              key={item.id}
              actions={[
                <Popconfirm
                  key="delete"
                  title={t('presentations.reference.delete_confirm')}
                  onConfirm={() => handleDeleteReference(item.id)}
                  okButtonProps={{ danger: true }}>
                  <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
              ]}>
              <List.Item.Meta
                avatar={<FileTextOutlined />}
                title={<span className="text-xs">{item.fileName}</span>}
                description={
                  <span className="text-xs">
                    {formatFileSize(item.fileSize)} · {t(`presentations.reference.status.${item.parseStatus}`)}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Container>
      <Tabs
        size="small"
        items={[
          { key: 'materials', label: t('presentations.material.tab'), children: materialTab },
          { key: 'references', label: t('presentations.reference.tab'), children: referenceTab }
        ]}
      />
    </Container>
  )
}

const Container = styled.div`
  padding: 8px;
`

export default MaterialPanel
