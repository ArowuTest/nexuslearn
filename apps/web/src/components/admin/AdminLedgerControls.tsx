type AdminLedgerControlsProps = {
  itemCount: number;
  loaded: boolean;
  loading: boolean;
  error: string;
  hasMore: boolean;
  loadingLabel: string;
  emptyLabel: string;
  endLabel: string;
  loadMoreLabel: string;
  retryLabel: string;
  retryMoreLabel: string;
  onLoadMore: () => void;
  onRetry: () => void;
};

export default function AdminLedgerControls({
  itemCount,
  loaded,
  loading,
  error,
  hasMore,
  loadingLabel,
  emptyLabel,
  endLabel,
  loadMoreLabel,
  retryLabel,
  retryMoreLabel,
  onLoadMore,
  onRetry,
}: AdminLedgerControlsProps) {
  const loadingFirstPage = loading && itemCount === 0;

  return (
    <div className="p-5">
      {loadingFirstPage && <p role="status" aria-live="polite" className="text-sm text-[#1d1a3e]/58">{loadingLabel}</p>}
      {error && (
        <div className="grid gap-3">
          <p role="alert" className="text-sm text-[#8b2b2b]">{error}</p>
          <button type="button" onClick={onRetry} className="btn-pop justify-self-start bg-[#fde4e4] px-4 py-2 text-sm font-semibold text-[#8b2b2b]">
            {itemCount > 0 ? retryMoreLabel : retryLabel}
          </button>
        </div>
      )}
      {!error && loaded && itemCount === 0 && <p role="status" aria-live="polite" className="text-sm text-[#1d1a3e]/58">{emptyLabel}</p>}
      {!error && itemCount > 0 && hasMore && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={onLoadMore} disabled={loading} className="btn-pop bg-[#f6f3ea] px-4 py-2 text-sm font-semibold text-[#1d1a3e] disabled:cursor-wait disabled:opacity-50">
            {loadMoreLabel}
          </button>
          {loading && <p role="status" aria-live="polite" className="text-sm text-[#1d1a3e]/58">{loadingLabel}</p>}
        </div>
      )}
      {!error && loaded && itemCount > 0 && !hasMore && <p role="status" aria-live="polite" className="text-sm text-[#1d1a3e]/58">{endLabel}</p>}
    </div>
  );
}
