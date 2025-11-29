import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const user = useQuery(api.auth.loggedInUser);

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" aria-hidden />
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-8 text-center space-y-3">
        <p className="text-lg font-semibold text-gray-900">로그인이 필요해요</p>
        <p className="text-sm text-gray-600">익명 로그인 후 다시 시도해주세요.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold">
          {(user.name || user.email || "A").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-gray-600">프로필</p>
          <p className="text-lg font-semibold text-gray-900">{user.name || "이름 없음"}</p>
          {user.email && <p className="text-sm text-gray-600">{user.email}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <dt className="text-gray-500">User ID</dt>
          <dd className="font-mono text-gray-900 break-all">{user._id}</dd>
        </div>
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
          <dt className="text-gray-500">Auth status</dt>
          <dd className="text-gray-900">Signed in</dd>
        </div>
      </dl>
    </div>
  );
}
