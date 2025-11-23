import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Edit2, ArrowLeft } from "lucide-react";

interface PlansPageProps {
  userId: Id<"users">;
}

export default function PlansPage({ userId }: PlansPageProps) {
  const decks = useQuery((api as any).learning.getUserDecks, { userId });
  const createDeck = useMutation((api as any).learning.createDeck);
  const deleteDeck = useMutation((api as any).learning.deleteDeck);

  const [newDeckName, setNewDeckName] = useState("");
  const [activeDeckId, setActiveDeckId] = useState<Id<"decks"> | null>(null);

  const handleAddDeck = async () => {
    const name = newDeckName.trim();
    if (!name) return;
    await createDeck({ userId, name });
    setNewDeckName("");
  };

  const activeDeck = useMemo(() => decks?.find((d) => d._id === activeDeckId) || null, [decks, activeDeckId]);

  if (activeDeck) {
    return (
      <DeckDetail
        deck={activeDeck}
        onBack={() => setActiveDeckId(null)}
        userId={userId}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-4">
        <h2 className="text-base font-semibold text-gray-900">덱 추가</h2>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
            placeholder="새 덱 이름"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
          />
          <Button onClick={handleAddDeck} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> 덱 추가
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {decks?.map((deck) => (
          <div
            key={deck._id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{deck.name}</p>
              <p className="text-xs text-gray-500">카드 {deck.totalCards}장</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveDeckId(deck._id)}
                aria-label={`관리 ${deck.name}`}
              >
                관리
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deleteDeck({ deckId: deck._id })}
                aria-label={`삭제 ${deck.name}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {!decks && (
          <div className="text-sm text-gray-500">덱을 불러오는 중...</div>
        )}
        {decks?.length === 0 && (
          <div className="text-sm text-gray-500">덱이 없습니다. 새로 추가해보세요.</div>
        )}
      </div>
    </div>
  );
}

function DeckDetail({ deck, onBack, userId }: { deck: { _id: Id<"decks">; name: string }; onBack: () => void; userId: Id<"users"> }) {
  const cards = useQuery((api as any).learning.getDeckCards, { deckId: deck._id, userId });
  const createCard = useMutation((api as any).learning.createCard);
  const updateCard = useMutation((api as any).learning.updateCard);
  const deleteCard = useMutation((api as any).learning.deleteCard);

  const [form, setForm] = useState({ question: "", answer: "", hint: "", explanation: "" });
  const [editingId, setEditingId] = useState<Id<"cards"> | null>(null);

  const handleSubmit = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    const reset = {
      due: Date.now(),
      stability: 0,
      difficulty: 0,
      scheduled_days: 0,
      learning_steps: 0,
      reps: 0,
      lapses: 0,
      state: 0,
      last_review: undefined,
      suspended: false,
    };
    if (editingId) {
      await updateCard({
        cardId: editingId,
        deckId: deck._id,
        question: form.question,
        answer: form.answer,
        hint: form.hint,
        explanation: form.explanation,
        ...reset,
      });
    } else {
      await createCard({
        deckId: deck._id,
        userId,
        question: form.question,
        answer: form.answer,
        hint: form.hint,
        explanation: form.explanation,
      });
    }
    setForm({ question: "", answer: "", hint: "", explanation: "" });
    setEditingId(null);
  };

  const startEdit = (card: any) => {
    setEditingId(card._id);
    setForm({
      question: card.question,
      answer: card.answer,
      hint: card.hint || "",
      explanation: card.explanation || "",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="px-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </Button>
        <h2 className="text-base font-semibold text-gray-900">{deck.name}</h2>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="질문을 입력"
          value={form.question}
          onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="정답을 입력"
          value={form.answer}
          onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
        />
        <input
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="힌트 (선택)"
          value={form.hint}
          onChange={(e) => setForm((f) => ({ ...f, hint: e.target.value }))}
        />
        <textarea
          className="w-full px-3 py-2 rounded-md border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm"
          placeholder="설명 (선택)"
          value={form.explanation}
          onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
        />
        <Button onClick={handleSubmit} className="w-full" aria-label={editingId ? `저장 ${editingId}` : "카드 추가"}>
          {editingId ? "저장" : "카드 추가"}
        </Button>
      </div>

      <div className="space-y-2">
        {cards?.map((card: any) => (
          <div key={card._id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">{card.question}</p>
            <p className="text-xs text-gray-600 mt-1">정답: {card.answer}</p>
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="secondary" onClick={() => startEdit(card)} aria-label={`수정 ${card._id}`}>
                <Edit2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deleteCard({ cardId: card._id, deckId: deck._id })}
                aria-label={`삭제 ${card._id}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {!cards && <p className="text-sm text-gray-500">카드를 불러오는 중...</p>}
        {cards?.length === 0 && <p className="text-sm text-gray-500">카드가 없습니다.</p>}
      </div>
    </div>
  );
}
