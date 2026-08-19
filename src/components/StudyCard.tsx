import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./Button";
import { Select } from "./Input";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";
import { Ban, MoveRight } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

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
  onReveal?: (elapsedSinceQuestionMs: number) => void;
  onGrade: (rating: 1 | 2 | 3 | 4, duration: number) => void;
  onDisable?: () => void | Promise<void>;
  onMoveToBag?: (targetBagId: Id<"bags">) => void | Promise<void>;
  moveTargetBags?: Array<{ _id: Id<"bags">; name: string }>;
  isLoading?: boolean;
}

export default function StudyCard(props: StudyCardProps) {
  return (
    <StudyCardContent key={`${props.card._id}:${props.card.reps}`} {...props} />
  );
}

function StudyCardContent({
  card,
  onReveal,
  onGrade,
  onDisable,
  onMoveToBag,
  moveTargetBags = [],
  isLoading = false,
}: StudyCardProps) {
  const { t } = useTranslation();
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedMoveBagId, setSelectedMoveBagId] = useState<Id<"bags"> | "">(
    ""
  );
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
  }, []);

  const selectedMoveBagIdForAction =
    selectedMoveBagId &&
    moveTargetBags.some((bag) => bag._id === selectedMoveBagId)
      ? selectedMoveBagId
      : (moveTargetBags[0]?._id ?? "");

  const handleShowAnswer = useCallback(() => {
    const elapsedSinceQuestionMs = startTimeRef.current
      ? Date.now() - startTimeRef.current
      : 0;
    setShowAnswer(true);
    onReveal?.(elapsedSinceQuestionMs);
  }, [onReveal]);

  const handleGrade = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      const duration = startTimeRef.current
        ? Date.now() - startTimeRef.current
        : 0;
      onGrade(rating, duration);
    },
    [onGrade]
  );

  const handleMoveToBag = useCallback(() => {
    if (!selectedMoveBagIdForAction || !onMoveToBag) {
      return;
    }
    void onMoveToBag(selectedMoveBagIdForAction);
  }, [onMoveToBag, selectedMoveBagIdForAction]);

  const getRatingConfig = (rating: 1 | 2 | 3 | 4) => {
    const configs = {
      1: {
        label: t("ratings.labels.again"),
        className: "bg-red-500 hover:bg-red-600",
        description: t("ratings.descriptions.again"),
        variant: "danger" as const,
      },
      2: {
        label: t("ratings.labels.hard"),
        className: "bg-primary-500 hover:bg-primary-600",
        description: t("ratings.descriptions.hard"),
        variant: "plain" as const,
      },
      3: {
        label: t("ratings.labels.good"),
        className: "bg-primary-600 hover:bg-primary-700",
        description: t("ratings.descriptions.good"),
        variant: "plain" as const,
      },
      4: {
        label: t("ratings.labels.easy"),
        className: "bg-primary-700 hover:bg-primary-800",
        description: t("ratings.descriptions.easy"),
        variant: "plain" as const,
      },
    } as const;
    return configs[rating];
  };

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
      {/* Card header */}
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4">
        <div className="flex items-center">
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
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-8">
        {/* Question */}
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            {t("studyCard.sections.question")}
          </h2>
          <p className="text-xl leading-relaxed font-semibold text-gray-900">
            {card.question}
          </p>
        </div>

        {/* Hint */}
        {card.hint && !showAnswer && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-gray-500">
              {t("studyCard.sections.hint")}
            </h3>
            <p className="text-gray-600 italic">{card.hint}</p>
          </div>
        )}

        {/* Answer area */}
        {!showAnswer ? (
          <div className="text-center">
            <Button
              onClick={handleShowAnswer}
              className="px-8"
              disabled={isLoading}
            >
              {t("studyCard.showAnswer")}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Answer */}
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">
                {t("studyCard.sections.answer")}
              </h3>
              <p className="text-primary-700 text-xl font-semibold">
                {card.answer}
              </p>
            </div>

            {/* Explanation */}
            {card.explanation && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {t("studyCard.sections.explanation")}
                </h3>
                <p className="text-gray-700">{card.explanation}</p>
              </div>
            )}

            {/* Rating buttons */}
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
                      </div>
                    </Button>
                  );
                })}
              </div>

              {(onDisable || onMoveToBag) && (
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="mb-3 text-sm font-medium text-gray-700">
                    {t("studyCard.actions.title")}
                  </h4>
                  <div className="space-y-2">
                    {onDisable && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        fullWidth
                        className="gap-2"
                        disabled={isLoading}
                        onClick={() => void onDisable()}
                      >
                        <Ban className="h-4 w-4" aria-hidden />
                        {t("studyCard.actions.disable")}
                      </Button>
                    )}
                    {onMoveToBag && (
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <label className="sr-only" htmlFor="move-card-bag">
                          {t("studyCard.actions.moveTo")}
                        </label>
                        <Select
                          id="move-card-bag"
                          value={selectedMoveBagIdForAction}
                          disabled={isLoading || moveTargetBags.length === 0}
                          onChange={(event) =>
                            setSelectedMoveBagId(
                              event.currentTarget.value as Id<"bags">
                            )
                          }
                          aria-label={t("studyCard.actions.moveTo")}
                        >
                          {moveTargetBags.length === 0 ? (
                            <option value="">
                              {t("studyCard.actions.noOtherBags")}
                            </option>
                          ) : (
                            moveTargetBags.map((bag) => (
                              <option key={bag._id} value={bag._id}>
                                {bag.name}
                              </option>
                            ))
                          )}
                        </Select>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                          disabled={isLoading || !selectedMoveBagIdForAction}
                          onClick={handleMoveToBag}
                          aria-label={t("studyCard.actions.move")}
                        >
                          <MoveRight className="h-4 w-4" aria-hidden />
                          {t("studyCard.actions.move")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Rating guide */}
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

      {/* Loading overlay */}
      {isLoading && <Spinner size="lg" wrapper="overlay" />}
    </div>
  );
}
