import { useState } from "react";
import { Doc } from "../../../convex/_generated/dataModel";

interface FlashcardSessionProps {
  word: Doc<"words"> & { progress?: Doc<"userWordProgress"> };
  onAnswer: (isCorrect: boolean, difficulty: "easy" | "medium" | "hard") => void;
}

export function FlashcardSession({ word, onAnswer }: FlashcardSessionProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  const handleDifficultySelect = (difficulty: "easy" | "medium" | "hard") => {
    const isCorrect = difficulty !== "hard";
    onAnswer(isCorrect, difficulty);
    setShowAnswer(false);
  };

  return (
    <div className="text-center space-y-6">
      <div className="min-h-[200px] flex flex-col justify-center">
        {!showAnswer ? (
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{word.word}</h2>
            {word.pronunciation && (
              <p className="text-lg text-gray-600 mb-4">/{word.pronunciation}/</p>
            )}
            <p className="text-sm text-gray-500 uppercase tracking-wide">{word.partOfSpeech}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">{word.word}</h2>
            <p className="text-lg text-gray-700">{word.definition}</p>
            {word.examples && word.examples.length > 0 && (
              <div className="text-left bg-gray-50 p-4 rounded-lg">
                <p className="font-medium text-gray-900 mb-2">Examples:</p>
                {word.examples.slice(0, 2).map((example, index) => (
                  <p key={index} className="text-gray-700 italic">
                    "{example}"
                  </p>
                ))}
              </div>
            )}
            {word.synonyms && word.synonyms.length > 0 && (
              <p className="text-sm text-gray-600">
                <span className="font-medium">Synonyms:</span> {word.synonyms.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {!showAnswer ? (
        <button
          onClick={() => setShowAnswer(true)}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Show Answer
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">How well did you know this word?</p>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => handleDifficultySelect("hard")}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Hard
            </button>
            <button
              onClick={() => handleDifficultySelect("medium")}
              className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors"
            >
              Medium
            </button>
            <button
              onClick={() => handleDifficultySelect("easy")}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              Easy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
