import { useState, useEffect } from 'react';
import { api } from '../api';
import './MCPDashboard.css';

export default function MCPDashboard() {
  const [servers, setServers] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add server form state
  const [newServer, setNewServer] = useState({
    name: '',
    type: 'http',
    url: '',
    command: '',
    args: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [serversData, healthData] = await Promise.all([
        api.mcpListServers(),
        api.mcpHealth(),
      ]);
      setServers(serversData);
      setHealth(healthData);
    } catch (e) {
      console.error('Failed to load MCP data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await api.mcpRefreshAll();
      setServers(result.servers || []);
      setHealth(result.health || null);
    } catch (e) {
      console.error('Failed to refresh:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddServer = async (e) => {
    e.preventDefault();
    try {
      const config = {
        name: newServer.name,
        type: newServer.type,
      };
      if (newServer.type === 'http') {
        config.url = newServer.url;
      } else {
        config.command = newServer.command;
        config.args = newServer.args ? newServer.args.split(' ').filter(Boolean) : [];
      }

      await api.mcpAddServer(config);
      setNewServer({ name: '', type: 'http', url: '', command: '', args: '' });
      setShowAddForm(false);
      await loadData();
    } catch (e) {
      console.error('Failed to add server:', e);
    }
  };

  const handleRemoveServer = async (serverId) => {
    try {
      await api.mcpRemoveServer(serverId);
      await loadData();
    } catch (e) {
      console.error('Failed to remove server:', e);
    }
  };

  const handleToggleConnection = async (server) => {
    try {
      if (server.connected) {
        await api.mcpDisconnectServer(server.id);
      } else {
        await api.mcpConnectServer(server.id);
      }
      await loadData();
    } catch (e) {
      console.error('Failed to toggle connection:', e);
    }
  };

  const totalTools = servers.reduce((sum, s) => sum + (s.tools_count || 0), 0);
  const connectedCount = servers.filter(s => s.connected).length;
  const overallStatus = health?.overall || (servers.length === 0 ? 'no servers' : 'offline');

  // Group tools by server
  const toolsByServer = {};
  servers.forEach(server => {
    if (server.tools && server.tools.length > 0) {
      toolsByServer[server.id] = {
        name: server.name,
        connected: server.connected,
        tools: server.tools,
      };
    }
  });

  return (
    <div className="mcp-dashboard">
      {/* Header */}
      <div className="mcp-header">
        <div className="mcp-header-text">
          <h1 className="mcp-title">MCP Tools & System Status</h1>
          <p className="mcp-subtitle">
            Monitor all {totalTools} MCP tools and system health in real-time
          </p>
        </div>
        <div className="mcp-header-actions">
          <button
            className="mcp-btn mcp-btn-outline"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Server
          </button>
          <button
            className="mcp-btn mcp-btn-outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <svg className={isRefreshing ? 'spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Status
          </button>
        </div>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="mcp-card mcp-add-form-card">
          <h3 className="mcp-card-title">Add MCP Server</h3>
          <form className="mcp-add-form" onSubmit={handleAddServer}>
            <div className="mcp-form-row">
              <div className="mcp-form-group">
                <label>Server Name</label>
                <input
                  type="text"
                  placeholder="e.g. Excalidraw"
                  value={newServer.name}
                  onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                  required
                />
              </div>
              <div className="mcp-form-group">
                <label>Transport</label>
                <select
                  value={newServer.type}
                  onChange={(e) => setNewServer({ ...newServer, type: e.target.value })}
                >
                  <option value="http">HTTP (Remote)</option>
                  <option value="stdio">Stdio (Local)</option>
                </select>
              </div>
            </div>

            {newServer.type === 'http' ? (
              <div className="mcp-form-group">
                <label>Server URL</label>
                <input
                  type="text"
                  placeholder="https://mcp.excalidraw.com/mcp"
                  value={newServer.url}
                  onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                  required
                />
              </div>
            ) : (
              <div className="mcp-form-row">
                <div className="mcp-form-group">
                  <label>Command</label>
                  <input
                    type="text"
                    placeholder="node"
                    value={newServer.command}
                    onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                    required
                  />
                </div>
                <div className="mcp-form-group" style={{ flex: 2 }}>
                  <label>Arguments (space-separated)</label>
                  <input
                    type="text"
                    placeholder="/path/to/server/dist/index.js --stdio"
                    value={newServer.args}
                    onChange={(e) => setNewServer({ ...newServer, args: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="mcp-form-actions">
              <button type="button" className="mcp-btn mcp-btn-ghost" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="mcp-btn mcp-btn-primary">
                Add & Connect
              </button>
            </div>
          </form>
        </div>
      )}

      {/* System Health */}
      <div className="mcp-card">
        <h2 className="mcp-card-title">System Health</h2>
        <p className="mcp-card-subtitle">Real-time status of all services</p>

        <div className="mcp-health-grid">
          <div className="mcp-health-item">
            <div className={`mcp-status-icon ${overallStatus === 'healthy' ? 'healthy' : overallStatus === 'degraded' ? 'degraded' : 'offline'}`}>
              {overallStatus === 'healthy' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
              )}
            </div>
            <div>
              <div className="mcp-health-label">Overall</div>
              <div className="mcp-health-value">{overallStatus === 'healthy' ? 'Healthy' : overallStatus === 'degraded' ? 'Degraded' : overallStatus === 'no servers' ? 'No Servers' : 'Offline'}</div>
            </div>
          </div>

          {servers.map(server => (
            <div key={server.id} className="mcp-health-item">
              <div className={`mcp-status-icon ${server.connected ? 'healthy' : 'offline'}`}>
                {server.connected ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                )}
              </div>
              <div>
                <div className="mcp-health-label">{server.name}</div>
                <div className="mcp-health-value">{server.connected ? `${server.last_ping_ms || '?'}ms` : server.last_error ? 'Error' : 'Disconnected'}</div>
              </div>
            </div>
          ))}

          {servers.length === 0 && !isLoading && (
            <div className="mcp-health-item mcp-health-empty">
              <div className="mcp-health-label">No servers configured</div>
              <div className="mcp-health-value">Click "Add Server" to get started</div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="mcp-stats-grid">
          <div className="mcp-stat-card">
            <div className="mcp-stat-label">Connected Servers</div>
            <div className="mcp-stat-value">{connectedCount}/{servers.length}</div>
          </div>
          <div className="mcp-stat-card">
            <div className="mcp-stat-label">Available Tools</div>
            <div className="mcp-stat-value">{totalTools}</div>
          </div>
          <div className="mcp-stat-card">
            <div className="mcp-stat-label">Status</div>
            <div className="mcp-stat-value">{isLoading ? 'Loading...' : overallStatus === 'healthy' ? 'All Connected' : 'Check Servers'}</div>
          </div>
        </div>
      </div>

      {/* Server Cards */}
      {servers.map(server => (
        <div key={server.id} className="mcp-card">
          <div className="mcp-server-header">
            <div className="mcp-server-info">
              <h2 className="mcp-card-title">
                {server.name}
                <span className={`mcp-badge ${server.connected ? 'connected' : 'disconnected'}`}>
                  {server.connected ? 'Connected' : 'Disconnected'}
                </span>
              </h2>
              <p className="mcp-card-subtitle">
                {server.type === 'http' ? server.url : `${server.command} (stdio)`}
                {server.server_info?.name && ` - ${server.server_info.name}`}
                {server.server_info?.version && ` v${server.server_info.version}`}
              </p>
            </div>
            <div className="mcp-server-actions">
              <button
                className={`mcp-btn mcp-btn-sm ${server.connected ? 'mcp-btn-ghost' : 'mcp-btn-primary'}`}
                onClick={() => handleToggleConnection(server)}
              >
                {server.connected ? 'Disconnect' : 'Connect'}
              </button>
              <button
                className="mcp-btn mcp-btn-sm mcp-btn-danger"
                onClick={() => handleRemoveServer(server.id)}
              >
                Remove
              </button>
            </div>
          </div>

          {server.last_error && (
            <div className="mcp-error-banner">
              {server.last_error}
            </div>
          )}

          {/* Tools grid */}
          {server.tools && server.tools.length > 0 && (
            <>
              <h3 className="mcp-tools-heading">
                Tools ({server.tools.length})
              </h3>
              <div className="mcp-tools-grid">
                {server.tools.map((tool, i) => (
                  <div key={i} className="mcp-tool-card">
                    <div className="mcp-tool-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                      </svg>
                    </div>
                    <div className="mcp-tool-info">
                      <div className="mcp-tool-name">{tool.name}</div>
                      <div className="mcp-tool-desc">{tool.description || 'No description'}</div>
                    </div>
                    <div className={`mcp-tool-status ${server.connected ? 'ready' : ''}`}>
                      {server.connected ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {server.connected && server.tools_count === 0 && (
            <p className="mcp-no-tools">No tools discovered from this server.</p>
          )}
        </div>
      ))}

      {/* Empty state */}
      {servers.length === 0 && !isLoading && (
        <div className="mcp-empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
          <h3>No MCP Servers Configured</h3>
          <p>Add an MCP server to extend your council with external tools like Excalidraw, Jira, GitHub, and more.</p>
          <button className="mcp-btn mcp-btn-primary" onClick={() => setShowAddForm(true)}>
            Add Your First Server
          </button>
        </div>
      )}
    </div>
  );
}
