import { Empty, Tag } from 'antd'
import { Flame, RefreshCw, Sparkles } from 'lucide-react'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { LcHotItem } from '../hooks/useLearningCenter'

interface HotSearchPanelProps {
  items: LcHotItem[]
  onRefresh: () => void
  noMore: boolean
}

function formatHeatValue(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`
  }
  return value.toLocaleString()
}

const HotSearchPanel: FC<HotSearchPanelProps> = ({ items, onRefresh, noMore }) => {
  const { t } = useTranslation()

  const handleItemClick = (item: LcHotItem) => {
    if (/^https?:\/\//i.test(item.linkUrl)) {
      window.open(item.linkUrl, '_blank')
    }
  }

  return (
    <div
      className="rounded-xl border border-solid p-4"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-2)' }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={18} style={{ color: 'var(--color-primary)' }} />
          <span className="font-semibold" style={{ color: 'var(--color-text-1)' }}>
            {t('learningCenter.hotSearch.title')}
          </span>
        </div>
        <button
          type="button"
          className="flex cursor-pointer items-center gap-1 border-none bg-transparent text-xs transition-colors hover:opacity-70"
          style={{ color: 'var(--color-text-3)' }}
          onClick={onRefresh}
          disabled={noMore}>
          <RefreshCw size={12} />
          {noMore ? t('learningCenter.hotSearch.noMore') : t('learningCenter.hotSearch.refresh')}
        </button>
      </div>

      {items.length === 0 ? (
        <Empty description={t('learningCenter.empty.hotSearch')} className="py-6" />
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-black/5"
              onClick={() => handleItemClick(item)}>
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-bold text-xs"
                style={{
                  backgroundColor: index < 3 ? 'var(--color-primary)' : 'var(--color-bg-3)',
                  color: index < 3 ? '#fff' : 'var(--color-text-3)'
                }}>
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--color-text-1)' }}>
                {item.title}
              </span>
              {item.tag === 'hot' && (
                <Tag color="red" className="shrink-0" style={{ marginInlineEnd: 0 }}>
                  {t('learningCenter.hotSearch.tagHot')}
                </Tag>
              )}
              {item.tag === 'new' && (
                <Tag color="blue" className="shrink-0" style={{ marginInlineEnd: 0 }}>
                  <Sparkles size={10} className="mr-0.5 inline" />
                  {t('learningCenter.hotSearch.tagNew')}
                </Tag>
              )}
              <span className="shrink-0 text-xs" style={{ color: 'var(--color-text-3)' }}>
                {formatHeatValue(item.heatValue)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HotSearchPanel
