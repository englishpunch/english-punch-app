import { useState, useEffect } from "react";
import { onAuthStateChange, getCurrentUser, signOut } from "./lib/auth";
import Auth from "./components/Auth";
import AuthCallback from "./components/AuthCallback";
import "./App.css";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 사용자 확인
    getCurrentUser().then((user) => {
      setUser(user);
      setLoading(false);
    });

    // 인증 상태 변화 감지
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 인증 콜백 처리
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  // 로그인하지 않은 경우
  if (!user) {
    return <Auth />;
  }

  // 메인 앱
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                English Punch 🥊
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-md text-sm font-medium text-gray-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                환영합니다! 🎉
              </h2>
              <p className="text-gray-600">
                English Punch 앱이 성공적으로 설정되었습니다.
              </p>
              <p className="text-gray-600 mt-2">
                이제 학습 기능을 추가할 준비가 되었습니다.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
