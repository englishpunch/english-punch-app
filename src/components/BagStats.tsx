import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  PauseCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  SquareStack,
  Target,
} from "lucide-react";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";
import { getLocaleForLanguage } from "@/i18n";

interface BagStatsProps {
  bagId: Id<"bags">;
  onBack: () => void;
}

interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  tone?: "primary" | "muted" | "danger";
  icon?: React.ReactNode;
}

function StatCard({
  title,
  value,
  total,
  tone = "primary",
  icon,
}: StatCardProps) {
  const percentage =
    total && total > 0 ? ((value / total) * 100).toFixed(1) : null;
  const accentClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "muted"
        ? "text-gray-700"
        : "text-primary-700";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className={accentClass}>{icon}</div>}
      </div>
      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl font-semibold ${accentClass}`}>{value}</span>
        {total && (
          <span className="text-sm text-gray-500">
            / {total} ({percentage}%)
          </span>
        )}
      </div>
    </div>
  );
}

interface DistributionBarProps {
  title: string;
  data: Array<{ label: string; value: number; barClass: string }>;
  total: number;
}

function DistributionBar({ title, data, total }: DistributionBarProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">{title}</h3>
      <div className="space-y-3">
        {data.map((item) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex flex-1 items-center space-x-3">
                <span className="w-20 text-sm font-medium text-gray-700">
                  {item.label}
                </span>
                <div className="h-2 flex-1 rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full ${item.barClass}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="ml-3 flex items-center space-x-2">
                <span className="text-sm font-semibold text-gray-900">
                  {item.value}
                </span>
                <span className="text-xs text-gray-500">
                  ({percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BagStats({ bagId, onBack }: BagStatsProps) {
  const { t, i18n } = useTranslation();
  const locale = getLocaleForLanguage(i18n.language);
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const stats = useQuery(
    api.learning.getBagDetailStats,
    userId ? { userId, bagId } : "skip"
  );

  if (stats === undefined) {
    return <Spinner wrapper="page" />;
  }

  if (stats === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            {t("bagStats.notFoundTitle")}
          </h2>
          <p className="mb-6 text-gray-600">
            {t("bagStats.notFoundDescription")}
          </p>
          <Button onClick={onBack} className="px-6">
            {t("bagStats.back")}
          </Button>
        </div>
      </div>
    );
  }

  const {
    bagInfo,
    cardStats,
    difficultyDistribution,
    stabilityDistribution,
    repsDistribution,
    lapsesDistribution,
  } = stats;

  // 분포 데이터 정리
  const difficultyData = [
    {
      label: t("bagStats.difficultyLabels.veryEasy"),
      value: difficultyDistribution.veryEasy,
      barClass: "bg-primary-700",
    },
    {
      label: t("bagStats.difficultyLabels.easy"),
      value: difficultyDistribution.easy,
      barClass: "bg-primary-600",
    },
    {
      label: t("bagStats.difficultyLabels.medium"),
      value: difficultyDistribution.medium,
      barClass: "bg-primary-500",
    },
    {
      label: t("bagStats.difficultyLabels.hard"),
      value: difficultyDistribution.hard,
      barClass: "bg-primary-400",
    },
    {
      label: t("bagStats.difficultyLabels.veryHard"),
      value: difficultyDistribution.veryHard,
      barClass: "bg-primary-300",
    },
  ];

  const stabilityData = [
    {
      label: t("bagStats.stabilityLabels.veryLow"),
      value: stabilityDistribution.veryLow,
      barClass: "bg-primary-300",
    },
    {
      label: t("bagStats.stabilityLabels.low"),
      value: stabilityDistribution.low,
      barClass: "bg-primary-400",
    },
    {
      label: t("bagStats.stabilityLabels.medium"),
      value: stabilityDistribution.medium,
      barClass: "bg-primary-500",
    },
    {
      label: t("bagStats.stabilityLabels.high"),
      value: stabilityDistribution.high,
      barClass: "bg-primary-600",
    },
    {
      label: t("bagStats.stabilityLabels.veryHigh"),
      value: stabilityDistribution.veryHigh,
      barClass: "bg-primary-700",
    },
  ];

  const repsData = [
    {
      label: t("bagStats.repsLabels.new"),
      value: repsDistribution.new,
      barClass: "bg-gray-400",
    },
    {
      label: t("bagStats.repsLabels.beginner"),
      value: repsDistribution.beginner,
      barClass: "bg-primary-400",
    },
    {
      label: t("bagStats.repsLabels.intermediate"),
      value: repsDistribution.intermediate,
      barClass: "bg-primary-500",
    },
    {
      label: t("bagStats.repsLabels.advanced"),
      value: repsDistribution.advanced,
      barClass: "bg-primary-600",
    },
    {
      label: t("bagStats.repsLabels.expert"),
      value: repsDistribution.expert,
      barClass: "bg-primary-700",
    },
  ];

  const lapsesData = [
    {
      label: t("bagStats.lapsesLabels.perfect"),
      value: lapsesDistribution.perfect,
      barClass: "bg-primary-700",
    },
    {
      label: t("bagStats.lapsesLabels.occasional"),
      value: lapsesDistribution.occasional,
      barClass: "bg-primary-500",
    },
    {
      label: t("bagStats.lapsesLabels.frequent"),
      value: lapsesDistribution.frequent,
      barClass: "bg-primary-400",
    },
    {
      label: t("bagStats.lapsesLabels.problematic"),
      value: lapsesDistribution.problematic,
      barClass: "bg-red-500",
    },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
      {/* 헤더 */}
      <div className="space-y-4">
        <Button
          onClick={onBack}
          variant="ghost"
          size="sm"
          className="text-primary-700 hover:text-primary-800 gap-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("bagStats.backToList")}
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">
            {t("bagStats.title", { name: bagInfo.name })}
          </h1>
          <p className="text-base leading-6 text-gray-600">
            {bagInfo.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {bagInfo.tags.map((tag) => (
              <span
                key={tag}
                className="bg-primary-50 text-primary-700 rounded-full px-2 py-1 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 기본 통계 카드들 */}
      <div className="grid grid-cols-1 gap-4">
        <StatCard
          title={t("bagStats.cards.total")}
          value={cardStats.totalCards}
          tone="muted"
          icon={<SquareStack className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title={t("bagStats.cards.new")}
          value={cardStats.newCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Sparkles className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title={t("bagStats.cards.learning")}
          value={cardStats.learningCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Target className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title={t("bagStats.cards.review")}
          value={cardStats.reviewCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<RefreshCcw className="h-5 w-5" aria-hidden />}
        />
      </div>

      {/* 추가 통계 카드들 */}
      <div className="grid grid-cols-1 gap-4">
        <StatCard
          title={t("bagStats.cards.relearning")}
          value={cardStats.relearningCards}
          total={cardStats.totalCards}
          tone="danger"
          icon={<RotateCcw className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title={t("bagStats.cards.due")}
          value={cardStats.dueCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title={t("bagStats.cards.suspended")}
          value={cardStats.suspendedCards}
          total={cardStats.totalCards}
          tone="muted"
          icon={<PauseCircle className="h-5 w-5" aria-hidden />}
        />
      </div>

      {/* 분포 차트들 */}
      <div className="grid grid-cols-1 gap-6">
        <DistributionBar
          title={t("bagStats.distributions.difficulty")}
          data={difficultyData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title={t("bagStats.distributions.stability")}
          data={stabilityData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title={t("bagStats.distributions.reps")}
          data={repsData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title={t("bagStats.distributions.lapses")}
          data={lapsesData}
          total={cardStats.totalCards}
        />
      </div>

      {/* 샌드백 정보 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-inner">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("bagStats.infoTitle")}
        </h3>
        <div className="text-sm">
          <div>
            <span className="text-gray-600">{t("bagStats.lastModified")}:</span>
            <span className="ml-2 font-medium">
              {new Date(bagInfo.lastModified).toLocaleDateString(locale)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
