// Export main classes
export { CDPClient } from "./CDPClient.js"

export { CDPConnectionPool } from "./ConnectionPool.js"
export { CDPEventManager } from "./EventManager.js"
export { CDPResourceManager, ResourceType } from "./ResourceManager.js"
export { CDPTargetManager } from "./TargetManager.js"
// Export all types and interfaces
export type {
  CDPCommandResult,
  CDPConnectionConfig,
  CDPConnectionPoolConfig,
  CDPEvaluateOptions,
  CDPEventListener,
  CDPEvents,
  CDPLogger,
  CDPSession,
  CDPTarget,
  CDPWebSocket,
} from "./types.js"

// Note: CDPClient is exported as a class from CDPClient.ts

// Export enums and values
export { CDPConnectionStatus } from "./types.js"
