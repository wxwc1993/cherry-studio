import { Empty } from 'antd'
import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import type { LcDocumentCategory } from '../hooks/useLearningCenter'
import DocumentCard from './DocumentCard'

interface DocumentTabProps {
  categories: LcDocumentCategory[]
}

const DocumentTab: FC<DocumentTabProps> = ({ categories }) => {
  const { t } = useTranslation()

  if (categories.length === 0) {
    return <Empty description={t('learningCenter.empty.documents')} className="py-12" />
  }

  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category.id}>
          <h3 className="mb-3 font-semibold text-base" style={{ color: 'var(--color-text-1)' }}>
            {category.name}
          </h3>
          {category.documents.length === 0 ? (
            <Empty description={t('learningCenter.empty.documents')} className="py-6" />
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {category.documents.map((doc) => (
                <DocumentCard key={doc.id} document={doc} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default DocumentTab
