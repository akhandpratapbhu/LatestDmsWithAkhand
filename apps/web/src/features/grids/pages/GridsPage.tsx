import { FormEvent, useEffect, useMemo, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { useIam } from '../../iam/iam-context';
import { PageHeader } from '../../../components/PageHeader';

type GridColumn = {
  id: string;
  fieldKey: string;
  title: string;
  dataType: string;
  sortable: boolean;
  filterable: boolean;
  visible: boolean;
  width: number | null;
};

type GridListItem = {
  id: string;
  name: string;
  code: string;
  pageSize: number;
  enableSort: boolean;
  enableFilter: boolean;
  enableExport: boolean;
  enableImport: boolean;
  columns: GridColumn[];
  _count?: { rows: number; savedViews: number };
};

type GridDetail = GridListItem & {
  description: string | null;
  savedViews: Array<{
    id: string;
    name: string;
    filters: unknown;
    sorts: unknown;
    isDefault: boolean;
  }>;
};

type QueryResult = {
  items: Array<Record<string, unknown> & { id: string }>;
  total: number;
  page: number;
  pageSize: number;
};

export function GridsPage() {
  const { currentOrg } = useOrg();
  const { hasPermission } = useIam();
  const [grids, setGrids] = useState<GridListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<GridDetail | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ name: '', code: '', pageSize: 10 });
  const [columnForm, setColumnForm] = useState({
    fieldKey: '',
    title: '',
    dataType: 'TEXT',
  });
  const [filterField, setFilterField] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [viewName, setViewName] = useState('');
  const [importJson, setImportJson] = useState(
    '[{"name":"Alice","status":"Active","score":90},{"name":"Bob","status":"Inactive","score":70}]',
  );

  async function loadList() {
    const list = await orgApi<GridListItem[]>('/grids');
    setGrids(list);
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }

  async function loadDetail(id: string) {
    if (!id) return;
    const d = await orgApi<GridDetail>(`/grids/${id}`);
    setDetail(d);
    const firstCol = d.columns.find((c) => c.filterable) ?? d.columns[0];
    if (firstCol) {
      setFilterField(firstCol.fieldKey);
      setSortField(firstCol.fieldKey);
    }
  }

  async function runQuery(opts?: {
    page?: number;
    filters?: Array<{ field: string; op?: string; value: string }>;
    sorts?: Array<{ field: string; dir?: 'asc' | 'desc' }>;
  }) {
    if (!detail) return;
    const nextPage = opts?.page ?? page;
    const result = await orgApi<QueryResult>(`/grids/${detail.id}/query`, {
      method: 'POST',
      body: JSON.stringify({
        page: nextPage,
        pageSize: detail.pageSize,
        filters: opts?.filters ?? (filterValue ? [{ field: filterField, op: 'eq', value: filterValue }] : []),
        sorts: opts?.sorts ?? (sortField ? [{ field: sortField, dir: sortDir }] : []),
      }),
    });
    setQueryResult(result);
    setPage(result.page);
  }

  useEffect(() => {
    if (!currentOrg) return;
    void loadList().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  useEffect(() => {
    if (!selectedId) return;
    void loadDetail(selectedId)
      .then(() => undefined)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [selectedId]);

  useEffect(() => {
    if (!detail) return;
    void runQuery({ page: 1 }).catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [detail?.id]);

  const visibleColumns = useMemo(
    () => (detail?.columns ?? []).filter((c) => c.visible),
    [detail],
  );

  async function onCreateGrid(e: FormEvent) {
    e.preventDefault();
    const created = await orgApi<GridListItem>('/grids', {
      method: 'POST',
      body: JSON.stringify({
        name: createForm.name,
        code: createForm.code,
        pageSize: Number(createForm.pageSize),
      }),
    });
    setMessage('Grid created');
    setCreateForm({ name: '', code: '', pageSize: 10 });
    await loadList();
    setSelectedId(created.id);
  }

  async function addColumn(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    await orgApi(`/grids/${detail.id}/columns`, {
      method: 'POST',
      body: JSON.stringify(columnForm),
    });
    setColumnForm({ fieldKey: '', title: '', dataType: 'TEXT' });
    await loadDetail(detail.id);
    setMessage('Column added');
  }

  async function importRows(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    const rows = JSON.parse(importJson) as Array<Record<string, unknown>>;
    await orgApi(`/grids/${detail.id}/import`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    setMessage(`Imported ${rows.length} rows`);
    await runQuery({ page: 1 });
  }

  async function exportRows() {
    if (!detail) return;
    const payload = await orgApi<{
      rows: Array<Record<string, unknown>>;
    }>(`/grids/${detail.id}/export`, {
      method: 'POST',
      body: JSON.stringify({
        filters: filterValue ? [{ field: filterField, op: 'eq', value: filterValue }] : [],
        sorts: sortField ? [{ field: sortField, dir: sortDir }] : [],
      }),
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.code.toLowerCase()}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${payload.rows.length} rows`);
  }

  async function saveView(e: FormEvent) {
    e.preventDefault();
    if (!detail || !viewName) return;
    await orgApi(`/grids/${detail.id}/views`, {
      method: 'POST',
      body: JSON.stringify({
        name: viewName,
        filters: filterValue ? [{ field: filterField, op: 'eq', value: filterValue }] : [],
        sorts: sortField ? [{ field: sortField, dir: sortDir }] : [],
        columns: visibleColumns.map((c) => c.fieldKey),
      }),
    });
    setViewName('');
    setMessage('View saved');
    await loadDetail(detail.id);
  }

  function applyView(view: GridDetail['savedViews'][number]) {
    const filters = Array.isArray(view.filters) ? view.filters : [];
    const sorts = Array.isArray(view.sorts) ? view.sorts : [];
    const f0 = filters[0] as { field?: string; value?: string } | undefined;
    const s0 = sorts[0] as { field?: string; dir?: 'asc' | 'desc' } | undefined;
    if (f0?.field) {
      setFilterField(f0.field);
      setFilterValue(String(f0.value ?? ''));
    } else {
      setFilterValue('');
    }
    if (s0?.field) {
      setSortField(s0.field);
      setSortDir(s0.dir === 'desc' ? 'desc' : 'asc');
    }
    void runQuery({
      page: 1,
      filters: filters as Array<{ field: string; op?: string; value: string }>,
      sorts: sorts as Array<{ field: string; dir?: 'asc' | 'desc' }>,
    });
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Grids</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  if (!hasPermission('menu.grids') && !hasPermission('screen.grids')) {
    return (
      <section className="panel">
        <h1>Grids</h1>
        <div className="alert error">Not authorized.</div>
      </section>
    );
  }

  const totalPages = queryResult
    ? Math.max(1, Math.ceil(queryResult.total / queryResult.pageSize))
    : 1;

  return (
    <div>
      <PageHeader
        title="Dynamic Grid Builder"
        description="Configure columns, sorting, filtering, pagination, import/export, and saved views."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <section className="section-card">
        <div className="section-card-body">

      <form className="auth-form compact" onSubmit={(e) => void onCreateGrid(e)}>
        <h2>New grid</h2>
        <div className="row-2">
          <label>
            Name
            <input
              required
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Code
            <input
              required
              value={createForm.code}
              onChange={(e) => setCreateForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Page size
          <input
            type="number"
            min={1}
            value={createForm.pageSize}
            onChange={(e) => setCreateForm((f) => ({ ...f, pageSize: Number(e.target.value) }))}
          />
        </label>
        <button className="btn primary" type="submit">
          Create grid
        </button>
      </form>

      <label className="inline-field">
        Edit grid
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {grids.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g._count?.rows ?? 0} rows)
            </option>
          ))}
        </select>
      </label>

      {detail && (
        <>
          <form className="auth-form compact" onSubmit={(e) => void addColumn(e)}>
            <h2>Add column</h2>
            <div className="row-2">
              <label>
                Field key
                <input
                  required
                  value={columnForm.fieldKey}
                  onChange={(e) => setColumnForm((f) => ({ ...f, fieldKey: e.target.value }))}
                />
              </label>
              <label>
                Title
                <input
                  required
                  value={columnForm.title}
                  onChange={(e) => setColumnForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Type
              <select
                value={columnForm.dataType}
                onChange={(e) => setColumnForm((f) => ({ ...f, dataType: e.target.value }))}
              >
                <option value="TEXT">TEXT</option>
                <option value="NUMBER">NUMBER</option>
                <option value="BOOLEAN">BOOLEAN</option>
                <option value="DATE">DATE</option>
              </select>
            </label>
            <button className="btn secondary" type="submit">
              Add column
            </button>
          </form>

          <div className="grid-toolbar">
            {detail.enableFilter && (
              <>
                <label>
                  Filter field
                  <select value={filterField} onChange={(e) => setFilterField(e.target.value)}>
                    {detail.columns
                      .filter((c) => c.filterable)
                      .map((c) => (
                        <option key={c.id} value={c.fieldKey}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Equals
                  <input value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
                </label>
              </>
            )}
            {detail.enableSort && (
              <>
                <label>
                  Sort field
                  <select value={sortField} onChange={(e) => setSortField(e.target.value)}>
                    {detail.columns
                      .filter((c) => c.sortable)
                      .map((c) => (
                        <option key={c.id} value={c.fieldKey}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                  >
                    <option value="asc">asc</option>
                    <option value="desc">desc</option>
                  </select>
                </label>
              </>
            )}
            <button className="btn secondary" type="button" onClick={() => void runQuery({ page: 1 })}>
              Apply
            </button>
            {detail.enableExport && (
              <button className="btn secondary" type="button" onClick={() => void exportRows()}>
                Export JSON
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {visibleColumns.map((c) => (
                    <th key={c.id}>{c.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(queryResult?.items ?? []).map((row) => (
                  <tr key={row.id}>
                    {visibleColumns.map((c) => (
                      <td key={c.id}>{String(row[c.fieldKey] ?? '')}</td>
                    ))}
                  </tr>
                ))}
                {!queryResult?.items.length && (
                  <tr>
                    <td colSpan={Math.max(visibleColumns.length, 1)}>No rows yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="action-row">
            <button
              className="btn secondary"
              type="button"
              disabled={page <= 1}
              onClick={() => void runQuery({ page: page - 1 })}
            >
              Prev
            </button>
            <span className="muted">
              Page {page} / {totalPages} · {queryResult?.total ?? 0} total
            </span>
            <button
              className="btn secondary"
              type="button"
              disabled={page >= totalPages}
              onClick={() => void runQuery({ page: page + 1 })}
            >
              Next
            </button>
          </div>

          {detail.enableImport && (
            <form className="auth-form compact" onSubmit={(e) => void importRows(e)}>
              <h2>Import rows (JSON array)</h2>
              <label>
                Payload
                <textarea rows={5} value={importJson} onChange={(e) => setImportJson(e.target.value)} />
              </label>
              <button className="btn secondary" type="submit">
                Import
              </button>
            </form>
          )}

          <form className="auth-form compact" onSubmit={(e) => void saveView(e)}>
            <h2>Saved views</h2>
            <label>
              View name
              <input value={viewName} onChange={(e) => setViewName(e.target.value)} required />
            </label>
            <button className="btn secondary" type="submit">
              Save current view
            </button>
            <div className="action-row">
              {detail.savedViews.map((v) => (
                <button
                  key={v.id}
                  className="btn ghost"
                  type="button"
                  onClick={() => applyView(v)}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </form>
        </>
      )}
        </div>
      </section>
    </div>
  );
}
