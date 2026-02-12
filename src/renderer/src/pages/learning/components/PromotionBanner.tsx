import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { LcStats } from '../hooks/useLearningCenter'

interface PromotionBannerProps {
  stats: LcStats
}

const PromotionBanner: FC<PromotionBannerProps> = ({ stats }) => {
  const { t } = useTranslation()

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-8 py-6 text-white">
      <div className="relative z-10">
        <h2 className="font-bold text-2xl">{t('learningCenter.promotion.title')}</h2>
        <p className="mt-1 text-white/80">{t('learningCenter.promotion.subtitle')}</p>
        <div className="mt-4 flex gap-8">
          <StatItem value={stats.totalCourses} label={t('learningCenter.stats.courses')} />
          <StatItem value={stats.totalDocuments} label={t('learningCenter.stats.documents')} />
          <StatItem value={stats.totalViews} label={t('learningCenter.stats.views')} />
        </div>
      </div>
      <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-white/10 to-transparent" />
    </div>
  )
}

const StatItem: FC<{ value: number; label: string }> = ({ value, label }) => (
  <div className="flex items-baseline gap-1">
    <span className="font-bold text-2xl">{value.toLocaleString()}</span>
    <span className="text-sm text-white/70">{label}</span>
  </div>
)

export default PromotionBanner
