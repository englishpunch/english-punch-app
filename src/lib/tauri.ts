/**
 * Tauri v2 환경 감지 유틸리티
 */

// Tauri 환경인지 확인
export const isTauri = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    "__TAURI__" in window ||
    "isTauri" in window ||
    "__TAURI_INTERNALS__" in window
  );
};

// 모바일 환경인지 확인
export const isMobile = (): boolean => {
  return navigator.maxTouchPoints > 0;
};

// 데스크톱 환경인지 확인
export const isDesktop = (): boolean => {
  return !isMobile();
};

// Tauri 모바일 앱인지 확인
export const isTauriMobile = (): boolean => {
  return isTauri() && isMobile();
};

// Tauri 데스크톱 앱인지 확인
export const isTauriDesktop = (): boolean => {
  return isTauri() && isDesktop();
};

// 웹 브라우저 환경인지 확인
export const isBrowser = (): boolean => {
  return !isTauri();
};

// Tauri v2 API가 사용 가능한지 확인
export const hasTauriAPI = (): boolean => {
  if (!isTauri()) {
    return false;
  }

  try {
    return typeof window.__TAURI_INTERNALS__ !== "undefined";
  } catch {
    return false;
  }
};

// Tauri 플러그인이 사용 가능한지 확인
export const hasPlugin = (_pluginName: string): boolean => {
  if (!isTauri()) {
    return false;
  }

  try {
    // 동적 import를 통해 플러그인 존재 여부 확인
    return true; // 실제 확인은 동적 import 시점에서 처리
  } catch {
    return false;
  }
};
