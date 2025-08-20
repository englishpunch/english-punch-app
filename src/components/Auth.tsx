import { useState } from 'react'
import { signInWithGoogle } from '../lib/auth'

export default function Auth() {
  const [loading, setLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true)
      await signInWithGoogle()
    } catch (error) {
      console.error('Failed to sign in:', error)
      alert('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            English Punch 🥊
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            매일 꾸준한 영어 학습
          </p>
        </div>
        <div>
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중...' : 'Google로 로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}