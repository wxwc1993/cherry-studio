import { Empty } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { LcCourseCategory } from '../hooks/useLearningCenter'
import CourseCard from './CourseCard'

interface CourseTabProps {
  categories: LcCourseCategory[]
}

const CourseTab: FC<CourseTabProps> = ({ categories }) => {
  const { t } = useTranslation()

  if (categories.length === 0) {
    return <Empty description={t('learningCenter.empty.courses')} className="py-12" />
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.id}>
          <h3 className="mb-3 font-semibold text-base" style={{ color: 'var(--color-text-1)' }}>
            {category.name}
          </h3>
          {category.courses.length === 0 ? (
            <Empty description={t('learningCenter.empty.courses')} className="py-6" />
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {category.courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default CourseTab
