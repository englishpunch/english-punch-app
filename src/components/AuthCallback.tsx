import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  useEffect(() => {
    const handleAuthCallback = async () => {
      const { data, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Authentication error:', error)
        window.location.href = '/'
        return
      }
      
      if (data.session) {
        // 인증 성공 시 메인 페이지로 리다이렉트
        window.location.href = '/'
      } else {
        // 세션이 없으면 로그인 페이지로 리다이렉트
        window.location.href = '/'
      }
    }

    handleAuthCallback()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  )
}