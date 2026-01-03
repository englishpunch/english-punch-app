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
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const stats = useQuery(
    api.learning.getBagDetailStats,
    userId ? { userId, bagId } : "skip"
  );

  if (stats === undefined) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            샌드백을 찾을 수 없습니다
          </h2>
          <p className="mb-6 text-gray-600">
            요청하신 샌드백이 존재하지 않거나 접근 권한이 없습니다.
          </p>
          <Button onClick={onBack} className="px-6">
            돌아가기
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
      label: "매우 쉬움",
      value: difficultyDistribution.veryEasy,
      barClass: "bg-primary-700",
    },
    {
      label: "쉬움",
      value: difficultyDistribution.easy,
      barClass: "bg-primary-600",
    },
    {
      label: "보통",
      value: difficultyDistribution.medium,
      barClass: "bg-primary-500",
    },
    {
      label: "어려움",
      value: difficultyDistribution.hard,
      barClass: "bg-primary-400",
    },
    {
      label: "매우 어려움",
      value: difficultyDistribution.veryHard,
      barClass: "bg-primary-300",
    },
  ];

  const stabilityData = [
    {
      label: "매우 낮음",
      value: stabilityDistribution.veryLow,
      barClass: "bg-primary-300",
    },
    {
      label: "낮음",
      value: stabilityDistribution.low,
      barClass: "bg-primary-400",
    },
    {
      label: "보통",
      value: stabilityDistribution.medium,
      barClass: "bg-primary-500",
    },
    {
      label: "높음",
      value: stabilityDistribution.high,
      barClass: "bg-primary-600",
    },
    {
      label: "매우 높음",
      value: stabilityDistribution.veryHigh,
      barClass: "bg-primary-700",
    },
  ];

  const repsData = [
    { label: "새 카드", value: repsDistribution.new, barClass: "bg-gray-400" },
    {
      label: "초급 (1-3회)",
      value: repsDistribution.beginner,
      barClass: "bg-primary-400",
    },
    {
      label: "중급 (4-10회)",
      value: repsDistribution.intermediate,
      barClass: "bg-primary-500",
    },
    {
      label: "고급 (11-20회)",
      value: repsDistribution.advanced,
      barClass: "bg-primary-600",
    },
    {
      label: "전문가 (21회+)",
      value: repsDistribution.expert,
      barClass: "bg-primary-700",
    },
  ];

  const lapsesData = [
    {
      label: "완벽 (0회)",
      value: lapsesDistribution.perfect,
      barClass: "bg-primary-700",
    },
    {
      label: "가끔 (1-2회)",
      value: lapsesDistribution.occasional,
      barClass: "bg-primary-500",
    },
    {
      label: "자주 (3-5회)",
      value: lapsesDistribution.frequent,
      barClass: "bg-primary-400",
    },
    {
      label: "문제 (6회+)",
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
          샌드백 목록으로 돌아가기
        </Button>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-gray-900">
            {bagInfo.name} 통계
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
          title="전체 카드"
          value={cardStats.totalCards}
          tone="muted"
          icon={<SquareStack className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title="새 카드"
          value={cardStats.newCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Sparkles className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title="학습 중"
          value={cardStats.learningCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Target className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title="복습 카드"
          value={cardStats.reviewCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<RefreshCcw className="h-5 w-5" aria-hidden />}
        />
      </div>

      {/* 추가 통계 카드들 */}
      <div className="grid grid-cols-1 gap-4">
        <StatCard
          title="재학습 중"
          value={cardStats.relearningCards}
          total={cardStats.totalCards}
          tone="danger"
          icon={<RotateCcw className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title="복습 예정"
          value={cardStats.dueCards}
          total={cardStats.totalCards}
          tone="primary"
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
        />
        <StatCard
          title="정지된 카드"
          value={cardStats.suspendedCards}
          total={cardStats.totalCards}
          tone="muted"
          icon={<PauseCircle className="h-5 w-5" aria-hidden />}
        />
      </div>

      {/* 분포 차트들 */}
      <div className="grid grid-cols-1 gap-6">
        <DistributionBar
          title="난이도 분포"
          data={difficultyData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title="기억 안정성 분포"
          data={stabilityData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title="학습 경험 분포"
          data={repsData}
          total={cardStats.totalCards}
        />
        <DistributionBar
          title="실수 빈도 분포"
          data={lapsesData}
          total={cardStats.totalCards}
        />
      </div>

      {/* 샌드백 정보 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-inner">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          샌드백 정보
        </h3>
        <div className="text-sm">
          <div>
            <span className="text-gray-600">마지막 수정:</span>
            <span className="ml-2 font-medium">
              {new Date(bagInfo.lastModified).toLocaleDateString("ko-KR")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
