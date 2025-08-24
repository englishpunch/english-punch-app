import { useState } from "react";
import { Doc } from "../../../convex/_generated/dataModel";

interface SpellingSessionProps {
  word: Doc<"words"> & { progress?: Doc<"userWordProgress"> };
  onAnswer: (isCorrect: boolean, difficulty: "easy" | "medium" | "hard") => void;
}

export function SpellingSession({ word, onAnswer }: SpellingSessionProps) {
  const [userInput, setUserInput] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correct = userInput.toLowerCase().trim() === word.word.toLowerCase();
    setIsCorrect(correct);
    setShowResult(true);
    
    setTimeout(() => {
      onAnswer(correct, correct ? "easy" : "medium");
      setUserInput("");
      setShowResult(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <p className="text-lg text-gray-700 mb-4">Listen and spell the word:</p>
        <div className="bg-gray-50 p-6 rounded-lg">
          <p className="text-xl text-gray-900 mb-2">{word.definition}</p>
          {word.pronunciation && (
            <p className="text-gray-600">/{word.pronunciation}/</p>
          )}
          <p className="text-sm text-gray-500 mt-2 uppercase tracking-wide">{word.partOfSpeech}</p>
        </div>
      </div>

      {word.examples && word.examples.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="font-medium text-blue-900 mb-2">Example context:</p>
          <p className="text-blue-800 italic">"{word.examples[0]}"</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type the word here..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center text-xl"
            disabled={showResult}
            autoFocus
          />
        </div>
        
        {!showResult && (
          <button
            type="submit"
            disabled={!userInput.trim()}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Check Spelling
          </button>
        )}
      </form>

      {showResult && (
        <div className={`text-center p-4 rounded-lg ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
          {isCorrect ? (
            <div>
              <p className="text-green-700 font-medium text-lg">Correct! 🎉</p>
              <p className="text-green-600">Well done!</p>
            </div>
          ) : (
            <div>
              <p className="text-red-700 font-medium text-lg">Incorrect</p>
              <p className="text-red-600">The correct spelling is: <span className="font-bold">{word.word}</span></p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
