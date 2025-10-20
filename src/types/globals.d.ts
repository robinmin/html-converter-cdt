/**
 * Global type declarations for browser and worker APIs
 * that may not be available in all environments
 */

// Extend global namespace with browser and worker APIs
declare global {
  // Make globalThis indexable
  // eslint-disable-next-line vars-on-top
  var globalThis: typeof globalThis & {
    [key: string]: any
  }

  // Chrome Extension API
  const chrome: any

  // Web Worker API
  function importScripts(...urls: string[]): void

  interface Window {
    [key: string]: any
  }

  interface Global {
    [key: string]: any
  }
}

export {}
