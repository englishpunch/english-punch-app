import { onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const setupDeepLinkHandler = async () => {
  // Tauri 데스크톱 앱 전용 deep link 처리

  try {
    // Deep link 이벤트 리스너 등록
    await onOpenUrl((urls) => {
      console.log("Deep link received:", urls);

      const handleUrls = async () => {
        for (const url of urls) {
          if (url.startsWith("english-punch://auth/callback")) {
            try {
              // URL에서 fragment를 추출하여 Supabase에 전달
              const urlObj = new URL(
                url.replace("english-punch://", "http://localhost/")
              );
              const hashParams = new URLSearchParams(urlObj.hash.substring(1));

              const accessToken = hashParams.get("access_token");
              const refreshToken = hashParams.get("refresh_token");

              if (accessToken && refreshToken) {
                const appWindow = getCurrentWindow();
                await appWindow.setFocus();
                await appWindow.show();
              }
            } catch (error) {
              console.error("Error processing deep link:", error);
            }
          }
        }
      };

      void handleUrls();
    });
  } catch (error) {
    console.error("Error setting up deep link handler:", error);
  }
};

export const handleAuthCallback = async (_url: string) => {
  // noop
};
