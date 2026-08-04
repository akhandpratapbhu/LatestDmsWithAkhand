import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { orgApi } from '../../../lib/api';
import { useWorkspaceHref } from '../../../lib/workspace-path';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { PageHeader } from '../../../components/PageHeader';
import {
  DynamicFormDefinition,
  formFieldColumns,
} from '../components/DynamicFormRenderer';
import {
  findMenuForForm,
  formRecordEditPath,
  formRecordNewPath,
  formRecordViewPath,
  resourceFromMenuPerm,
  SubmissionRow,
} from '../form-records-utils';

const IMAGE_EXT_URL_RE = /^https?:\/\/.+\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i;
const CDN_IMAGE_PATH_RE =
  /\/(thumbnails?|images?|imgs?|media|photos?|avatars?|assets|static|uploads)\//i;

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const CREATED_SORT_KEY = '__createdAt';

type SortDir = 'asc' | 'desc';

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function looksLikeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!isHttpUrl(trimmed)) return false;
  if (IMAGE_EXT_URL_RE.test(trimmed)) return true;
  try {
    const { pathname } = new URL(trimmed);
    if (/\.(png|jpe?g|gif|webp|svg|bmp)\b/i.test(pathname)) return true;
    if (CDN_IMAGE_PATH_RE.test(pathname)) return true;
  } catch {
    /* ignore invalid URL */
  }
  return false;
}

function isImagePreferringField(controlType: string | undefined): boolean {
  const t = (controlType ?? '').toUpperCase();
  return t === 'IMAGE' || t === 'FILE' || t === 'URL';
}

function shouldRenderAsImage(value: string, controlType?: string): boolean {
  if (IMAGE_EXT_URL_RE.test(value.trim())) return true;
  if (isImagePreferringField(controlType) && looksLikeImageUrl(value)) return true;
  return looksLikeImageUrl(value);
}

function truncateUrl(url: string, max = 48): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max - 1)}…`;
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function CellValue({ value, controlType }: { value: unknown; controlType?: string }) {
  if (value == null) return <>—</>;

  const text = cellText(value);

  if (typeof value === 'string' && shouldRenderAsImage(value, controlType)) {
    const src = value.trim();
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="records-cell-image-link"
        title={src}
      >
        <img src={src} alt="" className="records-cell-thumb" loading="lazy" />
      </a>
    );
  }

  if (typeof value === 'string' && isHttpUrl(value)) {
    const href = value.trim();
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={href} className="records-cell-url">
        {truncateUrl(href)}
      </a>
    );
  }

  return <>{text}</>;
}

function IconEye() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M13 6.5 17.5 11" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M7 7l1 13h8l1-13"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function compareValues(a: unknown, b: unknown, dir: SortDir): number {
  const emptyA = a == null || a === '';
  const emptyB = b == null || b === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const numA = typeof a === 'number' ? a : Number(a);
  const numB = typeof b === 'number' ? b : Number(b);
  if (!Number.isNaN(numA) && !Number.isNaN(numB) && String(a).trim() !== '' && String(b).trim() !== '') {
    const diff = numA - numB;
    return dir === 'asc' ? diff : -diff;
  }

  const strA = cellText(a).toLowerCase();
  const strB = cellText(b).toLowerCase();
  const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? cmp : -cmp;
}

export function FormRecordsPage() {
  const { formId = '' } = useParams<{ formId: string }>();
  const { currentOrg } = useOrg();
  const { hasPermission, sidebar } = useIam();
  const hrefFor = useWorkspaceHref();
  const navigate = useNavigate();
  const [form, setForm] = useState<DynamicFormDefinition | null>(null);
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string>(CREATED_SORT_KEY);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const columns = useMemo(() => (form ? formFieldColumns(form) : []), [form]);
  const displayColumns = useMemo(() => columns.slice(0, 6), [columns]);

  const resource = useMemo(() => {
    if (!formId || !sidebar?.groups) return null;
    for (const g of sidebar.groups) {
      const menu = findMenuForForm(g.menus, formId);
      if (menu) return resourceFromMenuPerm(menu.permissionCode);
    }
    return null;
  }, [sidebar, formId]);

  const canView = Boolean(
    resource &&
      (hasPermission(`${resource}.view`) ||
        hasPermission(`menu.${resource}`) ||
        hasPermission(`screen.${resource}`)),
  );
  const legacyWrite = resource
    ? hasPermission(`api.${resource}.write`) &&
      !hasPermission(`${resource}.create`) &&
      !hasPermission(`${resource}.update`) &&
      !hasPermission(`${resource}.delete`)
    : false;
  const canCreate = Boolean(resource && (hasPermission(`${resource}.create`) || legacyWrite));
  const canUpdate = Boolean(resource && (hasPermission(`${resource}.update`) || legacyWrite));
  const canDelete = Boolean(resource && (hasPermission(`${resource}.delete`) || legacyWrite));
  const showActions = canView || canUpdate || canDelete;

  const colSpan = displayColumns.length + 1 + (showActions ? 1 : 0);

  const load = useCallback(async () => {
    if (!formId) return;
    const [detail, submissions] = await Promise.all([
      orgApi<DynamicFormDefinition>(`/forms/${formId}`),
      orgApi<SubmissionRow[]>(`/forms/${formId}/submissions`),
    ]);
    setForm(detail);
    setRows(submissions);
  }, [formId]);

  useEffect(() => {
    if (!currentOrg || !formId) return;
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [currentOrg?.id, formId, load]);

  // Reset filters when switching forms
  useEffect(() => {
    setSearch('');
    setColumnFilters({});
    setSortKey(CREATED_SORT_KEY);
    setSortDir('desc');
    setPage(1);
    setPageSize(25);
  }, [formId]);

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeFilters = Object.entries(columnFilters).filter(([, v]) => v.trim());

    let next = rows.filter((row) => {
      for (const [key, raw] of activeFilters) {
        const needle = raw.trim().toLowerCase();
        if (key === CREATED_SORT_KEY) {
          const hay = row.createdAt ? new Date(row.createdAt).toLocaleString().toLowerCase() : '';
          if (!hay.includes(needle)) return false;
          continue;
        }
        const hay = cellText(row.data?.[key]).toLowerCase();
        if (!hay.includes(needle)) return false;
      }

      if (!q) return true;
      const blobs: string[] = [];
      for (const c of displayColumns) {
        blobs.push(cellText(row.data?.[c.key]));
      }
      if (row.createdAt) blobs.push(new Date(row.createdAt).toLocaleString());
      return blobs.some((b) => b.toLowerCase().includes(q));
    });

    next = [...next].sort((a, b) => {
      if (sortKey === CREATED_SORT_KEY) {
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
      return compareValues(a.data?.[sortKey], b.data?.[sortKey], sortDir);
    });

    return next;
  }, [rows, search, columnFilters, displayColumns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, safePage, pageSize]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function onSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === CREATED_SORT_KEY ? 'desc' : 'asc');
    }
    setPage(1);
  }

  function setColumnFilter(key: string, value: string) {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function clearFilters() {
    setSearch('');
    setColumnFilters({});
    setPage(1);
  }

  const hasActiveFilters =
    search.trim().length > 0 || Object.values(columnFilters).some((v) => v.trim().length > 0);

  async function onDelete(row: SubmissionRow) {
    if (!formId || !canDelete) return;
    if (!window.confirm('Delete this record? This cannot be undone.')) return;
    setError(null);
    try {
      await orgApi(`/forms/${formId}/submissions/${row.id}`, { method: 'DELETE' });
      setMessage('Record deleted');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function sortIndicator(key: string) {
    if (sortKey !== key) return <span className="records-sort-ind muted">↕</span>;
    return <span className="records-sort-ind">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Records</h1>
        <p className="lede">Select a project first.</p>
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title={form?.name ?? 'Form records'}
        description="Records submitted for this form."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-head">
          <h2>
            Records{' '}
            <span className="muted tiny">
              ({filteredSorted.length}
              {filteredSorted.length !== rows.length ? ` of ${rows.length}` : ''})
            </span>
          </h2>
          {canCreate && (
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate(hrefFor(formRecordNewPath(formId)))}
            >
              Add
            </button>
          )}
        </div>
        <div className="section-card-body">
          <div className="grid-toolbar records-grid-toolbar">
            <label className="records-search-field">
              Search
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search visible columns…"
                aria-label="Search records"
              />
            </label>
            <label>
              Page size
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {hasActiveFilters && (
              <button type="button" className="btn secondary" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table records-data-table">
              <thead>
                <tr>
                  {displayColumns.map((c) => (
                    <th key={c.key}>
                      <button
                        type="button"
                        className="records-th-sort"
                        onClick={() => onSort(c.key)}
                        aria-label={`Sort by ${c.label}`}
                      >
                        {c.label}
                        {sortIndicator(c.key)}
                      </button>
                    </th>
                  ))}
                  <th>
                    <button
                      type="button"
                      className="records-th-sort"
                      onClick={() => onSort(CREATED_SORT_KEY)}
                      aria-label="Sort by Created"
                    >
                      Created
                      {sortIndicator(CREATED_SORT_KEY)}
                    </button>
                  </th>
                  {showActions && <th>Actions</th>}
                </tr>
                <tr className="records-filter-row">
                  {displayColumns.map((c) => (
                    <th key={`f-${c.key}`}>
                      <input
                        type="search"
                        className="records-col-filter"
                        value={columnFilters[c.key] ?? ''}
                        onChange={(e) => setColumnFilter(c.key, e.target.value)}
                        placeholder="Filter…"
                        aria-label={`Filter ${c.label}`}
                      />
                    </th>
                  ))}
                  <th>
                    <input
                      type="search"
                      className="records-col-filter"
                      value={columnFilters[CREATED_SORT_KEY] ?? ''}
                      onChange={(e) => setColumnFilter(CREATED_SORT_KEY, e.target.value)}
                      placeholder="Filter…"
                      aria-label="Filter Created"
                    />
                  </th>
                  {showActions && <th aria-hidden="true" />}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="muted">
                      No records yet
                      {canCreate ? '. Click Add to create one.' : '.'}
                    </td>
                  </tr>
                )}
                {rows.length > 0 && filteredSorted.length === 0 && (
                  <tr>
                    <td colSpan={colSpan} className="muted">
                      No matching records.
                      {hasActiveFilters ? (
                        <>
                          {' '}
                          <button type="button" className="linkish" onClick={clearFilters}>
                            Clear filters
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                )}
                {pageRows.map((row) => (
                  <tr key={row.id}>
                    {displayColumns.map((c) => (
                      <td key={c.key}>
                        <CellValue value={row.data?.[c.key]} controlType={c.controlType} />
                      </td>
                    ))}
                    <td className="muted tiny">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                    </td>
                    {showActions && (
                      <td>
                        <div className="records-row-actions">
                          {canView && (
                            <button
                              type="button"
                              className="btn ghost sm records-action-btn"
                              title="View"
                              aria-label="View"
                              onClick={() =>
                                navigate(hrefFor(formRecordViewPath(formId, row.id)))
                              }
                            >
                              <IconEye />
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              type="button"
                              className="btn ghost sm records-action-btn"
                              title="Edit"
                              aria-label="Edit"
                              onClick={() =>
                                navigate(hrefFor(formRecordEditPath(formId, row.id)))
                              }
                            >
                              <IconPencil />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              className="btn ghost sm records-action-btn danger-text"
                              title="Delete"
                              aria-label="Delete"
                              onClick={() => void onDelete(row)}
                            >
                              <IconTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredSorted.length > 0 && (
            <div className="action-row records-pagination">
              <button
                className="btn secondary"
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <span className="muted">
                Page {safePage} / {totalPages} · {filteredSorted.length} total
              </span>
              <button
                className="btn secondary"
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
