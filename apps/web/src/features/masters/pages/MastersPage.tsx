import { FormEvent, useEffect, useMemo, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';

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
        <h1>Masters</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Business Masters</h1>
      <p className="lede">Customer, dealer, employee, vendor, vehicle, part, product, warehouse.</p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert success">{message}</div>}

      <div className="action-row wrap">
        {ENTITIES.map((e) => (
          <button
            key={e}
            type="button"
            className={`btn ${entity === e ? 'primary' : 'secondary'}`}
            onClick={() => setEntity(e)}
          >
            {e}
          </button>
        ))}
      </div>

      <form className="auth-form compact" onSubmit={(e) => void onCreate(e)}>
        <h2>Add {entity.slice(0, -1)}</h2>
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
          Create
        </button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Details</th>
              <th>Active</th>
              <th />
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
                  <td>{row.code}</td>
                  <td>{name}</td>
                  <td className="muted">
                    {String(row.email ?? row.phone ?? row.city ?? row.sku ?? row.registrationNo ?? '—')}
                  </td>
                  <td>{row.isActive === false ? 'No' : 'Yes'}</td>
                  <td>
                    {row.isActive !== false && (
                      <button className="btn ghost" type="button" onClick={() => void deactivate(row.id)}>
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={5}>No records</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
