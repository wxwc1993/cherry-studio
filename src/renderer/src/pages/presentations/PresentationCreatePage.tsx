import { ArrowLeftOutlined, BulbOutlined, FileTextOutlined, OrderedListOutlined } from '@ant-design/icons'
import type { PresentationConfig, PresentationCreationType } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import { Navbar, NavbarCenter, NavbarLeft } from '@renderer/components/app/Navbar'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { createPresentation, selectPresentationLoading } from '@renderer/store/presentations'
import { Button, Input, Steps } from 'antd'
import type { FC } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import SettingsPanel from './components/SettingsPanel'
import TemplateSelector from './components/TemplateSelector'

const logger = loggerService.withContext('PresentationCreatePage')

interface CreationTypeOption {
  type: PresentationCreationType
  titleKey: string
  descKey: string
  icon: React.ReactNode
  placeholderKey: string
}

const CREATION_TYPES: CreationTypeOption[] = [
  {
    type: 'idea',
    titleKey: 'presentations.create.type.idea',
    descKey: 'presentations.create.type.idea_desc',
    icon: <BulbOutlined />,
    placeholderKey: 'presentations.create.type.idea_placeholder'
  },
  {
    type: 'outline',
    titleKey: 'presentations.create.type.outline',
    descKey: 'presentations.create.type.outline_desc',
    icon: <OrderedListOutlined />,
    placeholderKey: 'presentations.create.type.outline_placeholder'
  },
  {
    type: 'description',
    titleKey: 'presentations.create.type.description',
    descKey: 'presentations.create.type.description_desc',
    icon: <FileTextOutlined />,
    placeholderKey: 'presentations.create.type.description_placeholder'
  }
]

const PresentationCreatePage: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const loading = useAppSelector(selectPresentationLoading)

  const [currentStep, setCurrentStep] = useState(0)
  const [title, setTitle] = useState('')
  const [creationType, setCreationType] = useState<PresentationCreationType>('idea')
  const [sourceContent, setSourceContent] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>()
  const [config, setConfig] = useState<PresentationConfig>({
    theme: 'business',
    language: 'zh-CN',
    pageCount: 10,
    imageStyle: 'realistic',
    imageRatio: '16:9'
  })

  const steps = useMemo(
    () => [
      { title: t('presentations.create.step.basic') },
      { title: t('presentations.create.step.template') },
      { title: t('presentations.create.step.settings') }
    ],
    [t]
  )

  const selectedCreationType = useMemo(() => CREATION_TYPES.find((ct) => ct.type === creationType), [creationType])

  const canGoNext = useMemo(() => {
    if (currentStep === 0) {
      return title.trim().length > 0
    }
    return true
  }, [currentStep, title])

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }, [currentStep, steps.length])

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleBack = useCallback(() => {
    navigate('/presentations')
  }, [navigate])

  const handleCreate = useCallback(async () => {
    try {
      const finalConfig: PresentationConfig = {
        ...config,
        templateId: selectedTemplateId
      }

      const result = await dispatch(
        createPresentation({
          title: title.trim(),
          creationType,
          config: finalConfig,
          sourceContent: sourceContent.trim() || undefined
        })
      ).unwrap()

      logger.info('Presentation created', { id: result.id, creationType })
      navigate(`/presentations/${result.id}`)
    } catch (error) {
      logger.error('Failed to create presentation', { error: String(error) })
    }
  }, [config, creationType, dispatch, navigate, selectedTemplateId, sourceContent, title])

  const handleTemplateSelect = useCallback((template: { id: string }) => {
    setSelectedTemplateId(template.id)
  }, [])

  const renderBasicStep = () => (
    <StepContent>
      <FormGroup>
        <FormLabel>{t('presentations.create.title_label')}</FormLabel>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('presentations.create.title_placeholder')}
          size="large"
          maxLength={300}
          showCount
        />
      </FormGroup>

      <FormGroup>
        <FormLabel>{t('presentations.create.type_label')}</FormLabel>
        <TypeGrid>
          {CREATION_TYPES.map((option) => (
            <TypeCard
              key={option.type}
              $selected={creationType === option.type}
              onClick={() => setCreationType(option.type)}>
              <TypeIcon>{option.icon}</TypeIcon>
              <TypeTitle>{t(option.titleKey)}</TypeTitle>
              <TypeDesc>{t(option.descKey)}</TypeDesc>
            </TypeCard>
          ))}
        </TypeGrid>
      </FormGroup>

      <FormGroup>
        <FormLabel>{t('presentations.create.content_label')}</FormLabel>
        <Input.TextArea
          value={sourceContent}
          onChange={(e) => setSourceContent(e.target.value)}
          placeholder={selectedCreationType ? t(selectedCreationType.placeholderKey) : ''}
          rows={6}
          maxLength={50000}
          showCount
        />
        <FormHint>{t('presentations.create.content_hint')}</FormHint>
      </FormGroup>
    </StepContent>
  )

  const renderTemplateStep = () => (
    <StepContent>
      <FormGroup>
        <FormLabel>{t('presentations.create.template_label')}</FormLabel>
        <FormHint>{t('presentations.create.template_hint')}</FormHint>
        <TemplateSelector selectedId={selectedTemplateId} onSelect={handleTemplateSelect} />
      </FormGroup>
    </StepContent>
  )

  const renderSettingsStep = () => (
    <StepContent>
      <SettingsPanel config={config} onChange={setConfig} />
    </StepContent>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicStep()
      case 1:
        return renderTemplateStep()
      case 2:
        return renderSettingsStep()
      default:
        return null
    }
  }

  return (
    <Container>
      <Navbar>
        <NavbarLeft>
          <BackButton type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
            {t('common.back')}
          </BackButton>
        </NavbarLeft>
        <NavbarCenter style={{ borderRight: 'none' }}>{t('presentations.create.title')}</NavbarCenter>
      </Navbar>

      <ContentArea>
        <StepsContainer>
          <Steps current={currentStep} items={steps} size="small" />
        </StepsContainer>

        <ScrollArea>{renderStepContent()}</ScrollArea>

        <Footer>
          <Button onClick={currentStep === 0 ? handleBack : handlePrev}>
            {currentStep === 0 ? t('common.cancel') : t('presentations.create.prev')}
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button type="primary" onClick={handleNext} disabled={!canGoNext}>
              {t('presentations.create.next')}
            </Button>
          ) : (
            <Button type="primary" onClick={handleCreate} loading={loading.creating} disabled={!canGoNext}>
              {t('presentations.create.submit')}
            </Button>
          )}
        </Footer>
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

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const StepsContainer = styled.div`
  padding: 16px 40px 0;
  flex-shrink: 0;
`

const ScrollArea = styled(Scrollbar)`
  flex: 1;
  padding: 16px 40px;
`

const StepContent = styled.div`
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
`

const FormGroup = styled.div`
  margin-bottom: 20px;
`

const FormLabel = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 8px;
  user-select: none;
`

const FormHint = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  margin-top: 4px;
  margin-bottom: 8px;
`

const TypeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
`

const TypeCard = styled.div<{ $selected?: boolean }>`
  padding: 16px;
  border: 2px solid ${({ $selected }) => ($selected ? 'var(--color-primary)' : 'var(--color-border)')};
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
  background-color: ${({ $selected }) => ($selected ? 'var(--color-primary-bg)' : 'transparent')};

  &:hover {
    border-color: var(--color-primary);
  }
`

const TypeIcon = styled.div`
  font-size: 24px;
  margin-bottom: 8px;
  color: var(--color-primary);
`

const TypeTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
  margin-bottom: 4px;
`

const TypeDesc = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 40px;
  border-top: 0.5px solid var(--color-border);
  flex-shrink: 0;
`

const BackButton = styled(Button)`
  font-size: 13px;
`

export default PresentationCreatePage
