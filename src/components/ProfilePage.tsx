import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";

export default function ProfilePage() {
  const { t } = useTranslation();
  const user = useQuery(api.auth.loggedInUser);

  if (user === undefined) {
    return <Spinner wrapper="page" />;
  }

  if (user === null) {
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-gray-900">
          {t("profilePage.loginRequiredTitle")}
        </p>
        <p className="text-sm text-gray-600">
          {t("profilePage.loginRequiredDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-primary-100 text-primary-700 flex h-12 w-12 items-center justify-center rounded-full font-semibold">
          {(user.name || user.email || "A").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <p className="text-sm text-gray-600">{t("profilePage.title")}</p>
          <p className="text-lg font-semibold text-gray-900">
            {user.name || t("profilePage.noName")}
          </p>
          {user.email && <p className="text-sm text-gray-600">{user.email}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <dt className="text-gray-500">{t("common.labels.userId")}</dt>
          <dd className="font-mono break-all text-gray-900">{user._id}</dd>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <dt className="text-gray-500">{t("profilePage.authStatus")}</dt>
          <dd className="text-gray-900">{t("profilePage.signedIn")}</dd>
        </div>
      </dl>
    </div>
  );
}
