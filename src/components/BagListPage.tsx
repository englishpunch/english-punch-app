import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import { Plus, Trash2 } from "lucide-react";
import useIsMock from "@/hooks/useIsMock";
import { useNavigate } from "@tanstack/react-router";

export default function BagListPage() {
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const isMock = useIsMock();
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const bagsArgs = isMock
    ? "skip"
    : userId
      ? {
          userId,
        }
      : "skip";
  const bagsQuery = useQuery(api.learning.getUserBags, bagsArgs);
  const createBag = useMutation(api.learning.createBag);
  const deleteBag = useMutation(api.learning.deleteBag);

  const [newBagName, setNewBagName] = useState("");

  const handleAddBag = async () => {
    const name = newBagName.trim();
    if (!name) return;
    if (!userId) return;
    await createBag({ userId, name });
    setNewBagName("");
  };

  const mockBags = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-${i + 1}` as Id<"bags">,
      name: `Mock Bag ${i + 1}`,
      totalCards: 0,
    }));
  }, [isMock]);

  const bags = isMock ? mockBags : bagsQuery;

  const PAGE_SIZE = 20;
  const totalPages = useMemo(() => {
    if (!bags?.length) return 1;
    return Math.ceil(bags.length / PAGE_SIZE);
  }, [bags]);

  const clampPage = (page: number) => Math.min(Math.max(page, 1), totalPages);
  const safeCurrentPage = clampPage(currentPage);
  const setPage = (next: number | ((page: number) => number)) => {
    setCurrentPage((prev) => {
      const resolved =
        typeof next === "function"
          ? (next as (page: number) => number)(prev)
          : next;
      return clampPage(resolved);
    });
  };

  const visibleBags = useMemo(() => {
    if (!bags) return [];
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return bags.slice(start, start + PAGE_SIZE);
  }, [bags, safeCurrentPage]);

  const handleViewBag = (bagId: Id<"bags">) => {
    void navigate({ to: "/plans/$bagId", params: { bagId } });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">샌드백 추가</h2>
        </div>
        <div className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="new-bag-name">
            새 샌드백 이름
          </label>
          <input
            id="new-bag-name"
            className="focus:border-primary-500 focus:ring-primary-500 flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:ring-1"
            placeholder="새 샌드백 이름"
            value={newBagName}
            onChange={(e) => setNewBagName(e.target.value)}
          />
          {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
          <Button onClick={handleAddBag} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden /> 샌드백 추가
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleBags.map((bag) => (
          <div
            key={bag._id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">{bag.name}</p>
              <p className="text-xs text-gray-500">카드 {bag.totalCards}장</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleViewBag(bag._id)}
                aria-label={`관리 ${bag.name}`}
              >
                관리
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void deleteBag({ bagId: bag._id })}
                aria-label={`삭제 ${bag.name}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          </div>
        ))}
        {!bags && (
          <div className="text-sm text-gray-500">샌드백을 불러오는 중...</div>
        )}
        {bags?.length === 0 && (
          <div className="text-sm text-gray-500">
            샌드백이 없습니다. 새로 추가해보세요.
          </div>
        )}
        {bags && bags.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2 text-xs text-gray-600">
            <span>
              페이지 {safeCurrentPage} / {totalPages} · 총 {bags.length}개
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                aria-label="이전 페이지"
                onClick={() => setPage((page) => page - 1)}
                disabled={safeCurrentPage === 1}
              >
                이전
              </Button>
              <Button
                variant="secondary"
                size="sm"
                aria-label="다음 페이지"
                onClick={() => setPage((page) => page + 1)}
                disabled={safeCurrentPage === totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
