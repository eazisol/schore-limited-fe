export function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Keep long digit strings (phones, IDs) as text when opened in Excel. */
export function csvForceText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return `="${trimmed.replace(/"/g, '""')}"`;
}

export function downloadCsv(options: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}) {
  const lines = [
    options.headers.map((header) => escapeCsv(header)).join(","),
    ...options.rows.map((row) =>
      row
        .map((cell) => {
          if (cell == null) return "";
          const text = String(cell);
          // Already an Excel text formula — do not re-escape quotes.
          if (text.startsWith('="') && text.endsWith('"')) return text;
          return escapeCsv(text);
        })
        .join(","),
    ),
  ];
  // UTF-8 BOM helps Excel detect encoding correctly.
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchAllPages<T>(options: {
  pageSize?: number;
  search?: string;
  fetchPage: (params: {
    page: number;
    pageSize: number;
    search: string;
  }) => Promise<{ items?: T[] | null; totalPages?: number | null } | null | undefined>;
}): Promise<T[]> {
  const pageSize = options.pageSize ?? 100;
  const search = options.search ?? "";
  const first = await options.fetchPage({ page: 1, pageSize, search });
  const allItems = [...(first?.items ?? [])];
  const totalPages = first?.totalPages ?? 1;

  for (let page = 2; page <= totalPages; page += 1) {
    const next = await options.fetchPage({ page, pageSize, search });
    allItems.push(...(next?.items ?? []));
  }

  return allItems;
}
