import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc, Id } from "../../convex/_generated/dataModel";
import { FlashcardSession } from "./study/FlashcardSession";
import { QuizSession } from "./study/QuizSession";
import { SpellingSession } from "./study/SpellingSession";

interface StudySessionProps {
  mode: "flashcards" | "quiz" | "spelling" | "definition_match";
  wordListId: string | null;
  onComplete: () => void;
  onBack: () => void;
}

export function StudySession({ mode, wordListId, onComplete, onBack }: StudySessionProps) {
  const [words, setWords] = useState<(Doc<"words"> & { progress?: Doc<"userWordProgress"> })[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionData, setSessionData] = useState({
    correctAnswers: 0,
    totalQuestions: 0,
    startTime: Date.now(),
    wordsStudied: [] as Id<"words">[],
  });

  const wordsFromList = useQuery(
    api.words.getWordsFromList,
    wordListId ? { wordListId: wordListId as Id<"userWordLists"> } : "skip"
  );
  const wordsForReview = useQuery(api.vocabulary.getWordsForReview, { limit: 20 });
  const randomWords = useQuery(api.words.getRandomWords, { count: 10 });

  const createStudySession = useMutation(api.studySessions.createStudySession);
  const updateWordProgress = useMutation(api.vocabulary.updateWordProgress);

  useEffect(() => {
    let wordsToUse: (Doc<"words"> & { progress?: Doc<"userWordProgress"> })[] = [];
    
    if (wordListId && wordsFromList) {
      wordsToUse = wordsFromList.filter(word => word && word._id) as any;
    } else if (wordsForReview && wordsForReview.length > 0) {
      wordsToUse = wordsForReview.filter(word => word && word._id) as any;
    } else if (randomWords) {
      wordsToUse = randomWords.map(word => ({ ...word, progress: undefined }));
    }

    if (wordsToUse.length > 0) {
      setWords(wordsToUse);
      setSessionData(prev => ({
        ...prev,
        totalQuestions: wordsToUse.length,
      }));
    }
  }, [wordListId, wordsFromList, wordsForReview, randomWords]);

  const handleAnswer = async (isCorrect: boolean, difficulty: "easy" | "medium" | "hard") => {
    const currentWord = words[currentIndex];
    if (!currentWord) return;

    // Update word progress
    await updateWordProgress({
      wordId: currentWord._id,
      isCorrect,
      difficulty,
    });

    // Update session data
    setSessionData(prev => ({
      ...prev,
      correctAnswers: prev.correctAnswers + (isCorrect ? 1 : 0),
      wordsStudied: [...prev.wordsStudied, currentWord._id],
    }));

    // Move to next word or complete session
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      await completeSession();
    }
  };

  const completeSession = async () => {
    const duration = Math.floor((Date.now() - sessionData.startTime) / 1000);
    
    await createStudySession({
      wordListId: wordListId as Id<"userWordLists"> | undefined,
      sessionType: mode,
      wordsStudied: sessionData.wordsStudied,
      correctAnswers: sessionData.correctAnswers,
      totalQuestions: sessionData.totalQuestions,
      duration,
    });

    onComplete();
  };

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
        <p className="text-gray-600">Loading words...</p>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>
        <div className="text-center">
          <h1 className="text-xl font-semibold capitalize">
            {mode.replace('_', ' ')} Session
          </h1>
          <p className="text-sm text-gray-600">
            {currentIndex + 1} of {words.length}
          </p>
        </div>
        <div className="text-sm text-gray-600">
          Score: {sessionData.correctAnswers}/{sessionData.wordsStudied.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Study Component */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        {mode === "flashcards" && (
          <FlashcardSession
            word={currentWord}
            onAnswer={handleAnswer}
          />
        )}
        {mode === "quiz" && (
          <QuizSession
            word={currentWord}
            allWords={words}
            onAnswer={handleAnswer}
          />
        )}
        {mode === "spelling" && (
          <SpellingSession
            word={currentWord}
            onAnswer={handleAnswer}
          />
        )}
      </div>
    </div>
  );
}
