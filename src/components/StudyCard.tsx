import React, { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface StudyCardProps {
  card: {
    _id: string;
    question: string;
    answer: string;
    hint?: string;
    explanation?: string;
    state: number;
    reps: number;
  };
  onGrade: (rating: 1 | 2 | 3 | 4, duration: number) => void;
  isLoading?: boolean;
}

export default function StudyCard(props: StudyCardProps) {
  return <StudyCardContent key={props.card._id} {...props} />;
}

function StudyCardContent({
  card,
  onGrade,
  isLoading = false,
}: StudyCardProps) {
  const { t } = useTranslation();
  const [showAnswer, setShowAnswer] = useState(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  const handleShowAnswer = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleGrade = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      const duration = startTimeRef.current
        ? Date.now() - startTimeRef.current
        : 0;
      onGrade(rating, duration);
    },
    [onGrade]
  );

  const getRatingConfig = (rating: 1 | 2 | 3 | 4) => {
    const configs = {
      1: {
        label: t("ratings.labels.again"),
        className: "bg-red-500 hover:bg-red-600",
        description: t("ratings.descriptions.again"),
        shortcut: "1",
        variant: "danger" as const,
      },
      2: {
        label: t("ratings.labels.hard"),
        className: "bg-primary-500 hover:bg-primary-600",
        description: t("ratings.descriptions.hard"),
        shortcut: "2",
        variant: "plain" as const,
      },
      3: {
        label: t("ratings.labels.good"),
        className: "bg-primary-600 hover:bg-primary-700",
        description: t("ratings.descriptions.good"),
        shortcut: "3",
        variant: "plain" as const,
      },
      4: {
        label: t("ratings.labels.easy"),
        className: "bg-primary-700 hover:bg-primary-800",
        description: t("ratings.descriptions.easy"),
        shortcut: "4",
        variant: "plain" as const,
      },
    } as const;
    return configs[rating];
  };

  // 키보드 단축키
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!showAnswer) {
        if (event.code === "Space") {
          event.preventDefault();
          handleShowAnswer();
        }
        return;
      }

      // 답이 보일 때만 평가 가능
      if (event.key >= "1" && event.key <= "4") {
        event.preventDefault();
        const rating = parseInt(event.key) as 1 | 2 | 3 | 4;
        handleGrade(rating);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [handleGrade, handleShowAnswer, showAnswer]);

  const getStateLabel = (state: number) => {
    const labels = [
      t("studyCard.state.new"),
      t("studyCard.state.learning"),
      t("studyCard.state.review"),
      t("studyCard.state.relearning"),
    ];
    return labels[state] || t("studyCard.state.unknown");
  };

  const getStateColor = (state: number) => {
    const colors = [
      "bg-gray-100 text-gray-800", // New
      "bg-primary-50 text-primary-700", // Learning
      "bg-primary-100 text-primary-700", // Review
      "bg-gray-200 text-gray-800", // Relearning
    ];
    return colors[state] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="relative w-full overflow-hidden border-y border-gray-200 bg-white">
      {/* 카드 헤더 */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "rounded-full px-2 py-1 text-xs font-medium",
                getStateColor(card.state)
              )}
            >
              {getStateLabel(card.state)}
            </span>
            <span className="text-sm text-gray-600">
              {t("studyCard.reps", { count: card.reps })}
            </span>
          </div>
          <div className="text-xs font-medium text-gray-600">
            {!showAnswer && t("studyCard.shortcuts.showAnswer")}
            {showAnswer && t("studyCard.shortcuts.grade")}
          </div>
        </div>
      </div>

      {/* 카드 본문 */}
      <div className="px-6 py-8">
        {/* 문제 */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            {t("studyCard.sections.question")}
          </h2>
          <p className="text-xl leading-relaxed font-semibold text-gray-900">
            {card.question}
          </p>
        </div>

        {/* 힌트 */}
        {card.hint && !showAnswer && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              {t("studyCard.sections.hint")}
            </h3>
            <p className="text-gray-600 italic">{card.hint}</p>
          </div>
        )}

        {/* 답 영역 */}
        {!showAnswer ? (
          <div className="text-center">
            <Button
              onClick={handleShowAnswer}
              className="px-8"
              disabled={isLoading}
            >
              {t("studyCard.showAnswer")}{" "}
              <span className="text-sm opacity-80">
                {t("studyCard.showAnswerShortcut")}
              </span>
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 정답 */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">
                {t("studyCard.sections.answer")}
              </h3>
              <p className="text-primary-700 text-xl font-semibold">
                {card.answer}
              </p>
            </div>

            {/* 설명 */}
            {card.explanation && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {t("studyCard.sections.explanation")}
                </h3>
                <p className="text-gray-700">{card.explanation}</p>
              </div>
            )}

            {/* 평가 버튼들 */}
            <div className="pt-4">
              <h3 className="mb-4 text-center text-sm font-medium text-gray-500">
                {t("studyCard.ratingPrompt")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {([1, 2, 3, 4] as const).map((rating) => {
                  const config = getRatingConfig(rating);
                  return (
                    <Button
                      key={rating}
                      onClick={() => handleGrade(rating)}
                      disabled={isLoading}
                      variant={config.variant}
                      className={cn(
                        "px-4 py-3 text-white shadow-sm",
                        config.className
                      )}
                    >
                      <div className="text-center">
                        <div className="font-bold">{config.label}</div>
                        <div className="mt-1 text-xs opacity-90">
                          {config.description}
                        </div>
                        <div className="mt-1 text-xs opacity-75">
                          {t("studyCard.ratingShortcut", {
                            shortcut: config.shortcut,
                          })}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>

              {/* 평가 가이드 */}
              <div className="mt-6 rounded-lg bg-gray-50 p-4">
                <h4 className="mb-2 text-sm font-medium text-gray-700">
                  {t("ratings.guide.title")}
                </h4>
                <div className="space-y-1 text-xs text-gray-600">
                  <div>{t("ratings.guide.again")}</div>
                  <div>{t("ratings.guide.hard")}</div>
                  <div>{t("ratings.guide.good")}</div>
                  <div>{t("ratings.guide.easy")}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 로딩 오버레이 */}
      {isLoading && (
        <div className="bg-opacity-75 absolute inset-0 flex items-center justify-center bg-white">
          <Loader2 className="text-primary-600 h-10 w-10 animate-spin" />
        </div>
      )}
    </div>
  );
}
