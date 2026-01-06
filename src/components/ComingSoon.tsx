import { useTranslation } from "react-i18next";

export default function ComingSoon({ label }: { label: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3 text-center">
      <p className="text-lg font-semibold text-gray-900">
        {t("comingSoon.title", { page: label })}
      </p>
      <p className="text-sm text-gray-600">{t("comingSoon.description")}</p>
    </div>
  );
}
