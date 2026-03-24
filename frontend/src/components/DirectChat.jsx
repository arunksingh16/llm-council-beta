import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SearchableModelSelect from './SearchableModelSelect';
import McpToolsPill from './McpToolsPill';
import { api } from '../api';
import './DirectChat.css';

const getShortModelName = (modelId) => {
  if (!modelId) return 'Unknown';
  if (modelId.includes('/')) return modelId.split('/').pop();
  if (modelId.includes(':')) return modelId.split(':').pop();
  return modelId;
};

const buildExcalidrawHtml = (elementsJson) => {
  // Filter out pseudo-elements (cameraUpdate, delete) that Excalidraw doesn't understand
  let elements;
  try {
    const raw = typeof elementsJson === 'string' ? JSON.parse(elementsJson) : elementsJson;
    elements = raw.filter(el => el.type !== 'cameraUpdate' && el.type !== 'delete');
  } catch {
    elements = [];
  }
  const scene = JSON.stringify({
    type: "excalidraw",
    version: 2,
    elements: elements,
    appState: { viewBackgroundColor: "#ffffff", gridSize: null },
  });
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style>
</head><body>
<div id="root" style="width:100%;height:100%"></div>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/@excalidraw/excalidraw/dist/excalidraw.production.min.js"><\/script>
<script>
(function(){
  var scene = ${scene};
  var root = ReactDOM.createRoot(document.getElementById("root"));
  root.render(
    React.createElement(ExcalidrawLib.Excalidraw, {
      initialData: scene,
      viewModeEnabled: true,
      zenModeEnabled: true,
      gridModeEnabled: false,
      UIOptions: { canvasActions: { export: false, loadScene: false, saveToActiveFile: false, toggleTheme: false } }
    })
  );
})();
<\/script>
</body></html>`;
};

export default function DirectChat({ councilModels, onOpenSettings }) {
  // Conversation state
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);

  // Input state
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [webSearch, setWebSearch] = useState(false);
  const [searchStatus, setSearchStatus] = useState(null); // null | 'searching' | 'done'

  // File attachments
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load models and conversations on mount
  useEffect(() => {
    loadModels();
    loadConversations();
  }, []);

  // Auto-select first council model if none selected
  useEffect(() => {
    if (!selectedModel && councilModels.length > 0) {
      setSelectedModel(councilModels[0]);
    }
  }, [councilModels, selectedModel]);

  // Load conversation when selected
  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    } else {
      setMessages([]);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations('direct');
      setConversations(convs);
    } catch (e) {
      console.error('Failed to load conversations:', e);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      if (conv) {
        setMessages(conv.messages || []);
      }
    } catch (e) {
      console.error('Failed to load conversation:', e);
    }
  };

  const handleNewChat = async () => {
    try {
      const newConv = await api.createConversation('direct');
      setConversations(prev => [
        { id: newConv.id, created_at: newConv.created_at, title: 'New Chat', type: 'direct', message_count: 0 },
        ...prev,
      ]);
      setCurrentConversationId(newConv.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create conversation:', e);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (id === currentConversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to delete conversation:', e);
    }
  };

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const settings = await api.getSettings();
      const allModels = [];
      const seen = new Set();

      const addModel = (id, name, provider, source) => {
        const key = id.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          allModels.push({ id, name, provider, source });
        }
      };

      try {
        const directModels = await api.getDirectModels();
        if (directModels?.models) {
          directModels.models.forEach(m => addModel(m.id, m.name, m.provider, 'direct'));
        }
      } catch (e) { /* ignore */ }

      try {
        const ollamaModels = await api.getOllamaModels(settings.ollama_base_url);
        if (ollamaModels?.models) {
          ollamaModels.models.forEach(m => addModel(m.id || `ollama:${m.name}`, m.name, 'Ollama', 'ollama'));
        }
      } catch (e) { /* ignore */ }

      if (settings.bedrock_api_key_set) {
        try {
          const bedrockModels = await api.getBedrockModels();
          if (bedrockModels?.models) {
            bedrockModels.models.forEach(m => addModel(m.id, m.name || m.id, 'Bedrock', 'bedrock'));
          }
        } catch (e) { /* ignore */ }
      }

      if (settings.azure_api_key_set) {
        try {
          const azureModels = await api.getAzureModels();
          if (azureModels?.models) {
            azureModels.models.forEach(m => addModel(m.id, m.name || m.id, 'Azure', 'azure'));
          }
        } catch (e) { /* ignore */ }
      }

      if (settings.openrouter_api_key_set) {
        try {
          const orModels = await api.getModels();
          if (orModels?.models) {
            orModels.models
              .filter(m => m.id?.includes('/'))
              .slice(0, 100)
              .forEach(m => addModel(m.id, m.name, 'OpenRouter', 'openrouter'));
          }
        } catch (e) { /* ignore */ }
      }

      if (settings.custom_endpoint_url) {
        try {
          const customModels = await api.getCustomEndpointModels();
          if (customModels?.models) {
            customModels.models.forEach(m => addModel(m.id, m.name || m.id, 'Custom', 'custom'));
          }
        } catch (e) { /* ignore */ }
      }

      setAvailableModels(allModels);
    } catch (e) {
      console.error('Failed to load models:', e);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) scrollToBottom();
  }, [messages]);

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setSearchStatus(null);
    }
  };

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const result = await api.uploadFiles(files);
      const newFiles = result.files.filter(f => f.content !== null);
      setAttachedFiles(prev => [...prev, ...newFiles].slice(0, 5));
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedModel) return;

    // Auto-create conversation if none selected
    let convId = currentConversationId;
    if (!convId) {
      try {
        const newConv = await api.createConversation('direct');
        convId = newConv.id;
        setConversations(prev => [
          { id: newConv.id, created_at: newConv.created_at, title: 'New Chat', type: 'direct', message_count: 0 },
          ...prev,
        ]);
        setCurrentConversationId(convId);
      } catch (e) {
        console.error('Failed to create conversation:', e);
        return;
      }
    }

    const userContent = input.trim();
    const userMessage = { role: 'user', content: userContent };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    setSearchStatus(null);

    // Build attached content
    let attachedContent = null;
    let attachedFileNames = null;
    if (attachedFiles.length > 0) {
      attachedContent = attachedFiles.map(f => `[File: ${f.name}]\n${f.content}`).join('\n\n');
      attachedFileNames = attachedFiles.map(f => f.name);
      setAttachedFiles([]);
    }

    // Add placeholder for assistant response
    setMessages([...newMessages, { role: 'assistant', content: '', model: selectedModel, loading: true }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await api.sendDirectChatStream(
        {
          conversationId: convId,
          model: selectedModel,
          content: userContent,
          temperature,
          webSearch,
          attachedContent,
          attachedFiles: attachedFileNames,
        },
        (eventType, event) => {
          if (eventType === 'search_start') {
            setSearchStatus('searching');
          } else if (eventType === 'search_complete') {
            setSearchStatus('done');
          } else if (eventType === 'response_complete') {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: event.data.content,
                model: event.data.model,
                loading: false,
                tool_use_log: event.data.tool_use_log || [],
              };
              return updated;
            });
          } else if (eventType === 'title_complete') {
            // Update conversation title in sidebar
            setConversations(prev =>
              prev.map(c => c.id === convId ? { ...c, title: event.data.title } : c)
            );
          } else if (eventType === 'error') {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: 'assistant',
                content: `Error: ${event.message}`,
                model: selectedModel,
                loading: false,
                error: true,
              };
              return updated;
            });
          }
        },
        controller.signal
      );

      // Refresh conversation list to update message count
      loadConversations();
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          if (updated[updated.length - 1]?.loading) {
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `Error: ${err.message}`,
              model: selectedModel,
              loading: false,
              error: true,
            };
          }
          return updated;
        });
      }
    } finally {
      setIsLoading(false);
      setSearchStatus(null);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="direct-chat">
      {/* Sidebar with conversation history */}
      <div className="direct-chat-sidebar">
        <div className="direct-sidebar-header">
          <span className="direct-sidebar-title">Chats</span>
          <button className="direct-sidebar-new" onClick={handleNewChat} title="New Chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
        <div className="direct-sidebar-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`direct-sidebar-item ${conv.id === currentConversationId ? 'active' : ''}`}
              onClick={() => setCurrentConversationId(conv.id)}
            >
              <span className="direct-sidebar-item-title">
                {conv.title || 'New Chat'}
              </span>
              <button
                className="direct-sidebar-item-delete"
                onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                title="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="direct-sidebar-empty">No conversations yet</div>
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="direct-chat-main">
        {/* Model selector bar */}
        <div className="direct-chat-header">
          <div className="direct-chat-model-select">
            <label className="direct-chat-label">Model</label>
            <div className="direct-chat-select-wrapper">
              <SearchableModelSelect
                models={availableModels}
                value={selectedModel}
                onChange={setSelectedModel}
                placeholder="Select a model..."
                isDisabled={isLoading}
                isLoading={isLoadingModels}
              />
            </div>
          </div>
          <div className="direct-chat-controls">
            <div className="direct-chat-temp">
              <label className="direct-chat-label">Temp: {temperature.toFixed(1)}</label>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="temp-slider"
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="direct-chat-messages" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="direct-chat-empty">
              <div className="direct-chat-empty-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <h2>Direct Chat</h2>
              <p>Chat one-on-one with any model. History is saved automatically.</p>
              {!selectedModel && (
                <p className="direct-chat-empty-hint">
                  Select a model above to get started, or{' '}
                  <button className="config-link" onClick={() => onOpenSettings('llm_keys')}>
                    configure providers
                  </button>
                </p>
              )}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`direct-msg ${msg.role} ${msg.error ? 'error' : ''}`}>
                <div className="direct-msg-header">
                  {msg.role === 'user' ? 'You' : getShortModelName(msg.model)}
                </div>
                <div className="direct-msg-content">
                  {msg.tool_use_log && msg.tool_use_log.length > 0 && (
                    <div className="tool-use-section">
                      <div className="tool-use-banner">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                        <span>Used {msg.tool_use_log.length} tool{msg.tool_use_log.length !== 1 ? 's' : ''}:</span>
                        {msg.tool_use_log.map((t, i) => (
                          <span key={i} className="tool-use-tag">{t.tool}</span>
                        ))}
                      </div>
                      {msg.tool_use_log.map((t, i) => (
                        t.excalidraw_elements ? (
                          <div key={i} className="tool-use-viewer">
                            <iframe
                              srcDoc={buildExcalidrawHtml(t.excalidraw_elements)}
                              title="Excalidraw Diagram"
                              sandbox="allow-scripts"
                              style={{ width: '100%', height: '500px', border: '1px solid var(--border-color)', borderRadius: '8px', background: '#fff' }}
                            />
                          </div>
                        ) : t.image ? (
                          <div key={i} className="tool-use-image">
                            <img src={`data:${t.image.mimeType};base64,${t.image.data}`} alt={`${t.tool} output`} />
                          </div>
                        ) : null
                      ))}
                    </div>
                  )}
                  {msg.loading ? (
                    <div className="direct-msg-loading">
                      {searchStatus === 'searching' && (
                        <div className="direct-search-status">
                          <div className="spinner"></div>
                          <span>Searching the web...</span>
                        </div>
                      )}
                      <div className="typing-dots">
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  ) : (
                    <div className="markdown-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {typeof msg.content === 'string' ? msg.content : String(msg.content || '')}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} style={{ height: '20px' }} />
        </div>

        {/* Input area */}
        <div className="direct-chat-input-area">
          <form className="direct-chat-input-container" onSubmit={handleSubmit}>
            {/* Attached Files Chips */}
            {attachedFiles.length > 0 && (
              <div className="direct-attached-files">
                {attachedFiles.map((f, i) => (
                  <span key={i} className="file-chip">
                    <span className="file-chip-icon">📎</span>
                    <span className="file-chip-name">{f.name}</span>
                    <button
                      type="button"
                      className="file-chip-remove"
                      onClick={() => removeAttachedFile(i)}
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="direct-input-row">
              {/* Web Search Toggle */}
              <label className={`search-toggle ${webSearch ? 'active' : ''}`} title="Toggle Web Search">
                <input
                  type="checkbox"
                  className="search-checkbox"
                  checked={webSearch}
                  onChange={() => setWebSearch(!webSearch)}
                  disabled={isLoading}
                />
                <span className="search-icon">🌐</span>
                {webSearch && <span className="search-label-mini">Search</span>}
              </label>

              <McpToolsPill models={selectedModel ? [selectedModel] : []} />

              {/* File Attach */}
              <button
                type="button"
                className={`attachment-toggle ${attachedFiles.length > 0 ? 'active' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isUploading}
                title="Attach files"
              >
                {isUploading ? (
                  <span className="attachment-spinner"></span>
                ) : (
                  <span className="attachment-icon">📎</span>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="file-input-hidden"
                onChange={handleFileSelect}
                accept=".txt,.md,.py,.js,.ts,.jsx,.tsx,.css,.html,.json,.csv,.xml,.yaml,.yml,.toml,.sh,.sql,.pdf,.rs,.go,.java,.c,.cpp,.h,.rb,.swift,.kt,.log,.env,.ini,.cfg"
              />

              <textarea
                className="direct-chat-input"
                placeholder={
                  !selectedModel
                    ? 'Select a model first...'
                    : isLoading
                      ? 'Waiting for response...'
                      : 'Type a message...'
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !selectedModel}
                rows={1}
              />

              {isLoading ? (
                <button type="button" className="direct-chat-send stop" onClick={handleAbort} title="Stop">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  className="direct-chat-send"
                  disabled={!input.trim() || !selectedModel}
                  title="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
