import React, { useEffect, useRef, useState, useCallback } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Spinner } from "./Spinner";
import { useTranslation } from "react-i18next";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Link } from "@tanstack/react-router";

const buildAskingPrompt = (value: string) => `What does "${value}" mean?`;

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
  const selectionContainerRef = useRef<HTMLDivElement | null>(null);
  const selectionAnchorRef = useRef<{
    getBoundingClientRect: () => DOMRect;
  }>({
    getBoundingClientRect: () => new DOMRect(),
  });
  const [selectionText, setSelectionText] = useState("");
  const [isSelectionPopoverOpen, setIsSelectionPopoverOpen] = useState(false);

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

  const closeSelectionPopover = useCallback(() => {
    setIsSelectionPopoverOpen(false);
    setSelectionText("");
  }, []);

  const openSelectionPopover = useCallback((text: string, rect: DOMRect) => {
    selectionAnchorRef.current = {
      getBoundingClientRect: () => rect,
    };
    setSelectionText(text);
    setIsSelectionPopoverOpen(true);
  }, []);

  const handleSelectionEvent = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      closeSelectionPopover();
      return;
    }

    const container = selectionContainerRef.current;
    if (!container || !selection.anchorNode || !selection.focusNode) {
      closeSelectionPopover();
      return;
    }

    if (
      !container.contains(selection.anchorNode) ||
      !container.contains(selection.focusNode)
    ) {
      return;
    }

    const text = selection.toString().replace(/\s+/g, " ").trim();
    if (!text) {
      closeSelectionPopover();
      return;
    }

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      closeSelectionPopover();
      return;
    }

    openSelectionPopover(text, rect);
  }, [closeSelectionPopover, openSelectionPopover]);

  const chatGptUrl = `https://chat.openai.com/?q=${encodeURIComponent(
    buildAskingPrompt(selectionText)
  )}`;

  const handleClickOpenChatgpt = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectionText) {
      return;
    }

    if (isTauri()) {
      void openUrl(chatGptUrl);
    } else {
      window.open(chatGptUrl, "_blank", "noopener,noreferrer");
    }

    closeSelectionPopover();
  };

  const handleClickShare = () => {
    if (!selectionText) {
      return;
    }
    if (navigator.share) {
      navigator
        .share({
          text: buildAskingPrompt(selectionText),
        })
        .then(() => console.log("Successful share"))
        .catch((error) => console.log("Error sharing", error));
    }
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
    <Popover.Root
      open={isSelectionPopoverOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeSelectionPopover();
          return;
        }
        setIsSelectionPopoverOpen(true);
      }}
    >
      <Popover.Anchor virtualRef={selectionAnchorRef} />
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
        <div
          ref={selectionContainerRef}
          onMouseUp={handleSelectionEvent}
          onKeyUp={handleSelectionEvent}
          onTouchEnd={handleSelectionEvent}
          className="px-6 py-8"
        >
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
        {isLoading && <Spinner size="lg" wrapper="overlay" />}
      </div>

      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          className="z-50 w-48 rounded border bg-white pb-1 shadow-lg outline-none"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <div className="mb-1 border-b px-3 py-2 text-xs font-semibold text-gray-500">
            {buildAskingPrompt(selectionText)}
          </div>
          <div className="grid">
            <Link
              to={chatGptUrl}
              onClick={handleClickOpenChatgpt}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-2 text-left text-sm font-bold transition hover:bg-gray-50"
            >
              {/* <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                viewBox="0 0 156 154"
                fill="none"
              >
                <path
                  d="M59.7325 56.1915V41.6219C59.7325 40.3948 60.1929 39.4741 61.266 38.8613L90.5592 21.9915C94.5469 19.6912 99.3013 18.6181 104.208 18.6181C122.612 18.6181 134.268 32.8813 134.268 48.0637C134.268 49.1369 134.268 50.364 134.114 51.5911L103.748 33.8005C101.908 32.7274 100.067 32.7274 98.2267 33.8005L59.7325 56.1915ZM128.133 112.937V78.1222C128.133 75.9745 127.212 74.441 125.372 73.3678L86.878 50.9768L99.4538 43.7682C100.527 43.1554 101.448 43.1554 102.521 43.7682L131.814 60.6381C140.25 65.5464 145.923 75.9745 145.923 86.0961C145.923 97.7512 139.023 108.487 128.133 112.935V112.937ZM50.6841 82.2638L38.1083 74.9028C37.0351 74.29 36.5748 73.3693 36.5748 72.1422V38.4025C36.5748 21.9929 49.1506 9.5696 66.1744 9.5696C72.6162 9.5696 78.5962 11.7174 83.6585 15.5511L53.4461 33.0352C51.6062 34.1084 50.6855 35.6419 50.6855 37.7897V82.2653L50.6841 82.2638ZM77.7533 97.9066L59.7325 87.785V66.3146L77.7533 56.193L95.7725 66.3146V87.785L77.7533 97.9066ZM89.3321 144.53C82.8903 144.53 76.9103 142.382 71.848 138.549L102.06 121.064C103.9 119.991 104.821 118.458 104.821 116.31V71.8343L117.551 79.1954C118.624 79.8082 119.084 80.7289 119.084 81.956V115.696C119.084 132.105 106.354 144.529 89.3321 144.529V144.53ZM52.9843 110.33L23.6911 93.4601C15.2554 88.5517 9.58181 78.1237 9.58181 68.0021C9.58181 56.193 16.6365 45.611 27.5248 41.163V76.1299C27.5248 78.2776 28.4455 79.8111 30.2854 80.8843L68.6271 103.121L56.0513 110.33C54.9781 110.943 54.0574 110.943 52.9843 110.33ZM51.2983 135.482C33.9681 135.482 21.2384 122.445 21.2384 106.342C21.2384 105.115 21.3923 103.888 21.5448 102.661L51.7572 120.145C53.5971 121.218 55.4385 121.218 57.2784 120.145L95.7725 97.9081V112.478C95.7725 113.705 95.3122 114.625 94.239 115.238L64.9458 132.108C60.9582 134.408 56.2037 135.482 51.2969 135.482H51.2983ZM89.3321 153.731C107.889 153.731 123.378 140.542 126.907 123.058C144.083 118.61 155.126 102.507 155.126 86.0976C155.126 75.3617 150.525 64.9336 142.243 57.4186C143.01 54.1977 143.471 50.9768 143.471 47.7573C143.471 25.8267 125.68 9.41567 105.129 9.41567C100.989 9.41567 97.0011 10.0285 93.0134 11.4095C86.1112 4.66126 76.6024 0.367188 66.1744 0.367188C47.6171 0.367188 32.1282 13.5558 28.5994 31.0399C11.4232 35.4879 0.380859 51.5911 0.380859 68.0006C0.380859 78.7365 4.98133 89.1645 13.2631 96.6795C12.4963 99.9004 12.036 103.121 12.036 106.341C12.036 128.271 29.8265 144.682 50.3777 144.682C54.5178 144.682 58.5055 144.07 62.4931 142.689C69.3938 149.437 78.9026 153.731 89.3321 153.731Z"
                  fill="currentColor"
                ></path>
              </svg> */}
              <span>Open ChatGPT</span>
            </Link>

            <button
              className="px-3 py-2 text-left text-sm font-bold transition hover:bg-gray-50"
              onClick={handleClickShare}
            >
              Share
            </button>
          </div>
          {/* <div className="mt-3 border-t border-gray-100 pt-3">
            <Button
              size="sm"
              variant="secondary"
              fullWidth
              disabled
              className="gap-2 text-gray-400"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Quick actions settings
            </Button>
          </div> */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
