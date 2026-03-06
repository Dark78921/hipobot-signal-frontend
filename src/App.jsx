import { useEffect, useMemo, useState } from 'react';

const EMPTY_ERRORS = {};

function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(digits);
}

function formatPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `${Math.round(Number(value))}%`;
}

function formatBarTime(tsSeconds) {
  if (!tsSeconds) return '-';
  return new Date(tsSeconds * 1000).toLocaleString();
}

function formatSnapshotTime(tsMillis) {
  if (!tsMillis) return 'Waiting for first event...';
  return new Date(tsMillis).toLocaleString();
}

function actionClass(action) {
  if (action === 'LONG') return 'pill pill-long';
  if (action === 'SHORT') return 'pill pill-short';
  return 'pill pill-skip';
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

function SignalCard({ coin, signal }) {
  const action = signal.action || 'SKIP';

  return (
    <article className="card signal-card">
      <div className="card-head">
        <div>
          <h3>{coin}</h3>
          <p className="setup-type">{signal.setupType || 'UNKNOWN'}</p>
        </div>
        <span className={actionClass(action)}>{action}</span>
      </div>

      <div className="metric-grid">
        <Metric label="Confidence" value={formatPercent(signal.confidence)} />
        <Metric label="Trend" value={formatNumber(signal.trendScore)} />
        <Metric label="RSI" value={formatNumber(signal.rsi)} />
        <Metric label="Low Score" value={formatNumber(signal.lowScore)} />
        <Metric label="High Score" value={formatNumber(signal.highScore)} />
        <Metric label="ATR" value={formatNumber(signal.atr, 4)} />
      </div>

      <div className="reason-box">
        <span className="section-label">Reason</span>
        <p>{signal.reason || 'No reason provided.'}</p>
      </div>

      <div className="signal-footer">
        <span>Signal bar: {formatBarTime(signal.barTime)}</span>
        <span>{signal.confOk ? 'Confidence OK' : 'Below min confidence'}</span>
      </div>
    </article>
  );
}

function ErrorList({ errors }) {
  const entries = Object.entries(errors || EMPTY_ERRORS);

  if (!entries.length) {
    return <div className="empty-inline">No backend errors in the latest snapshot.</div>;
  }

  return (
    <div className="error-list">
      {entries.map(([coin, message]) => (
        <div className="error-item" key={coin}>
          <strong>{coin}</strong>
          <div>{String(message)}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState({ ts: null, signals: {}, errors: EMPTY_ERRORS });
  const [connection, setConnection] = useState('connecting');
  const [streamMessage, setStreamMessage] = useState('Streaming from `/signals/stream`');

  const signalEntries = useMemo(
    () => Object.entries(snapshot.signals || {}).sort((a, b) => a[0].localeCompare(b[0])),
    [snapshot.signals]
  );
  const activeCount = signalEntries.filter(([, signal]) => signal.action && signal.action !== 'SKIP').length;
  const errorEntries = Object.entries(snapshot.errors || EMPTY_ERRORS);

  async function refreshNow() {
    try {
      setConnection('refreshing');
      const response = await fetch('/signals');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setSnapshot({
        ts: payload.ts || Date.now(),
        signals: payload.signals || {},
        errors: payload.errors || EMPTY_ERRORS,
      });
      setConnection('live');
      setStreamMessage('Streaming from `/signals/stream`');
    } catch (error) {
      setConnection('error');
      setStreamMessage(`Manual refresh failed: ${error.message}`);
    }
  }

  useEffect(() => {
    if (!window.EventSource) {
      setConnection('error');
      setStreamMessage('SSE is not supported in this browser. Using manual refresh only.');
      refreshNow();
      return undefined;
    }

    const source = new EventSource('/signals/stream');

    source.addEventListener('signals', (event) => {
      const payload = JSON.parse(event.data);
      setSnapshot({
        ts: payload.ts || Date.now(),
        signals: payload.signals || {},
        errors: payload.errors || EMPTY_ERRORS,
      });
      setConnection('live');
      setStreamMessage('Streaming from `/signals/stream`');
    });

    source.addEventListener('backend_error', (event) => {
      const payload = JSON.parse(event.data);
      setConnection('error');
      setStreamMessage(`Latest evaluation failed: ${payload.error || 'Unknown error'}`);
      setSnapshot((current) => ({ ...current, ts: payload.ts || current.ts }));
    });

    source.onerror = () => {
      setConnection('connecting');
      setStreamMessage('Stream interrupted, waiting for browser auto-reconnect.');
    };

    refreshNow();

    return () => {
      source.close();
    };
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Signal Backend</p>
          <h1>Pair8 Live Signals</h1>
          <p className="subtitle">
            React dashboard for the event-driven signal service. Live updates arrive through
            the backend SSE stream.
          </p>
        </div>

        <div className="hero-actions">
          <span className={`status-badge status-${connection}`}>
            {connection === 'live' && 'Live stream'}
            {connection === 'connecting' && 'Connecting...'}
            {connection === 'refreshing' && 'Refreshing...'}
            {connection === 'error' && 'Needs attention'}
          </span>
          <button className="refresh-button" type="button" onClick={refreshNow}>
            Refresh now
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="summary-grid">
          <div className="card summary-card">
            <span className="summary-label">Last update</span>
            <strong>{formatSnapshotTime(snapshot.ts)}</strong>
          </div>
          <div className="card summary-card">
            <span className="summary-label">Tracked coins</span>
            <strong>{signalEntries.length}</strong>
          </div>
          <div className="card summary-card">
            <span className="summary-label">Active signals</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="card summary-card">
            <span className="summary-label">Errors</span>
            <strong>{errorEntries.length}</strong>
          </div>
        </section>

        <section className="card panel">
          <div className="panel-head">
            <h2>Signals</h2>
            <p className="panel-copy">{streamMessage}</p>
          </div>

          {signalEntries.length ? (
            <div className="signal-grid">
              {signalEntries.map(([coin, signal]) => (
                <SignalCard coin={coin} signal={signal} key={coin} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No data yet</h3>
              <p>The dashboard will populate after the backend publishes a signal snapshot.</p>
            </div>
          )}
        </section>

        <section className="card panel">
          <div className="panel-head">
            <h2>Backend Errors</h2>
            <p className="panel-copy">Per-coin fetch or computation issues from the latest snapshot.</p>
          </div>
          <ErrorList errors={snapshot.errors} />
        </section>
      </main>
    </div>
  );
}
