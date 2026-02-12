import type { FC } from 'react'
import { Route, Routes } from 'react-router-dom'

import PresentationCreatePage from './PresentationCreatePage'
import PresentationEditorPage from './PresentationEditorPage'
import PresentationListPage from './PresentationListPage'

const PresentationsRoutePage: FC = () => {
  return (
    <Routes>
      <Route path="/" element={<PresentationListPage />} />
      <Route path="/create" element={<PresentationCreatePage />} />
      <Route path="/:id" element={<PresentationEditorPage />} />
    </Routes>
  )
}

export default PresentationsRoutePage
