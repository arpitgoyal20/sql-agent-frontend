// Previous / next page and page size (50 / 100 / 200). Paging never calls the LLM.

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId } from 'react';

import { PAGE_SIZES } from '../../context/WorkbenchContext';

interface Props {
  page: number; // zero-based
  pages: number;
  pageSize: number;
  disabled?: boolean;
  onPage: (index: number) => void;
  onPageSize: (n: number) => void;
}

export default function Pagination({ page, pages, pageSize, disabled, onPage, onPageSize }: Props) {
  const sizeId = useId();
  return (
    <nav aria-label="Result pages" className="flex items-center gap-1">
      <button
        type="button"
        className="btn-icon h-6 w-6"
        onClick={() => onPage(page - 1)}
        disabled={disabled || page <= 0}
        aria-label="Previous page"
        title="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="btn-icon h-6 w-6"
        onClick={() => onPage(page + 1)}
        disabled={disabled || page >= pages - 1}
        aria-label="Next page"
        title="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <label htmlFor={sizeId} className="sr-only">
        Rows per page
      </label>
      <select
        id={sizeId}
        value={pageSize}
        disabled={disabled}
        onChange={(e) => onPageSize(Number(e.target.value))}
        className="h-6 rounded-md border border-line bg-bg px-1 text-xs text-fg focus:border-accent focus:outline-none disabled:opacity-50"
        title="Rows per page"
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n} / page
          </option>
        ))}
      </select>
    </nav>
  );
}
