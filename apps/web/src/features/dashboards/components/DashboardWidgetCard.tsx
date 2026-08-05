import type { DashboardWidgetConfig } from '@dms/shared';
import { LiveDashboardContext, resolveWidgetValue } from '../live-data';

type WidgetView = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
};

type Props = {
  widget: WidgetView;
  live?: LiveDashboardContext;
  /** Show type / dataSource meta (builder preview) */
  showMeta?: boolean;
  onDelete?: () => void;
};

export function DashboardWidgetCard({ widget, live = {}, showMeta, onDelete }: Props) {
  const cfg = widget.config as DashboardWidgetConfig;
  const resolved = resolveWidgetValue(cfg, live);
  const series = Array.isArray(cfg.series)
    ? (cfg.series as Array<{ label: string; value: number }>)
    : null;

  return (
    <article className={`widget widget-${widget.type.toLowerCase()}`}>
      <div className="widget-head">
        <h3>{widget.title}</h3>
        {onDelete && (
          <button className="btn ghost tiny" type="button" onClick={onDelete}>
            Remove
          </button>
        )}
      </div>
      {showMeta && (
        <p className="muted tiny">
          {widget.type}
          {cfg.dataSource ? ` · ${cfg.dataSource}` : ''}
        </p>
      )}

      {widget.type === 'CHART' && series ? (
        <div className="chart-bars">
          {series.map((s) => (
            <div key={s.label} className="chart-bar-wrap">
              <div className="chart-bar" style={{ height: `${Math.max(8, s.value * 4)}px` }} />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      ) : resolved.rows ? (
        resolved.rows.length ? (
          <ul className="widget-list">
            {resolved.rows.map((row, i) => (
              <li key={`${row.primary}-${i}`}>
                <strong>{row.primary}</strong>
                {row.secondary && <span className="muted tiny">{row.secondary}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="widget-empty">{resolved.display}</p>
        )
      ) : widget.type === 'TEXT' ? (
        <p className="widget-text">{resolved.display}</p>
      ) : (
        <p className="widget-stat">{resolved.display}</p>
      )}
    </article>
  );
}
