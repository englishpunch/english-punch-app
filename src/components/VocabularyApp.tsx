import { Id } from "../../convex/_generated/dataModel";
import DeckManager from "./DeckManager";

interface VocabularyAppProps {
  userId: Id<"users">;
}

export function VocabularyApp({ userId }: VocabularyAppProps) {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8">
      <section className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 shadow-lg text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl">🧠</div>
            <h1 className="text-3xl font-bold">스마트 간격 반복 학습</h1>
            <p className="text-blue-100">
              플래시카드나 퀴즈 없이, FSRS 기반 간격 반복으로 단어를 가장 효율적으로 익히세요.
              덱을 선택하고 바로 학습을 시작할 수 있습니다.
            </p>
          </div>
          <div className="self-start md:self-center bg-white/10 backdrop-blur px-4 py-3 rounded-lg text-sm text-blue-50 border border-white/20">
            <div className="font-semibold">지금 가능한 작업</div>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>샘플 덱 생성 후 FSRS 학습</li>
              <li>새/학습/복습 카드 진행</li>
              <li>덱별 상세 통계 확인</li>
            </ul>
          </div>
        </div>
      </section>

      <DeckManager userId={userId} />
    </div>
  );
}
