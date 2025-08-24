import { useState, useEffect } from "react";
import { Doc } from "../../../convex/_generated/dataModel";

interface QuizSessionProps {
  word: Doc<"words"> & { progress?: Doc<"userWordProgress"> };
  allWords: (Doc<"words"> & { progress?: Doc<"userWordProgress"> })[];
  onAnswer: (isCorrect: boolean, difficulty: "easy" | "medium" | "hard") => void;
}

export function QuizSession({ word, allWords, onAnswer }: QuizSessionProps) {
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // Generate multiple choice options
    const correctAnswer = word.definition;
    const wrongAnswers = allWords
      .filter(w => w._id !== word._id)
      .map(w => w.definition)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const allOptions = [correctAnswer, ...wrongAnswers].sort(() => 0.5 - Math.random());
    setOptions(allOptions);
    setSelectedAnswer(null);
    setShowResult(false);
  }, [word, allWords]);

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const isCorrect = answer === word.definition;
    setTimeout(() => {
      onAnswer(isCorrect, isCorrect ? "easy" : "medium");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{word.word}</h2>
        {word.pronunciation && (
          <p className="text-lg text-gray-600 mb-2">/{word.pronunciation}/</p>
        )}
        <p className="text-sm text-gray-500 uppercase tracking-wide">{word.partOfSpeech}</p>
      </div>

      <div className="text-center">
        <p className="text-lg text-gray-700 mb-6">What does this word mean?</p>
      </div>

      <div className="space-y-3">
        {options.map((option, index) => {
          let buttonClass = "w-full p-4 text-left border rounded-lg transition-colors ";
          
          if (showResult) {
            if (option === word.definition) {
              buttonClass += "bg-green-100 border-green-500 text-green-800";
            } else if (option === selectedAnswer) {
              buttonClass += "bg-red-100 border-red-500 text-red-800";
            } else {
              buttonClass += "bg-gray-100 border-gray-300 text-gray-600";
            }
          } else {
            buttonClass += "bg-white border-gray-300 hover:bg-gray-50 text-gray-900";
          }

          return (
            <button
              key={index}
              onClick={() => !showResult && handleAnswerSelect(option)}
              disabled={showResult}
              className={buttonClass}
            >
              {option}
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className="text-center p-4 rounded-lg bg-gray-50">
          {selectedAnswer === word.definition ? (
            <p className="text-green-700 font-medium">Correct! 🎉</p>
          ) : (
            <p className="text-red-700 font-medium">Incorrect. The correct answer is highlighted above.</p>
          )}
        </div>
      )}
    </div>
  );
}
