// 服务模块导出
export type { BackupOptions, RestoreOptions } from './backup.service'
export { backupService } from './backup.service'
export { cryptoService } from './crypto.service'
export { documentProcessorService } from './document-processor.service'
export type { AlertLevel } from './feishu-alert.service'
export { feishuAlertService } from './feishu-alert.service'
export { fetchRemoteModels } from './model-fetch.service'
export { presentationService } from './presentation.service'
export { presentationFileService } from './presentation-file.service'
export type {
  ExportedFile,
  GeneratedDescriptions,
  GeneratedImage,
  GeneratedImages,
  GeneratedOutline,
  ParsedReferenceFile
} from './presentation-proxy.service'
export { FlaskWorkerError, FlaskWorkerUnavailableError, presentationProxyService } from './presentation-proxy.service'
export { presentationTaskService } from './presentation-task.service'
export { quotaAlertService } from './quota-alert.service'
export type { StorageConfig, StorageMetadata, StorageObject, StorageService } from './storage'
export { getStorageService, resetStorageService } from './storage'
export type { DocumentChunk, SearchResult } from './vector.service'
export { vectorService } from './vector.service'
