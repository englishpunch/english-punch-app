import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Search,
  Sparkles,
  Loader2,
} from "lucide-react";
import useIsMock from "@/hooks/useIsMock";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";

type Card = {
  _id: Id<"cards">;
  _creationTime: number;
  question: string;
  answer: string;
  hint?: string;
  explanation?: string;
  context?: string;
  sourceWord?: string;
  expression?: string;
};

export default function BagDetailPage() {
  const { bagId } = useParams({ from: "/plans/$bagId" });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/plans/$bagId" });
  const searchQuery = searchParams.search || "";

  // Get bag info
  const bagsArgs = isMock
    ? "skip"
    : userId
      ? {
          userId,
        }
      : "skip";
  const bags = useQuery(api.learning.getUserBags, bagsArgs);

  const mockBags = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-${i + 1}` as Id<"bags">,
      name: `Mock Bag ${i + 1}`,
      totalCards: 0,
    }));
  }, [isMock]);

  const bagsToShow = isMock ? mockBags : bags;
  const bag = useMemo(
    () => bagsToShow?.find((d) => d._id === bagId) || null,
    [bagsToShow, bagId]
  );

  // Use paginated query for cards
  const paginatedCardsArgs =
    isMock || !userId || !bag
      ? "skip"
      : {
          bagId: bag._id,
          userId,
        };

  const {
    results: paginatedCards,
    status,
    loadMore,
  } = usePaginatedQuery(api.learning.getBagCardsPaginated, paginatedCardsArgs, {
    initialNumItems: 30,
  });

  const deleteCard = useMutation(api.learning.deleteCard);

  const mockCards = useMemo(() => {
    if (!isMock) return [];
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-card-${i + 1}` as Id<"cards">,
      _creationTime: Date.now() - i * 1000,
      question: `Mock Question ${i + 1}`,
      answer: `Mock Answer ${i + 1}`,
      hint: `Mock Hint ${i + 1}`,
      explanation: `Mock Explanation ${i + 1}`,
    }));
  }, [isMock]);

  const cardsToShow = useMemo(
    () => (isMock ? mockCards : paginatedCards) ?? [],
    [paginatedCards, isMock, mockCards]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "_creationTime", desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columnHelper = createColumnHelper<Card>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("answer", {
        header: "Answer",
        cell: (info) => (
          <div className="font-semibold text-gray-900">{info.getValue()}</div>
        ),
        size: 200,
      }),
      columnHelper.accessor("question", {
        header: "Question",
        cell: (info) => {
          const question = info.getValue();
          const truncated =
            question.length > 80 ? question.slice(0, 80) + "..." : question;
          return <div className="text-sm text-gray-600">{truncated}</div>;
        },
        size: 400,
      }),
      columnHelper.accessor("_creationTime", {
        header: "Created",
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <div className="text-xs text-gray-500">
              {date.toLocaleDateString("ko-KR", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              })}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: (info) => {
          const card = info.row.original;
          return (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  void navigate({
                    to: "/plans/$bagId/cards/$cardId/edit",
                    params: { bagId: bag!._id, cardId: card._id },
                  })
                }
                disabled={isMock}
                aria-label={`수정 ${card._id}`}
              >
                <Edit2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void deleteCard({ cardId: card._id, bagId: bag!._id })
                }
                disabled={isMock || !bag}
                aria-label={`삭제 ${card._id}`}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          );
        },
        size: 120,
      }),
    ],
    [columnHelper, isMock, deleteCard, bag, navigate]
  );

  // Apply search filter via useEffect
  useEffect(() => {
    if (searchQuery) {
      setColumnFilters([{ id: "answer", value: searchQuery }]);
    } else {
      setColumnFilters([]);
    }
  }, [searchQuery]);

  const table = useReactTable({
    data: cardsToShow,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const handleBack = () => {
    void navigate({ to: "/plans" });
  };

  if (!bag) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <h2 className="text-base font-semibold text-gray-900">
            샌드백을 찾을 수 없습니다
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Button>
          <h2 className="text-base font-semibold text-gray-900">{bag.name}</h2>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="gap-2"
            onClick={() =>
              void navigate({
                to: "/plans/$bagId/cards/batch",
                params: { bagId },
              })
            }
            disabled={isMock}
            aria-label="다중 표현 생성"
          >
            <Sparkles className="h-4 w-4" aria-hidden /> 다중 생성
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() =>
              void navigate({
                to: "/plans/$bagId/cards/new",
                params: { bagId },
              })
            }
            disabled={isMock}
            aria-label="카드 추가"
          >
            <Plus className="h-4 w-4" aria-hidden /> 카드 추가
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by answer..."
            value={searchQuery}
            onChange={(e) => {
              void navigate({
                to: "/plans/$bagId",
                params: { bagId },
                search: { search: e.target.value },
              });
            }}
            className="focus:border-primary-500 focus:ring-primary-500 w-full rounded-md border border-gray-200 py-2 pr-3 pl-10 text-sm focus:ring-1"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-xs text-gray-500">
            검색은 현재 로드된 카드에서만 수행됩니다. 더 많은 결과를 보려면 "더
            보기"를 클릭하세요.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="border-b border-gray-200 bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-700"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  {!isMock && status === "LoadingFirstPage"
                    ? "카드를 불러오는 중..."
                    : searchQuery
                      ? "검색 결과가 없습니다."
                      : "카드가 없습니다."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getRowModel().rows.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            총 {table.getRowModel().rows.length}개
            {searchQuery && ` (필터링됨: ${cardsToShow.length}개 중)`}
          </span>
          {!isMock && status === "CanLoadMore" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => loadMore(30)}
              aria-label="더 보기"
            >
              더 보기 (30개)
            </Button>
          )}
          {!isMock && status === "LoadingMore" && (
            <span className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              로딩 중...
            </span>
          )}
        </div>
      )}
    </div>
  );
}
