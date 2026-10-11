import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({ currentPage, totalItems, pageSize, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  if (totalItems <= pageSize) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        {start}–{end} de {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(1)}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm px-2">
          {currentPage} / {totalPages}
        </span>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[], pageSize = 10) {
  return {
    paginate: (page: number) => {
      const start = (page - 1) * pageSize;
      return items.slice(start, start + pageSize);
    },
    pageSize,
    totalItems: items.length,
  };
}
