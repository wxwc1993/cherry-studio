import { Spin } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import CarouselBanner from './components/CarouselBanner'
import HotSearchPanel from './components/HotSearchPanel'
import LearningTabs from './components/LearningTabs'
import PromotionBanner from './components/PromotionBanner'
import { useLearningCenter } from './hooks/useLearningCenter'

const LearningCenterPage: FC = () => {
  const { t } = useTranslation()
  const { data, hotItems, loading, error, noMoreHotItems, refreshHotItems } = useLearningCenter()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (error) {
    return <div className="flex h-full items-center justify-center text-red-500">{error}</div>
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: 'var(--color-text-3)' }}>
        {t('learningCenter.empty.title')}
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <PromotionBanner stats={data.stats} />
      <CarouselBanner banners={data.banners} />
      <div className="mt-6 flex gap-6">
        <div className="flex-1">
          <LearningTabs courseCategories={data.courseCategories} documentCategories={data.documentCategories} />
        </div>
        <div className="w-80 shrink-0">
          <HotSearchPanel items={hotItems} onRefresh={refreshHotItems} noMore={noMoreHotItems} />
        </div>
      </div>
    </div>
  )
}

export default LearningCenterPage
