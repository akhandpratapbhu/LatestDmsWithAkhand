import { useEffect, useState } from 'react';
import { orgApi } from '../../../lib/api';
import { useOrg } from '../../org/org-context';

type CallRow = {
  id: string;
  callType: string;
  status: string;
  contactKind: string | null;
  contactId: string | null;
  calleeUserId: string | null;
  screenShare: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  recordings?: Array<{ id: string; fileUrl: string; fileName: string | null; durationSec: number | null }>;
};

export function CallsPage() {
  const { currentOrg } = useOrg();
  const [rows, setRows] = useState<CallRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentOrg) return;
    void orgApi<CallRow[]>('/calls/history')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, [currentOrg?.id]);

  if (!currentOrg) {
    return (
      <section className="panel">
        <h1>Calls</h1>
        <p className="lede">Select an organization first.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>Call History</h1>
      <p className="lede">Audio/video calls with users and Customer / Dealer / Employee contacts.</p>
      {error && <div className="alert error">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Status</th>
              <th>Contact</th>
              <th>Screen</th>
              <th>Recording</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.createdAt).toLocaleString()}</td>
                <td>{r.callType}</td>
                <td>{r.status}</td>
                <td>
                  {r.contactKind
                    ? `${r.contactKind}:${r.contactId?.slice(0, 8)}`
                    : r.calleeUserId?.slice(0, 8) || '—'}
                </td>
                <td>{r.screenShare ? 'Yes' : 'No'}</td>
                <td>
                  {r.recordings?.length ? (
                    <a href={r.recordings[0].fileUrl} target="_blank" rel="noreferrer">
                      {r.recordings[0].fileName || 'Open'}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6}>No calls yet — start one from Chat.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
