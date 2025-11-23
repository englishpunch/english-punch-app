import { Brain } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";
import BagManager from "./BagManager";

interface VocabularyAppProps {
  userId: Id<"users">;
}

export function VocabularyApp({ userId }: VocabularyAppProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <section className="bg-linear-to-br from-gray-50 via-white to-gray-100 border border-gray-200 rounded-lg p-8 shadow">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center">
              <Brain className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-sm font-medium text-primary-700">
              FSRS spaced repetition
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-gray-900 leading-tight">
            스마트 간격 반복 학습
          </h1>
          <p className="text-base leading-6 text-gray-600">
            플래시카드나 퀴즈 없이도, FSRS 기반 간격 반복으로 단어를 가장
            효율적으로 익히세요. 샌드백을 선택하면 바로 학습을 시작할 수 있어요.
          </p>
        </div>
      </section>

      <BagManager userId={userId} />
    </div>
  );
}
