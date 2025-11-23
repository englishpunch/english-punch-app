import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface DeckStatsProps {
  userId: Id<"users">;
  deckId: Id<"decks">;
  onBack: () => void;
}

interface StatCardProps {
  title: string;
  value: number;
  total?: number;
  color: string;
  icon?: React.ReactNode;
}

function StatCard({ title, value, total, color, icon }: StatCardProps) {
  const percentage = total && total > 0 ? (value / total * 100).toFixed(1) : null;
  
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className={`text-${color}-500`}>{icon}</div>}
      </div>
      <div className="flex items-baseline space-x-2">
        <span className={`text-2xl font-bold text-${color}-600`}>{value}</span>
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
  data: Array<{ label: string; value: number; color: string }>;
  total: number;
}

function DistributionBar({ title, data, total }: DistributionBarProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.map((item) => {
          const percentage = total > 0 ? (item.value / total * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1">
                <span className="text-sm font-medium text-gray-700 w-20">{item.label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-${item.color}-500`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-3">
                <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                <span className="text-xs text-gray-500">({percentage.toFixed(1)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DeckStats({ userId, deckId, onBack }: DeckStatsProps) {
  const stats = useQuery(api.learning.getDeckDetailStats, { userId, deckId });

  if (stats === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">덱을 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-6">요청하신 덱이 존재하지 않거나 접근 권한이 없습니다.</p>
          <button
            onClick={onBack}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const { deckInfo, cardStats, difficultyDistribution, stabilityDistribution, repsDistribution, lapsesDistribution } = stats;

  // 분포 데이터 정리
  const difficultyData = [
    { label: '매우 쉬움', value: difficultyDistribution.veryEasy, color: 'green' },
    { label: '쉬움', value: difficultyDistribution.easy, color: 'blue' },
    { label: '보통', value: difficultyDistribution.medium, color: 'yellow' },
    { label: '어려움', value: difficultyDistribution.hard, color: 'orange' },
    { label: '매우 어려움', value: difficultyDistribution.veryHard, color: 'red' },
  ];

  const stabilityData = [
    { label: '매우 낮음', value: stabilityDistribution.veryLow, color: 'red' },
    { label: '낮음', value: stabilityDistribution.low, color: 'orange' },
    { label: '보통', value: stabilityDistribution.medium, color: 'yellow' },
    { label: '높음', value: stabilityDistribution.high, color: 'blue' },
    { label: '매우 높음', value: stabilityDistribution.veryHigh, color: 'green' },
  ];

  const repsData = [
    { label: '새 카드', value: repsDistribution.new, color: 'gray' },
    { label: '초급 (1-3회)', value: repsDistribution.beginner, color: 'blue' },
    { label: '중급 (4-10회)', value: repsDistribution.intermediate, color: 'green' },
    { label: '고급 (11-20회)', value: repsDistribution.advanced, color: 'purple' },
    { label: '전문가 (21회+)', value: repsDistribution.expert, color: 'yellow' },
  ];

  const lapsesData = [
    { label: '완벽 (0회)', value: lapsesDistribution.perfect, color: 'green' },
    { label: '가끔 (1-2회)', value: lapsesDistribution.occasional, color: 'blue' },
    { label: '자주 (3-5회)', value: lapsesDistribution.frequent, color: 'orange' },
    { label: '문제 (6회+)', value: lapsesDistribution.problematic, color: 'red' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="flex items-center text-blue-600 hover:text-blue-700 mb-4 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              덱 목록으로 돌아가기
            </button>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{deckInfo.name} 통계</h1>
            <p className="text-gray-600">{deckInfo.description}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {deckInfo.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-blue-100 text-blue-600 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 기본 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="전체 카드"
          value={cardStats.totalCards}
          color="gray"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" /></svg>}
        />
        <StatCard
          title="새 카드"
          value={cardStats.newCards}
          total={cardStats.totalCards}
          color="blue"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          title="학습 중"
          value={cardStats.learningCards}
          total={cardStats.totalCards}
          color="orange"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          title="복습 카드"
          value={cardStats.reviewCards}
          total={cardStats.totalCards}
          color="green"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
        />
      </div>

      {/* 추가 통계 카드들 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="재학습 중"
          value={cardStats.relearningCards}
          total={cardStats.totalCards}
          color="red"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          title="복습 예정"
          value={cardStats.dueCards}
          total={cardStats.totalCards}
          color="purple"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>}
        />
        <StatCard
          title="정지된 카드"
          value={cardStats.suspendedCards}
          total={cardStats.totalCards}
          color="gray"
          icon={<svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" /></svg>}
        />
      </div>

      {/* 분포 차트들 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

      {/* 덱 정보 */}
      <div className="bg-gray-50 rounded-lg p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">덱 정보</h3>
        <div className="text-sm">
          <div>
            <span className="text-gray-600">마지막 수정:</span>
            <span className="ml-2 font-medium">
              {new Date(deckInfo.lastModified).toLocaleDateString('ko-KR')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
