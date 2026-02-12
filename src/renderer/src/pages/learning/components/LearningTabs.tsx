import { Tabs } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { LcCourseCategory, LcDocumentCategory } from '../hooks/useLearningCenter'
import CourseTab from './CourseTab'
import DocumentTab from './DocumentTab'

interface LearningTabsProps {
  courseCategories: LcCourseCategory[]
  documentCategories: LcDocumentCategory[]
}

const LearningTabs: FC<LearningTabsProps> = ({ courseCategories, documentCategories }) => {
  const { t } = useTranslation()

  const items = [
    {
      key: 'courses',
      label: t('learningCenter.tabs.courses'),
      children: <CourseTab categories={courseCategories} />
    },
    {
      key: 'documents',
      label: t('learningCenter.tabs.documents'),
      children: <DocumentTab categories={documentCategories} />
    }
  ]

  return <Tabs defaultActiveKey="courses" items={items} />
}

export default LearningTabs
