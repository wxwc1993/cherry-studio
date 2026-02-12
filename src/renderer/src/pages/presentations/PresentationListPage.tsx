import { DeleteOutlined, FileAddOutlined, SearchOutlined } from '@ant-design/icons'
import type { PresentationListItem, PresentationStatus } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import Scrollbar from '@renderer/components/Scrollbar'
import { presentationApi } from '@renderer/services/PresentationApi'
import { deletePresentation, fetchPresentations, setFilters, usePresentations } from '@renderer/store/presentations'
import { Button, Card, Empty, Input, Pagination, Popconfirm, Select, Spin, Tag } from 'antd'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

const logger = loggerService.withContext('PresentationListPage')

const STATUS_COLOR_MAP: Record<PresentationStatus, string> = {
  draft: 'default',
  outline_ready: 'processing',
  descriptions_ready: 'warning',
  images_ready: 'success',
  completed: 'green'
}

const PresentationListPage: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { dispatch, items, pagination, loading, filters } = usePresentations()
  const [searchInput, setSearchInput] = useState(filters.search || '')

  useEffect(() => {
    dispatch(fetchPresentations())
  }, [dispatch])

  const handleSearch = useCallback(() => {
    dispatch(setFilters({ search: searchInput || undefined }))
    dispatch(fetchPresentations({ search: searchInput || undefined, page: 1 }))
  }, [dispatch, searchInput])

  const handleStatusFilter = useCallback(
    (status: PresentationStatus | undefined) => {
      dispatch(setFilters({ status }))
      dispatch(fetchPresentations({ status, page: 1 }))
    },
    [dispatch]
  )

  const handlePageChange = useCallback(
    (page: number, pageSize: number) => {
      dispatch(fetchPresentations({ page, pageSize }))
    },
    [dispatch]
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await dispatch(deletePresentation(id)).unwrap()
        logger.info('Presentation deleted', { id })
      } catch (error) {
        logger.error('Failed to delete presentation', { error: String(error) })
      }
    },
    [dispatch]
  )

  const handleCreate = useCallback(() => {
    navigate('/presentations/create')
  }, [navigate])

  const handleOpen = useCallback(
    (id: string) => {
      navigate(`/presentations/${id}`)
    },
    [navigate]
  )

  const getPreviewUrl = useCallback((item: PresentationListItem): string | null => {
    if (!item.previewImageKey) return null
    return presentationApi.getImageUrl(item.previewImageKey)
  }, [])

  const statusOptions = useMemo(
    () => [
      { value: undefined, label: t('presentations.list.status_all') },
      { value: 'draft' as const, label: t('presentations.list.status.draft') },
      { value: 'outline_ready' as const, label: t('presentations.list.status.outline_ready') },
      { value: 'descriptions_ready' as const, label: t('presentations.list.status.descriptions_ready') },
      { value: 'images_ready' as const, label: t('presentations.list.status.images_ready') },
      { value: 'completed' as const, label: t('presentations.list.status.completed') }
    ],
    [t]
  )

  const formatDate = useCallback((date: string | Date): string => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }, [])

  return (
    <Container>
      <Navbar>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('presentations.title')}</NavbarCenter>
      </Navbar>
      <ContentArea>
        <Toolbar>
          <ToolbarLeft>
            <Input
              placeholder={t('presentations.list.search_placeholder')}
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              onClear={() => {
                setSearchInput('')
                dispatch(setFilters({ search: undefined }))
                dispatch(fetchPresentations({ search: undefined, page: 1 }))
              }}
              size="middle"
              style={{ width: 240 }}
            />
            <Select
              value={filters.status}
              onChange={handleStatusFilter}
              placeholder={t('presentations.list.status_filter')}
              options={statusOptions}
              size="middle"
              style={{ width: 160 }}
              allowClear
            />
          </ToolbarLeft>
          <Button type="primary" icon={<FileAddOutlined />} onClick={handleCreate}>
            {t('presentations.list.create')}
          </Button>
        </Toolbar>

        {loading.list ? (
          <LoadingContainer>
            <Spin size="large" />
          </LoadingContainer>
        ) : items.length === 0 ? (
          <EmptyContainer>
            <Empty description={t('presentations.list.empty')}>
              <Button type="primary" onClick={handleCreate}>
                {t('presentations.list.create_first')}
              </Button>
            </Empty>
          </EmptyContainer>
        ) : (
          <>
            <CardGrid>
              {items.map((item) => {
                const previewUrl = getPreviewUrl(item)
                return (
                  <StyledCard
                    key={item.id}
                    hoverable
                    onClick={() => handleOpen(item.id)}
                    cover={
                      previewUrl ? (
                        <PreviewImage src={previewUrl} alt={item.title} />
                      ) : (
                        <PlaceholderCover>
                          <span className="text-3xl">📊</span>
                        </PlaceholderCover>
                      )
                    }
                    actions={[
                      <Popconfirm
                        key="delete"
                        title={t('presentations.list.delete_confirm')}
                        onConfirm={(e) => {
                          e?.stopPropagation()
                          handleDelete(item.id)
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                        okButtonProps={{ danger: true }}>
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          danger
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    ]}>
                    <Card.Meta
                      title={<CardTitle>{item.title}</CardTitle>}
                      description={
                        <CardMeta>
                          <Tag color={STATUS_COLOR_MAP[item.status]}>
                            {t(`presentations.list.status.${item.status}`)}
                          </Tag>
                          <CardDate>{formatDate(item.updatedAt)}</CardDate>
                        </CardMeta>
                      }
                    />
                  </StyledCard>
                )
              })}
            </CardGrid>

            {pagination.totalPages > 1 && (
              <PaginationContainer>
                <Pagination
                  current={pagination.page}
                  pageSize={pagination.pageSize}
                  total={pagination.total}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  size="small"
                />
              </PaginationContainer>
            )}
          </>
        )}
      </ContentArea>
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

const ContentArea = styled(Scrollbar)`
  flex: 1;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
`

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  flex-shrink: 0;
`

const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 300px;
`

const EmptyContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  flex: 1;
  min-height: 300px;
`

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  flex: 1;
`

const StyledCard = styled(Card)`
  .ant-card-body {
    padding: 12px 16px;
  }

  .ant-card-actions {
    border-top: 0.5px solid var(--color-border);
  }

  .ant-card-meta-title {
    font-size: 14px;
    margin-bottom: 4px !important;
  }
`

const PreviewImage = styled.img`
  width: 100%;
  height: 150px;
  object-fit: cover;
`

const PlaceholderCover = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 150px;
  background-color: var(--color-background-soft);
`

const CardTitle = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`

const CardDate = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
  white-space: nowrap;
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px 0 8px;
  flex-shrink: 0;
`

export default PresentationListPage
