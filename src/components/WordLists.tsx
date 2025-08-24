import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Doc } from "../../convex/_generated/dataModel";

interface WordListsProps {
  onBack: () => void;
  onStartStudy: (mode: "flashcards" | "quiz" | "spelling" | "definition_match", wordListId: string) => void;
}

export function WordLists({ onBack, onStartStudy }: WordListsProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");

  const wordLists = useQuery(api.vocabulary.getUserWordLists);
  const createWordList = useMutation(api.vocabulary.createWordList);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    await createWordList({
      name: newListName,
      description: newListDescription,
      isPublic: false,
    });

    setNewListName("");
    setNewListDescription("");
    setShowCreateForm(false);
  };

  if (wordLists === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          ← Back to Dashboard
        </button>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create New List
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Word Lists</h1>
        <p className="text-gray-600">Organize your vocabulary into custom lists</p>
      </div>

      {showCreateForm && (
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Create New Word List</h2>
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <form onSubmit={handleCreateList} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                List Name
              </label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Business Vocabulary"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (optional)
              </label>
              <textarea
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
                placeholder="Describe what this list is for..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create List
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {wordLists.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">No word lists yet</h3>
          <p className="text-gray-600 mb-6">Create your first word list to start organizing your vocabulary</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First List
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {wordLists.map((list) => (
            <WordListCard
              key={list._id}
              list={list}
              onStartStudy={onStartStudy}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface WordListCardProps {
  list: Doc<"userWordLists">;
  onStartStudy: (mode: "flashcards" | "quiz" | "spelling" | "definition_match", wordListId: string) => void;
}

function WordListCard({ list, onStartStudy }: WordListCardProps) {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border hover:shadow-md transition-shadow">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{list.name}</h3>
        {list.description && (
          <p className="text-sm text-gray-600 mt-1">{list.description}</p>
        )}
        <p className="text-sm text-gray-500 mt-2">
          {list.wordIds.length} words
        </p>
      </div>

      <div className="space-y-2">
        <button
          onClick={() => onStartStudy("flashcards", list._id)}
          className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors text-sm"
          disabled={list.wordIds.length === 0}
        >
          🃏 Flashcards
        </button>
        <button
          onClick={() => onStartStudy("quiz", list._id)}
          className="w-full px-3 py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 transition-colors text-sm"
          disabled={list.wordIds.length === 0}
        >
          ❓ Quiz
        </button>
        <button
          onClick={() => onStartStudy("spelling", list._id)}
          className="w-full px-3 py-2 bg-purple-50 text-purple-700 rounded hover:bg-purple-100 transition-colors text-sm"
          disabled={list.wordIds.length === 0}
        >
          ✏️ Spelling
        </button>
      </div>

      {list.wordIds.length === 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          Add words to start studying
        </p>
      )}
    </div>
  );
}
