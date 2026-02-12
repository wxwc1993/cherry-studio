import type { PresentationConfig } from '@cherry-studio/enterprise-shared'
import { loggerService } from '@logger'
import Scrollbar from '@renderer/components/Scrollbar'
import { InputNumber, Select } from 'antd'
import type { FC } from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('SettingsPanel')

interface SettingsPanelProps {
  config: PresentationConfig
  onChange: (config: PresentationConfig) => void
  disabled?: boolean
}

const IMAGE_STYLE_OPTIONS = [
  { value: 'realistic', labelKey: 'presentations.settings.image_style.realistic' },
  { value: 'illustration', labelKey: 'presentations.settings.image_style.illustration' },
  { value: 'flat', labelKey: 'presentations.settings.image_style.flat' },
  { value: '3d', labelKey: 'presentations.settings.image_style.3d' },
  { value: 'watercolor', labelKey: 'presentations.settings.image_style.watercolor' },
  { value: 'minimalist', labelKey: 'presentations.settings.image_style.minimalist' }
]

const IMAGE_RATIO_OPTIONS = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' }
]

const LANGUAGE_OPTIONS = [
  { value: 'zh-CN', labelKey: 'presentations.settings.language.zh_cn' },
  { value: 'en-US', labelKey: 'presentations.settings.language.en_us' },
  { value: 'ja-JP', labelKey: 'presentations.settings.language.ja_jp' }
]

const THEME_OPTIONS = [
  { value: 'business', labelKey: 'presentations.settings.theme.business' },
  { value: 'academic', labelKey: 'presentations.settings.theme.academic' },
  { value: 'creative', labelKey: 'presentations.settings.theme.creative' },
  { value: 'minimal', labelKey: 'presentations.settings.theme.minimal' },
  { value: 'tech', labelKey: 'presentations.settings.theme.tech' }
]

const SettingsPanel: FC<SettingsPanelProps> = ({ config, onChange, disabled = false }) => {
  const { t } = useTranslation()

  const updateConfig = useCallback(
    (key: string, value: unknown) => {
      const updated = { ...config, [key]: value }
      onChange(updated)
      logger.info('Config updated', { key, value: String(value) })
    },
    [config, onChange]
  )

  return (
    <Container>
      <SectionTitle>{t('presentations.settings.title')}</SectionTitle>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.theme_label')}</FieldLabel>
        <Select
          value={config.theme || 'business'}
          onChange={(value) => updateConfig('theme', value)}
          disabled={disabled}
          size="small"
          style={{ width: '100%' }}
          options={THEME_OPTIONS.map((opt) => ({
            value: opt.value,
            label: t(opt.labelKey)
          }))}
        />
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.language_label')}</FieldLabel>
        <Select
          value={config.language || 'zh-CN'}
          onChange={(value) => updateConfig('language', value)}
          disabled={disabled}
          size="small"
          style={{ width: '100%' }}
          options={LANGUAGE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: t(opt.labelKey)
          }))}
        />
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.page_count')}</FieldLabel>
        <InputNumber
          value={config.pageCount || 10}
          onChange={(value) => updateConfig('pageCount', value)}
          disabled={disabled}
          size="small"
          min={3}
          max={30}
          style={{ width: '100%' }}
        />
      </FieldGroup>

      <Divider />
      <SectionTitle>{t('presentations.settings.image_title')}</SectionTitle>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.image_style_label')}</FieldLabel>
        <Select
          value={config.imageStyle || 'realistic'}
          onChange={(value) => updateConfig('imageStyle', value)}
          disabled={disabled}
          size="small"
          style={{ width: '100%' }}
          options={IMAGE_STYLE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: t(opt.labelKey)
          }))}
        />
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.image_ratio')}</FieldLabel>
        <Select
          value={config.imageRatio || '16:9'}
          onChange={(value) => updateConfig('imageRatio', value)}
          disabled={disabled}
          size="small"
          style={{ width: '100%' }}
          options={IMAGE_RATIO_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label
          }))}
        />
      </FieldGroup>

      <Divider />
      <SectionTitle>{t('presentations.settings.model_title')}</SectionTitle>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.text_model')}</FieldLabel>
        <Select
          value={config.textModelId}
          onChange={(value) => updateConfig('textModelId', value)}
          disabled={disabled}
          size="small"
          placeholder={t('presentations.settings.model_placeholder')}
          allowClear
          style={{ width: '100%' }}
        />
        <FieldHint>{t('presentations.settings.text_model_hint')}</FieldHint>
      </FieldGroup>

      <FieldGroup>
        <FieldLabel>{t('presentations.settings.image_model')}</FieldLabel>
        <Select
          value={config.imageModelId}
          onChange={(value) => updateConfig('imageModelId', value)}
          disabled={disabled}
          size="small"
          placeholder={t('presentations.settings.model_placeholder')}
          allowClear
          style={{ width: '100%' }}
        />
        <FieldHint>{t('presentations.settings.image_model_hint')}</FieldHint>
      </FieldGroup>
    </Container>
  )
}

const Container = styled(Scrollbar)`
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const SectionTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-1);
  margin-bottom: 8px;
  user-select: none;
`

const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
`

const FieldLabel = styled.label`
  font-size: 12px;
  color: var(--color-text-2);
  user-select: none;
`

const FieldHint = styled.span`
  font-size: 11px;
  color: var(--color-text-3);
`

const Divider = styled.div`
  height: 0.5px;
  background-color: var(--color-border);
  margin: 8px 0;
`

export default SettingsPanel
