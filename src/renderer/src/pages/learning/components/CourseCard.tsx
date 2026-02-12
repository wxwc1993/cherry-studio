import { Tag } from 'antd'
import { Clock, Eye, User } from 'lucide-react'
import type { FC } from 'react'

import type { LcCourse } from '../hooks/useLearningCenter'

interface CourseCardProps {
  course: LcCourse
}

const PLACEHOLDER_COVER =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="180"%3E%3Crect fill="%23f3f4f6" width="320" height="180"/%3E%3Ctext x="160" y="90" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle" font-size="14"%3ENo Cover%3C/text%3E%3C/svg%3E'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const CourseCard: FC<CourseCardProps> = ({ course }) => {
  const handleClick = () => {
    if (/^https?:\/\//i.test(course.videoUrl)) {
      window.open(course.videoUrl, '_blank')
    }
  }

  return (
    <div
      className="cursor-pointer overflow-hidden rounded-lg border border-solid transition-shadow hover:shadow-md"
      style={{ borderColor: 'var(--color-border)' }}
      onClick={handleClick}>
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        <img
          src={course.coverUrl ?? PLACEHOLDER_COVER}
          alt={course.title}
          className="h-full w-full object-cover"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = PLACEHOLDER_COVER
          }}
        />
        <div className="absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-white text-xs">
          {formatDuration(course.duration)}
        </div>
        {course.isRecommended && (
          <Tag color="red" className="absolute top-2 left-2">
            HOT
          </Tag>
        )}
      </div>
      <div className="p-3">
        <h4 className="line-clamp-2 font-medium text-sm" style={{ color: 'var(--color-text-1)' }}>
          {course.title}
        </h4>
        <div className="mt-2 flex items-center gap-3 text-xs" style={{ color: 'var(--color-text-3)' }}>
          {course.author && (
            <span className="flex items-center gap-1">
              <User size={12} />
              {course.author}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye size={12} />
            {course.viewCount.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formatDuration(course.duration)}
          </span>
        </div>
      </div>
    </div>
  )
}

export default CourseCard
