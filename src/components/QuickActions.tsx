interface QuickActionsProps {
  onStartStudy: (
    mode: "flashcards" | "quiz" | "spelling" | "definition_match",
    wordListId?: string
  ) => void;
  onViewLists: () => void;
  onViewProgress: () => void;
  wordsForReview: number;
}

export function QuickActions({
  onStartStudy,
  onViewLists,
  wordsForReview,
}: QuickActionsProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Quick Actions
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onStartStudy("flashcards")}
          className="flex flex-col items-center p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <div className="text-2xl mb-2">🃏</div>
          <span className="font-medium text-blue-900">Flashcards</span>
          <span className="text-sm text-blue-600">Quick review</span>
        </button>

        <button
          onClick={() => onStartStudy("quiz")}
          className="flex flex-col items-center p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
        >
          <div className="text-2xl mb-2">❓</div>
          <span className="font-medium text-green-900">Quiz</span>
          <span className="text-sm text-green-600">Test knowledge</span>
        </button>

        <button
          onClick={() => onStartStudy("spelling")}
          className="flex flex-col items-center p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
        >
          <div className="text-2xl mb-2">✏️</div>
          <span className="font-medium text-purple-900">Spelling</span>
          <span className="text-sm text-purple-600">Practice writing</span>
        </button>

        <button
          onClick={onViewLists}
          className="flex flex-col items-center p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors"
        >
          <div className="text-2xl mb-2">📝</div>
          <span className="font-medium text-orange-900">Word Lists</span>
          <span className="text-sm text-orange-600">Manage vocabulary</span>
        </button>
      </div>

      {wordsForReview > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-yellow-900">
                Words Due for Review
              </h3>
              <p className="text-sm text-yellow-700">
                You have {wordsForReview} words ready for spaced repetition
                review
              </p>
            </div>
            <button
              onClick={() => onStartStudy("flashcards")}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Review Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
