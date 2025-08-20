declare global {
  interface Window {
    // Tauri v2 global objects
    __TAURI__?: any;
    __TAURI_INTERNALS__?: any;
    __TAURI_METADATA__?: any;
    isTauri?: boolean;
    
    // Tauri v2 API
    __TAURI_IPC__?: any;
  }
}

// Tauri v2 environment detection
export interface TauriEnvironment {
  isTauri: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  isTauriMobile: boolean;
  isTauriDesktop: boolean;
  isBrowser: boolean;
}

export {};