import React, { memo, useMemo, useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface Column<T> {
  key: keyof T | string;
  header: string | (() => React.ReactNode);
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  pageSize?: number; // For client-side pagination
}

// Memoized table row component for better performance
const TableRow = memo(function TableRow<T>({
  item,
  columns,
  keyExtractor,
  onRowClick,
}: {
  item: T;
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
}) {
  const handleClick = useCallback(() => {
    onRowClick?.(item);
  }, [item, onRowClick]);

  return (
    <tr
      onClick={onRowClick ? handleClick : undefined}
      className={onRowClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
    >
      {columns.map((column) => (
        <td key={String(column.key)} className={column.className}>
          {column.render
            ? column.render(item)
            : String((item as Record<string, unknown>)[column.key as string] ?? '')}
        </td>
      ))}
    </tr>
  );
}) as <T>(props: {
  item: T;
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
}) => React.ReactElement;

// Loading skeleton row
const SkeletonRow = memo(({ columnCount }: { columnCount: number }) => (
  <tr className="animate-pulse">
    {Array.from({ length: columnCount }).map((_, i) => (
      <td key={i}>
        <div className="h-4 bg-muted rounded w-3/4" />
      </td>
    ))}
  </tr>
));

SkeletonRow.displayName = 'SkeletonRow';

function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
  pagination,
  pageSize = 50, // Default page size for client-side pagination
}: DataTableProps<T>) {
  // Client-side pagination state (used when no external pagination provided)
  const [clientPage, setClientPage] = useState(1);

  // Calculate paginated data for client-side pagination
  const { paginatedData, totalPages, currentPage } = useMemo(() => {
    if (pagination) {
      // External pagination
      return {
        paginatedData: data,
        totalPages: pagination.totalPages,
        currentPage: pagination.currentPage,
      };
    }

    // Client-side pagination for large datasets
    const total = Math.ceil(data.length / pageSize);
    const start = (clientPage - 1) * pageSize;
    const end = start + pageSize;
    
    return {
      paginatedData: data.slice(start, end),
      totalPages: total,
      currentPage: clientPage,
    };
  }, [data, pagination, clientPage, pageSize]);

  const handlePageChange = useCallback((page: number) => {
    if (pagination) {
      pagination.onPageChange(page);
    } else {
      setClientPage(page);
    }
  }, [pagination]);

  // Reset to page 1 when data changes significantly
  React.useEffect(() => {
    if (!pagination && clientPage > Math.ceil(data.length / pageSize)) {
      setClientPage(1);
    }
  }, [data.length, clientPage, pageSize, pagination]);

  if (isLoading) {
    return (
      <div className="data-table overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={String(column.key)} className={column.className}>
                  {typeof column.header === 'function' ? column.header() : column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columnCount={columns.length} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="data-table">
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={String(column.key)} className={column.className}>
                {typeof column.header === 'function' ? column.header() : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((item) => (
            <TableRow
              key={keyExtractor(item)}
              item={item}
              columns={columns}
              keyExtractor={keyExtractor}
              onRowClick={onRowClick}
            />
          ))}
        </tbody>
      </table>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {pagination ? (
              `Page ${currentPage} of ${totalPages}`
            ) : (
              `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, data.length)} of ${data.length}`
            )}
          </p>
          <div className="flex gap-1">
            {/* First page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="btn-ghost px-2 py-1.5 disabled:opacity-50"
              title="First page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            {/* Previous page */}
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn-ghost px-2 py-1.5 disabled:opacity-50"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {/* Page numbers - show up to 5 pages */}
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary text-primary-foreground'
                        : 'btn-ghost'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next page */}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn-ghost px-2 py-1.5 disabled:opacity-50"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {/* Last page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="btn-ghost px-2 py-1.5 disabled:opacity-50"
              title="Last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(DataTable) as typeof DataTable;