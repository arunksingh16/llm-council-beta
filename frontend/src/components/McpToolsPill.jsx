import { useState, useEffect } from 'react';
import { api } from '../api';
import './McpToolsPill.css';

// Providers that reliably support function calling / tool use
const TOOL_SUPPORTED_PREFIXES = [
  'openai', 'anthropic', 'groq', 'openrouter',
  'deepseek', 'mistral', 'custom', 'azure',
];

function modelSupportsTools(modelId) {
  if (!modelId) return false;
  const prefix = modelId.includes(':') ? modelId.split(':')[0] : 'openrouter';
  return TOOL_SUPPORTED_PREFIXES.includes(prefix);
}

/**
 * MCP Tools pill indicator.
 * Shows tool count when MCP tools are connected AND at least one
 * of the active models supports function calling.
 *
 * @param {string[]} models - Array of currently active model IDs
 *   (council members for Council, single model for Direct Chat)
 */
export default function McpToolsPill({ models = [] }) {
  const [toolCount, setToolCount] = useState(0);
  const [tools, setTools] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadTools();
    const interval = setInterval(loadTools, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadTools = async () => {
    try {
      const data = await api.mcpAllTools();
      setTools(data.tools || []);
      setToolCount((data.tools || []).length);
    } catch {
      setToolCount(0);
      setTools([]);
    }
  };

  // Check if any active model supports tools
  const anyModelSupported = models.length === 0
    ? false
    : models.some(m => modelSupportsTools(m));

  if (toolCount === 0 || !anyModelSupported) return null;

  return (
    <div className="mcp-tools-pill-wrapper">
      <button
        type="button"
        className="mcp-tools-pill"
        onClick={() => setExpanded(!expanded)}
        title={`${toolCount} MCP tool${toolCount !== 1 ? 's' : ''} available`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span className="mcp-tools-pill-count">{toolCount}</span>
      </button>

      {expanded && (
        <div className="mcp-tools-dropdown">
          <div className="mcp-tools-dropdown-header">
            MCP Tools Available
          </div>
          {tools.map((tool, i) => (
            <div key={i} className="mcp-tools-dropdown-item">
              <span className="mcp-tools-dropdown-name">{tool.name}</span>
              <span className="mcp-tools-dropdown-server">{tool.server_name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
