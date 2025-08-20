import { supabase } from './supabase'

export const setupDeepLinkHandler = async () => {
  // Tauri 데스크톱 앱 전용 deep link 처리

  try {
    const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
    const { getCurrentWindow } = await import('@tauri-apps/api/window')

    // Deep link 이벤트 리스너 등록
    onOpenUrl((urls) => {
    console.log('Deep link received:', urls)
    
    urls.forEach(async (url) => {
      if (url.startsWith('english-punch://auth/callback')) {
        try {
          // URL에서 fragment를 추출하여 Supabase에 전달
          const urlObj = new URL(url.replace('english-punch://', 'http://localhost/'))
          const hashParams = new URLSearchParams(urlObj.hash.substring(1))
          
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            // Supabase 세션 설정
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            
            if (error) {
              console.error('Error setting session:', error)
            } else {
              console.log('Authentication successful:', data)
              // 앱 창을 포커스로 가져오기
              const appWindow = getCurrentWindow()
              await appWindow.setFocus()
              await appWindow.show()
            }
          }
        } catch (error) {
          console.error('Error processing deep link:', error)
        }
      }
    })
    })
  } catch (error) {
    console.error('Error setting up deep link handler:', error)
  }
}

export const handleAuthCallback = async (url: string) => {
  try {
    const { data, error } = await supabase.auth.getSessionFromUrl(url)
    
    if (error) {
      console.error('Error getting session from URL:', error)
      return false
    }
    
    if (data.session) {
      console.log('Authentication successful')
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error handling auth callback:', error)
    return false
  }
}