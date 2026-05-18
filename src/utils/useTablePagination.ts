import { useMemo, useState, type ChangeEvent } from "react";

export const tableRowsPerPageOptions = [5, 10, 25, 50];

export function useTablePagination<T>(rows: T[], initialRowsPerPage = 10) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const safePage = useMemo(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
    return Math.min(page, maxPage);
  }, [page, rows.length, rowsPerPage]);

  const paginatedRows = useMemo(
    () => rows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [rows, rowsPerPage, safePage],
  );

  const paginationProps = {
    component: "div" as const,
    count: rows.length,
    page: safePage,
    rowsPerPage,
    rowsPerPageOptions: tableRowsPerPageOptions,
    labelRowsPerPage: "Filas por pagina:",
    labelDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) =>
      `${from}-${to} de ${count}`,
    onPageChange: (_event: unknown, nextPage: number) => setPage(nextPage),
    onRowsPerPageChange: (event: ChangeEvent<HTMLInputElement>) => {
      setRowsPerPage(Number(event.target.value));
      setPage(0);
    },
  };

  return {
    page: safePage,
    rowsPerPage,
    paginatedRows,
    paginationProps,
    resetPage: () => setPage(0),
  };
}
