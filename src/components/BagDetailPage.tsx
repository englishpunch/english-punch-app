import { useMemo, useState, type FormEvent } from "react";
import {
  optimisticallyUpdateValueInPaginatedQuery,
  useMutation,
  useQuery,
  usePaginatedQuery,
} from "convex/react";
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
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Spinner } from "./Spinner";
import { Switch } from "./Switch";
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
  type OnChangeFn,
} from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dayjs, DATE_FORMAT, DATETIME_FORMAT } from "@/lib/dayjs";
import { BAG_CARD_SORT_DEFAULTS } from "@/lib/bagCardSort";

type Card = {
  _id: Id<"cards">;
  _creationTime: number;
  question: string;
  answer: string;
  due: number;
  hint?: string;
  explanation?: string;
  context?: string;
  sourceWord?: string;
  expression?: string;
  suspended: boolean;
};

const columnHelper = createColumnHelper<Card>();

export default function BagDetailPage() {
  const { t } = useTranslation();
  const { bagId } = useParams({ from: "/plans/$bagId" });
  const isMock = useIsMock();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userId = loggedInUser?._id;
  const userSettings = useQuery(
    api.fsrs.getUserSettings,
    userId ? { userId } : "skip"
  );
  const timezone = userSettings?.timezone ?? "Asia/Seoul";
  const navigate = useNavigate();
  const searchParams = useSearch({ from: "/plans/$bagId" });
  const searchQuery = searchParams.search || "";
  const sorting = useMemo<SortingState>(
    () => [
      {
        id: searchParams.sortBy === "due" ? "due" : "_creationTime",
        desc: searchParams.sortDirection === "desc",
      },
    ],
    [searchParams.sortBy, searchParams.sortDirection]
  );
  const [answersVisible, setAnswersVisible] = useState(true);
  const activeSort = sorting[0] ?? BAG_CARD_SORT_DEFAULTS.table;
  const sortBy: "due" | "created" = activeSort.id === "due" ? "due" : "created";

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
      : searchQuery
        ? { bagId: bag._id, search: searchQuery }
        : {
            bagId: bag._id,
            sortBy,
            sortDirection: activeSort.desc
              ? ("desc" as const)
              : ("asc" as const),
          };

  const {
    results: paginatedCards,
    status,
    loadMore,
  } = usePaginatedQuery(api.learning.getBagCardsPaginated, paginatedCardsArgs, {
    initialNumItems: 30,
  });

  const deleteCard = useMutation(api.learning.deleteCard);
  const setCardSuspended = useMutation(
    api.learning.setCardSuspended
  ).withOptimisticUpdate((localStore, args) => {
    if (paginatedCardsArgs === "skip") {
      return;
    }

    optimisticallyUpdateValueInPaginatedQuery(
      localStore,
      api.learning.getBagCardsPaginated,
      paginatedCardsArgs,
      (card) =>
        card._id === args.cardId ? { ...card, suspended: args.suspended } : card
    );
  });
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
      due: Date.now() + i * 60 * 60 * 1000,
      hint: t("mock.hint", { number: i + 1 }),
      explanation: t("mock.explanation", { number: i + 1 }),
      suspended: false,
    }));
  }, [isMock, t]);

  const cardsToShow = useMemo(
    () => (isMock ? mockCards : paginatedCards) ?? [],
    [paginatedCards, isMock, mockCards]
  );

  const columnFilters = useMemo<ColumnFiltersState>(() => {
    if (!isMock || !searchQuery) {
      return [];
    }
    return [{ id: "answer", value: searchQuery }];
  }, [isMock, searchQuery]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("question", {
        header: t("bagDetail.tableHeaders.question"),
        enableSorting: false,
        cell: (info) => (
          <div className="leading-5 break-words text-gray-700">
            {info.getValue()}
          </div>
        ),
        size: 460,
        minSize: 320,
      }),
      columnHelper.accessor("answer", {
        header: () => (
          <div className="flex items-center justify-between gap-2">
            <span>{t("bagDetail.tableHeaders.answer")}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-my-2 h-8 w-8 shrink-0 p-0 text-gray-600 after:absolute after:-inset-1.5 after:content-['']"
              onClick={() => setAnswersVisible((visible) => !visible)}
              aria-label={t(
                answersVisible
                  ? "bagDetail.hideAnswersAria"
                  : "bagDetail.showAnswersAria"
              )}
            >
              {answersVisible ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </Button>
          </div>
        ),
        enableSorting: false,
        cell: (info) => (
          <div
            className={cn(
              "font-semibold text-gray-900 transition-opacity duration-200 ease-out motion-reduce:transition-none",
              answersVisible ? "opacity-100" : "opacity-0"
            )}
            aria-hidden={!answersVisible}
          >
            {info.getValue()}
          </div>
        ),
        size: 190,
        minSize: 180,
      }),
      columnHelper.accessor("suspended", {
        header: t("bagDetail.tableHeaders.suspended"),
        enableSorting: false,
        cell: (info) => {
          const card = info.row.original;
          const suspended = info.getValue();
          return (
            <Switch
              checked={suspended}
              onCheckedChange={(nextSuspended) => {
                void setCardSuspended({
                  cardId: card._id,
                  suspended: nextSuspended,
                }).catch(() => {
                  toast.error(t("bagDetail.toasts.suspensionFailed"));
                });
              }}
              disabled={isMock}
              aria-label={t("bagDetail.suspendedCardAria", {
                question: card.question,
              })}
            />
          );
        },
        size: 104,
        minSize: 104,
      }),
      columnHelper.accessor("due", {
        header: t("bagDetail.tableHeaders.nextReview"),
        cell: (info) => (
          <div className="text-xs whitespace-nowrap text-gray-500">
            {dayjs(info.getValue()).tz(timezone).format(DATETIME_FORMAT)}
          </div>
        ),
        size: 150,
      }),
      columnHelper.accessor("_creationTime", {
        header: t("bagDetail.tableHeaders.created"),
        cell: (info) => {
          return (
            <div className="text-xs text-gray-500">
              {dayjs(info.getValue()).tz(timezone).format(DATE_FORMAT)}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.display({
        id: "actions",
        header: () => (
          <span className="sr-only">{t("bagDetail.tableHeaders.actions")}</span>
        ),
        enableSorting: false,
        cell: (info) => {
          const card = info.row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-11 w-11 p-0"
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
                className="h-11 w-11 p-0"
                onClick={() => setPendingDeleteCard(card)}
                disabled={isMock || !bag}
                aria-label={t("bagDetail.deleteAria", { id: card._id })}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
            </div>
          );
        },
        size: 96,
      }),
    ],
    [answersVisible, bag, isMock, navigate, setCardSuspended, t, timezone]
  );

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const nextSorting =
      typeof updater === "function" ? updater(sorting) : updater;
    const nextSort = nextSorting[0] ?? BAG_CARD_SORT_DEFAULTS.table;
    void navigate({
      to: "/plans/$bagId",
      params: { bagId },
      search: (previous) => ({
        ...previous,
        sortBy: nextSort.id === "due" ? "due" : "created",
        sortDirection: nextSort.desc ? "desc" : "asc",
      }),
      replace: true,
    });
  };

  // TanStack Table intentionally returns non-memoizable functions here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: cardsToShow,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualSorting: !isMock,
    enableSorting: isMock || !searchQuery,
    enableSortingRemoval: false,
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
      search: (previous) => ({
        ...previous,
        search: nextSearch || undefined,
      }),
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
    <div className="grid h-[calc(100dvh-var(--shell-header-height)-var(--shell-bottom-nav-height)-env(safe-area-inset-bottom))] min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-4 overflow-hidden">
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

      <div className="space-y-2">
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
          <p className="text-xs text-gray-500">{t("bagDetail.searchNotice")}</p>
        )}
      </div>

      <TableWrapper
        edgeToEdge
        className="relative min-h-0 min-w-0 overflow-auto overscroll-contain"
      >
        <Table>
          <THead>
            {table.getHeaderGroups().map((headerGroup) => (
              <Tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <Th
                    key={header.id}
                    className={cn(
                      "sticky top-0 z-10 bg-gray-50 shadow-[inset_0_-1px_0_0_var(--color-gray-200)]",
                      header.column.id === "actions" &&
                        "w-px px-2 text-right whitespace-nowrap",
                      header.column.id === "suspended" && "text-center"
                    )}
                    scope="col"
                    style={{
                      width: header.getSize(),
                      minWidth: header.column.columnDef.minSize,
                    }}
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
                            className="h-3.5 w-3.5 text-gray-400"
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
                        cell.column.id === "actions" &&
                          "w-px px-2 text-right whitespace-nowrap",
                        cell.column.id === "suspended" && "text-center"
                      )}
                      style={{
                        width: cell.column.getSize(),
                        minWidth: cell.column.columnDef.minSize,
                      }}
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
              <Spinner size="sm" />
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
