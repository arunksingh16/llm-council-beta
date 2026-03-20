import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const LEVEL_COLORS = {
  DEBUG: '#888',
  INFO: '#3b82f6',
  WARNING: '#fbbf24',
  ERROR: '#ef4444',
  CRITICAL: '#dc2626',
};

function AuditLog() {
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState('');
  const lastIdRef = useRef(0);
  const intervalRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (expanded) {
      // Start polling
      const poll = async () => {
        try {
          const data = await api.getAuditLogs(lastIdRef.current);
          if (data.entries && data.entries.length > 0) {
            setEntries(prev => {
              const combined = [...prev, ...data.entries];
              // Keep last 500 entries in UI
              return combined.slice(-500);
            });
            lastIdRef.current = data.entries[data.entries.length - 1].id;
          }
        } catch (e) {
          // Silently ignore polling errors
        }
      };
      poll();
      intervalRef.current = setInterval(poll, 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [expanded]);

  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const handleClear = async () => {
    try {
      await api.clearAuditLogs();
      setEntries([]);
      lastIdRef.current = 0;
    } catch (e) {
      console.error('Failed to clear logs:', e);
    }
  };

  const filteredEntries = filter
    ? entries.filter(e =>
        e.message.toLowerCase().includes(filter.toLowerCase()) ||
        e.source.toLowerCase().includes(filter.toLowerCase()) ||
        e.level.toLowerCase().includes(filter.toLowerCase())
      )
    : entries;

  const formatTime = (ts) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  return (
    <div className="audit-log-container">
      <button
        className="audit-log-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="audit-log-toggle-icon">{expanded ? '\u25BC' : '\u25B6'}</span>
        <span>Audit Log</span>
        {entries.length > 0 && (
          <span className="audit-log-badge">{entries.length}</span>
        )}
      </button>

      {expanded && (
        <div className="audit-log-panel">
          <div className="audit-log-toolbar">
            <input
              type="text"
              className="audit-log-filter"
              placeholder="Filter logs..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
            <label className="audit-log-autoscroll">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={e => setAutoScroll(e.target.checked)}
              />
              Auto-scroll
            </label>
            <button className="audit-log-clear" onClick={handleClear}>Clear</button>
            <button className="audit-log-minimize" onClick={() => setExpanded(false)} title="Minimize">&#x2015;</button>
          </div>
          <div className="audit-log-entries">
            {filteredEntries.length === 0 ? (
              <div className="audit-log-empty">No log entries yet. Perform an action to see logs.</div>
            ) : (
              filteredEntries.map(entry => (
                <div key={entry.id} className="audit-log-entry">
                  <span className="audit-log-time">{formatTime(entry.timestamp)}</span>
                  <span
                    className="audit-log-level"
                    style={{ color: LEVEL_COLORS[entry.level] || '#888' }}
                  >
                    {entry.level}
                  </span>
                  <span className="audit-log-source">{entry.source}</span>
                  <span className="audit-log-message">{entry.message}</span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLog;
