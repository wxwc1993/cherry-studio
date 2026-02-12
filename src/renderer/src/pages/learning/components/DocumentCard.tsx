import { Tag } from 'antd'
import { ExternalLink, Eye, FileText, User } from 'lucide-react'
import type { FC } from 'react'

import type { LcDocument } from '../hooks/useLearningCenter'

interface DocumentCardProps {
  document: LcDocument
}

const PLACEHOLDER_COVER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180"%3E%3Crect fill="%23f3f4f6" width="320" height="180"/%3E%3Ctext x="160" y="90" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle" font-size="14"%3ENo Cover%3C/text%3E%3C/svg%3E'

const DocumentCard: FC<DocumentCardProps> = ({ document }) => {
  const handleClick = () => {
    if (/^https?:\/\//i.test(document.linkUrl)) {
      window.open(document.linkUrl, '_blank')
    }
  }

  const linkIcon = document.linkType === 'external' ? <ExternalLink size={12} /> : <FileText size={12} />

  return (
    <div
      className="cursor-pointer overflow-hidden rounded-lg border border-solid transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--color-border)' }}
      onClick={handleClick}>
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <img
          src={document.coverUrl ?? PLACEHOLDER_COVER}
          alt={document.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = PLACEHOLDER_COVER
          }}
        />
        {document.isRecommended && (
          <Tag color="red" className="absolute top-2 left-2">
            HOT
          </Tag>
        )}
      </div>
      <div className="p-3">
        <h4 className="line-clamp-2 font-medium text-sm" style={{ color: 'var(--color-text-1)' }}>
          {document.title}
        </h4>
        <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-3)' }}>
          {document.author && (
            <span className="flex items-center gap-1">
              <User size={12} />
              {document.author}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {document.viewCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">{linkIcon}</span>
        </div>
      </div>
    </div>
  )
}

export default DocumentCard
