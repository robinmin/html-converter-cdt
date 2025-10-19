/**
 * Core Engine Module - Chrome DevTools Protocol integration
 * Provides MHTML processing capabilities with Chrome CDP support
 */

export { ChromeCDPManager } from "./chrome-cdp-manager.js"
export type {
  ChromeCDPManagerConfig,
  ChromeProcess,
} from "./chrome-cdp-manager.js"
export { MHTMLProcessor } from "./mhtml-processor.js"
export type {
  CDPCaptureConfig,
  PageCaptureMetadata,
} from "./mhtml-processor.js"
