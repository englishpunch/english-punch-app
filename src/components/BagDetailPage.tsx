import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, usePaginatedQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Input } from "./Input";
import { TableWrapper, Table, THead, TBody, Tr, Th, Td } from "./Table";
import {
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Search,
  Sparkles,
  Loader2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
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
import { useTranslation } from "react-i18next";
import { getLocaleForLanguage } from "@/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const { t, i18n } = useTranslation();
  const locale = getLocaleForLanguage(i18n.language);
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
    if (!isMock) {
      return [];
    }
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-${i + 1}` as Id<"bags">,
      name: t("mock.bagName", { number: i + 1 }),
      totalCards: 0,
    }));
  }, [isMock, t]);

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
          ...(searchQuery ? { search: searchQuery } : {}),
        };

  const {
    results: paginatedCards,
    status,
    loadMore,
  } = usePaginatedQuery(api.learning.getBagCardsPaginated, paginatedCardsArgs, {
    initialNumItems: 30,
  });

  const deleteCard = useMutation(api.learning.deleteCard);
  const [pendingDeleteCard, setPendingDeleteCard] = useState<Card | null>(null);

  const mockCards = useMemo(() => {
    if (!isMock) {
      return [];
    }
    return Array.from({ length: 500 }, (_, i) => ({
      _id: `mock-card-${i + 1}` as Id<"cards">,
      _creationTime: Date.now() - i * 1000,
      question: t("mock.question", { number: i + 1 }),
      answer: t("mock.answer", { number: i + 1 }),
      hint: t("mock.hint", { number: i + 1 }),
      explanation: t("mock.explanation", { number: i + 1 }),
    }));
  }, [isMock, t]);

  const cardsToShow = useMemo(
    () => (isMock ? mockCards : paginatedCards) ?? [],
    [paginatedCards, isMock, mockCards]
  );

  const [sorting, setSorting] = useState<SortingState>([
    { id: "_creationTime", desc: true },
  ]);
  const columnFilters = useMemo<ColumnFiltersState>(() => {
    if (!isMock || !searchQuery) {
      return [];
    }
    return [{ id: "answer", value: searchQuery }];
  }, [isMock, searchQuery]);

  const columnHelper = createColumnHelper<Card>();

  const columns = useMemo(
    () => [
      columnHelper.accessor("answer", {
        header: t("bagDetail.tableHeaders.answer"),
        cell: (info) => (
          <div className="font-semibold text-gray-900">{info.getValue()}</div>
        ),
        size: 200,
      }),
      columnHelper.accessor("question", {
        header: t("bagDetail.tableHeaders.question"),
        cell: (info) => {
          const question = info.getValue();
          const truncated =
            question.length > 80 ? question.slice(0, 80) + "..." : question;
          return <div className="text-sm text-gray-600">{truncated}</div>;
        },
        size: 400,
      }),
      columnHelper.accessor("_creationTime", {
        header: t("bagDetail.tableHeaders.created"),
        cell: (info) => {
          const date = new Date(info.getValue());
          return (
            <div className="text-xs text-gray-500">
              {date.toLocaleDateString(locale, {
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
        header: t("bagDetail.tableHeaders.actions"),
        enableSorting: false,
        cell: (info) => {
          const card = info.row.original;
          return (
            <div className="flex justify-end gap-2">
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
                aria-label={t("bagDetail.editAria", { id: card._id })}
              >
                <Edit2 className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPendingDeleteCard(card)}
                disabled={isMock || !bag}
                aria-label={t("bagDetail.deleteAria", { id: card._id })}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          );
        },
        size: 120,
      }),
    ],
    [bag, columnHelper, isMock, locale, navigate, setPendingDeleteCard, t]
  );

  const table = useReactTable({
    data: cardsToShow,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;
  const showFilteredCount = isMock && searchQuery;
  const emptyStateMessage =
    !isMock && status === "LoadingFirstPage"
      ? t("bagDetail.emptyLoading")
      : searchQuery
        ? t("bagDetail.emptyNoResults")
        : t("bagDetail.emptyNoCards");

  const handleBack = () => {
    void navigate({ to: "/plans" });
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = formData.get("search");
    if (typeof search !== "string") {
      console.log("Invalid search input:", search);
      return;
    }
    const nextSearch = String(search).trim();
    void navigate({
      to: "/plans/$bagId",
      params: { bagId },
      search: { search: nextSearch },
    });
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteCard || !bag) {
      return;
    }
    await deleteCard({ cardId: pendingDeleteCard._id, bagId: bag._id });
    setPendingDeleteCard(null);
    toast.success(t("bagDetail.toasts.deleted"));
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
            {t("bagDetail.notFound")}
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
            aria-label={t("bagDetail.multiCreateAria")}
          >
            <Sparkles className="h-4 w-4" aria-hidden />{" "}
            {t("bagDetail.multiCreate")}
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
            aria-label={t("bagDetail.addCardAria")}
          >
            <Plus className="h-4 w-4" aria-hidden /> {t("bagDetail.addCard")}
          </Button>
        </div>
      </div>

      <form
        key={`${bagId}-${searchQuery}`}
        className="flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={handleSearchSubmit}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            name="search"
            type="text"
            placeholder={t("bagDetail.searchPlaceholder")}
            defaultValue={searchQuery}
            padding="icon"
          />
        </div>
        <Button type="submit" variant="secondary" className="gap-2">
          <Search className="h-4 w-4" aria-hidden />
          {t("common.actions.search")}
        </Button>
      </form>
      {searchQuery && (
        <p className="mt-2 text-xs text-gray-500">
          {t("bagDetail.searchNotice")}
        </p>
      )}

      <TableWrapper edgeToEdge>
        <Table>
          <THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th
                    key={header.id}
                    className={cn(
                      header.column.id === "actions" && "text-right"
                    )}
                    style={{ width: header.getSize() }}
                    aria-sort={
                      header.column.getCanSort()
                        ? header.column.getIsSorted() === "asc"
                          ? "ascending"
                          : header.column.getIsSorted() === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "group inline-flex items-center gap-1 text-left transition",
                          header.column.getIsSorted()
                            ? "text-gray-900"
                            : "text-gray-600 hover:text-gray-900",
                          header.column.id === "actions" && "justify-end"
                        )}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {header.column.getIsSorted() === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <ChevronsUpDown
                            className="h-3.5 w-3.5 text-gray-400 opacity-0 transition group-hover:opacity-100"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )
                    )}
                  </Th>
                ))}
              </Tr>
            ))}
          </THead>
          <TBody>
            {rows.length === 0 ? (
              <Tr>
                <Td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-8 text-center text-gray-500"
                >
                  {emptyStateMessage}
                </Td>
              </Tr>
            ) : (
              rows.map((row) => (
                <Tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <Td
                      key={cell.id}
                      className={cn(
                        cell.column.id === "actions" && "text-right"
                      )}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </Td>
                  ))}
                </Tr>
              ))
            )}
          </TBody>
        </Table>
      </TableWrapper>

      {rows.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {t("bagDetail.totalCount", {
              count: rows.length,
            })}
            {showFilteredCount &&
              ` ${t("bagDetail.filteredCount", {
                total: cardsToShow.length,
              })}`}
          </span>
          {!isMock && status === "CanLoadMore" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => loadMore(30)}
              aria-label={t("bagDetail.loadMoreAria")}
            >
              {t("bagDetail.loadMore", { count: 30 })}
            </Button>
          )}
          {!isMock && status === "LoadingMore" && (
            <span className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("bagDetail.loadingMore")}
            </span>
          )}
        </div>
      )}
      <ConfirmDialog
        isOpen={pendingDeleteCard !== null}
        title={t("bagDetail.deleteConfirmTitle")}
        description={t("bagDetail.deleteConfirmDescription")}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteCard(null)}
      />
    </div>
  );
}
