import { FormEvent, useEffect, useMemo, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';
import { PageHeader } from '../../../components/PageHeader';

const ENTITIES = [
  'customers',
  'dealers',
  'employees',
  'vendors',
  'vehicles',
  'parts',
  'products',
  'warehouses',
] as const;

type Entity = (typeof ENTITIES)[number];

type MasterRow = Record<string, unknown> & { id: string; code: string; isActive?: boolean };

const CREATE_FIELDS: Record<Entity, string[]> = {
  customers: ['code', 'name', 'email', 'phone', 'company', 'city'],
  dealers: ['code', 'name', 'email', 'phone', 'company', 'region'],
  employees: ['code', 'firstName', 'lastName', 'email', 'phone', 'designation', 'department'],
  vendors: ['code', 'name', 'email', 'phone', 'company', 'contactPerson'],
  vehicles: ['code', 'name', 'make', 'model', 'registrationNo', 'vin'],
  parts: ['code', 'name', 'sku', 'unit', 'price', 'category'],
  products: ['code', 'name', 'sku', 'unit', 'price', 'category'],
  warehouses: ['code', 'name', 'city', 'state', 'country', 'phone'],
};

export function MastersPage() {
  const { currentOrg } = useOrg();
  const [entity, setEntity] = useState<Entity>('customers');
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fields = useMemo(() => CREATE_FIELDS[entity], [entity]);

  async function load() {
    const list = await orgApi<MasterRow[]>(`/masters/${entity}`);
    setRows(list);
  }

  useEffect(() => {
    if (!currentOrg) return;
    setForm({});
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id, entity]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { ...form };
    if (body.price !== undefined && body.price !== '') body.price = Number(body.price);
    await orgApi(`/masters/${entity}`, { method: 'POST', body: JSON.stringify(body) });
    setMessage(`${entity.slice(0, -1)} created`);
    setForm({});
    await load();
  }

  async function deactivate(id: string) {
    await orgApi(`/masters/${entity}/${id}`, { method: 'DELETE' });
    setMessage('Deactivated');
    await load();
  }

  if (!currentOrg) {
    return (
      <section className="panel">
        <PageHeader title="Masters" description="Select an organization first." />
      </section>
    );
  }

  return (
    <div>
      <PageHeader
        title="Business Masters"
        description="Maintain customers, dealers, employees, vendors, vehicles, parts, products, and warehouses."
      />

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="segmented" role="tablist" aria-label="Master entities">
        {ENTITIES.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={entity === e}
            className={`btn ${entity === e ? 'primary' : ''}`}
            onClick={() => setEntity(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <section className="section-card">
        <div className="section-card-head">
          <h2>Add {entity.slice(0, -1)}</h2>
        </div>
        <div className="section-card-body">
          <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
            <div className="row-2">
              {fields.map((field) => (
                <label key={field}>
                  {field}
                  <input
                    required={['code', 'name', 'firstName', 'lastName'].includes(field)}
                    value={form[field] ?? ''}
                    onChange={(ev) => setForm((f) => ({ ...f, [field]: ev.target.value }))}
                  />
                </label>
              ))}
            </div>
            <button className="btn primary" type="submit">
              Create record
            </button>
          </form>
        </div>
      </section>

      <section className="section-card">
        <div className="section-card-head">
          <h2>
            {entity} <span className="muted tiny">({rows.length})</span>
          </h2>
        </div>
        <div className="table-wrap" style={{ border: 0, borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Details</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const name =
                  entity === 'employees'
                    ? `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim()
                    : String(row.name ?? '');
                return (
                  <tr key={row.id}>
                    <td>
                      <code className="mono">{row.code}</code>
                    </td>
                    <td>{name}</td>
                    <td className="muted">
                      {String(
                        row.email ?? row.phone ?? row.city ?? row.sku ?? row.registrationNo ?? '—',
                      )}
                    </td>
                    <td>
                      <span className={`pill ${row.isActive === false ? '' : 'ok'}`}>
                        {row.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td>
                      {row.isActive !== false && (
                        <button
                          className="btn ghost sm"
                          type="button"
                          onClick={() => void deactivate(row.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <strong>No records yet</strong>
                      Create the first {entity.slice(0, -1)} using the form above.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
