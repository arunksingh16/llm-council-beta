import StageTimer from './StageTimer';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SearchContext from './SearchContext';
import Stage1, { Stage1Skeleton } from './Stage1';
import Stage2, { Stage2Skeleton } from './Stage2';
import Stage3, { Stage3Skeleton } from './Stage3';
import CouncilGrid from './CouncilGrid';
import ExecutionModeToggle from './ExecutionModeToggle';
import { api } from '../api';
import './ChatInterface.css';

export default function ChatInterface({
    conversation,
    onSendMessage,
    onAbort,
    isLoading,
    councilConfigured,
    onOpenSettings,
    councilModels = [],
    chairmanModel = null,
    executionMode,
    onExecutionModeChange,
    searchProvider = 'duckduckgo',
}) {
    const [input, setInput] = useState('');
    const [webSearch, setWebSearch] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState([]); // [{name, content, size}]
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Only auto-scroll if user is already near the bottom
    // This prevents interrupting reading when new content arrives
    useEffect(() => {
        if (!messagesContainerRef.current) return;

        const container = messagesContainerRef.current;
        const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 150;

        // Auto-scroll only if user is already at/near bottom
        if (isNearBottom) {
            scrollToBottom();
        }
    }, [conversation]);

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

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            // Build attached content string from files
            let attachedContent = null;
            let attachedFileNames = null;
            if (attachedFiles.length > 0) {
                attachedContent = attachedFiles
                    .map(f => `[File: ${f.name}]\n${f.content}`)
                    .join('\n\n');
                attachedFileNames = attachedFiles.map(f => f.name);
            }
            onSendMessage(input, webSearch, attachedContent, attachedFileNames);
            setInput('');
            setAttachedFiles([]);
        }
    };

    const handleKeyDown = (e) => {
        // Submit on Enter (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    if (!conversation) {
        return (
            <div className="chat-interface">
                <div className="empty-state">
                    <h1>Welcome to LLM Council <span className="plus-text">Plus</span></h1>
                    <p className="hero-message">
                        The Council is ready to deliberate. <button className="config-link" onClick={() => onOpenSettings('council')}>Configure it</button>
                    </p>

                    {/* Council Preview Grid */}
                    <div className="welcome-grid-container">
                        <CouncilGrid models={councilModels} chairman={chairmanModel} status="idle" />
                    </div>

                </div>
            </div>
        );
    }

    return (
        <div className="chat-interface">
            {/* Messages Area */}
            <div className="messages-area" ref={messagesContainerRef}>
                {(!conversation || conversation.messages.length === 0) ? (
                    <div className="hero-container">
                        <div className="hero-content">
                            <h1>Welcome to LLM Council <span className="text-gradient">Plus</span></h1>
                            <p className="hero-subtitle">
                                The Council is ready to deliberate. <button className="config-link" onClick={() => onOpenSettings('council')}>Configure it</button>
                            </p>
                            <div className="welcome-grid-container">
                                <CouncilGrid models={councilModels} chairman={chairmanModel} status="idle" />
                            </div>
                        </div>
                    </div>
                ) : (
                    conversation.messages.map((msg, index) => (
                        <div key={`${conversation.id}-msg-${index}`} className={`message ${msg.role}`}>
                            <div className="message-role">
                                {msg.role === 'user' ? 'Your Question to the Council' : 'LLM Council'}
                            </div>

                            <div className="message-content">
                                {msg.role === 'user' ? (
                                    <div className="markdown-content">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <>
                                        {/* Search Loading */}
                                        {msg.loading?.search && (
                                            <div className="stage-loading">
                                                <div className="spinner"></div>
                                                <span>
                                                    🔍 Searching the web with {
                                                        searchProvider === 'duckduckgo' ? 'DuckDuckGo' :
                                                            searchProvider === 'tavily' ? 'Tavily' :
                                                                searchProvider === 'brave' ? 'Brave' :
                                                                    'Provider'
                                                    }...
                                                </span>
                                            </div>
                                        )}

                                        {/* URL Fetch Loading */}
                                        {msg.loading?.urlFetch && (
                                            <div className="stage-loading">
                                                <div className="spinner"></div>
                                                <span>🔗 Fetching referenced URLs...</span>
                                            </div>
                                        )}

                                        {/* URL Fetch Result */}
                                        {msg.metadata?.fetched_urls && msg.metadata.fetched_urls.length > 0 && (
                                            <div className="url-fetch-indicator">
                                                <span className="url-fetch-label">🔗 Fetched {msg.metadata.fetched_urls.length} URL{msg.metadata.fetched_urls.length > 1 ? 's' : ''}:</span>
                                                <div className="url-fetch-list">
                                                    {msg.metadata.fetched_urls.map((url, i) => (
                                                        <a key={i} className="url-chip" href={url} target="_blank" rel="noopener noreferrer">
                                                            {new URL(url).hostname}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Search Context */}
                                        {msg.metadata?.search_context && (
                                            <SearchContext
                                                searchQuery={msg.metadata?.search_query}
                                                extractedQuery={msg.metadata?.extracted_query}
                                                searchContext={msg.metadata?.search_context}
                                            />
                                        )}

                                        {/* Stage 1: Council Grid Visualization */}
                                        {(msg.loading?.stage1 || msg.stage1) && (
                                            <div className="stage-container">
                                                <div className="stage-header">
                                                    <h3>Stage 1: Council Deliberation</h3>
                                                    {msg.timers?.stage1Start && (
                                                        <StageTimer
                                                            startTime={msg.timers.stage1Start}
                                                            endTime={msg.timers.stage1End}
                                                        />
                                                    )}
                                                </div>
                                                <CouncilGrid
                                                    models={councilModels} // Use the same models list
                                                    chairman={chairmanModel}
                                                    status={msg.loading?.stage1 ? 'thinking' : 'complete'}
                                                    progress={{
                                                        currentModel: msg.progress?.stage1?.currentModel,
                                                        completed: msg.stage1?.map(r => r.model) || []
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {/* Stage 1 Results (Accordion/List - kept for detail view) */}
                                        {(msg.loading?.stage1 || msg.stage1) ? (
                                            msg.loading?.stage1 && !msg.stage1 ? (
                                                <Stage1Skeleton />
                                            ) : msg.stage1 && (
                                                <Stage1
                                                    responses={msg.stage1}
                                                    startTime={msg.timers?.stage1Start}
                                                    endTime={msg.timers?.stage1End}
                                                />
                                            )
                                        ) : null}

                                        {/* Stage 2 */}
                                        {msg.loading?.stage2 && (
                                            <Stage2Skeleton />
                                        )}
                                        {msg.stage2 && (
                                            <Stage2
                                                rankings={msg.stage2}
                                                labelToModel={msg.metadata?.label_to_model}
                                                aggregateRankings={msg.metadata?.aggregate_rankings}
                                                startTime={msg.timers?.stage2Start}
                                                endTime={msg.timers?.stage2End}
                                            />
                                        )}

                                        {/* Stage 3 */}
                                        {msg.loading?.stage3 && (
                                            <Stage3Skeleton />
                                        )}
                                        {msg.stage3 && (
                                            <Stage3
                                                finalResponse={msg.stage3}
                                                startTime={msg.timers?.stage3Start}
                                                endTime={msg.timers?.stage3End}
                                            />
                                        )}

                                        {/* Aborted Indicator */}
                                        {msg.aborted && (
                                            <div className="aborted-indicator">
                                                <span className="aborted-icon">⏹</span>
                                                <span className="aborted-text">
                                                    Generation stopped by user.
                                                    {msg.stage1 && !msg.stage3 && ' Partial results shown above.'}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}

                {/* Bottom Spacer for floating input */}
                <div ref={messagesEndRef} style={{ height: '20px' }} />
            </div>

            {/* Floating Command Capsule */}
            <div className="input-area">
                {!councilConfigured ? (
                    <div className="input-container config-required">
                        <span className="config-message">
                            ⚠️ Council not ready.
                            <button className="config-link" onClick={() => onOpenSettings('llm_keys')}>Configure API Keys</button>
                            <span className="config-separator">or</span>
                            <button className="config-link" onClick={() => onOpenSettings('council')}>Configure Council</button>
                        </span>
                    </div>
                ) : (
                    <form className="input-container" onSubmit={handleSubmit}>
                        {/* Attached Files Chips */}
                        {attachedFiles.length > 0 && (
                            <div className="attached-files-row">
                                {attachedFiles.map((f, i) => (
                                    <span key={i} className="file-chip">
                                        <span className="file-chip-icon">📎</span>
                                        <span className="file-chip-name">{f.name}</span>
                                        <button
                                            type="button"
                                            className="file-chip-remove"
                                            onClick={() => removeAttachedFile(i)}
                                            title="Remove file"
                                        >×</button>
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="input-row-top">
                            <label className={`search-toggle ${webSearch ? 'active' : ''}`} title="Toggle Web Search">
                                <input
                                    type="checkbox"
                                    className="search-checkbox"
                                    checked={webSearch}
                                    onChange={() => setWebSearch(!webSearch)}
                                    disabled={isLoading}
                                />
                                <span className="search-icon">🌐</span>
                                {webSearch && <span className="search-label">Search On</span>}
                            </label>

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
                                className="message-input"
                                placeholder={isLoading ? "Consulting..." : "Ask the Council..."}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                rows={1}
                                style={{ height: 'auto', minHeight: '24px' }}
                            />

                            {isLoading ? (
                                <button type="button" className="send-button stop-button" onClick={onAbort} title="Stop Generation">
                                    ⏹
                                </button>
                            ) : (
                                <button type="submit" className="send-button" disabled={!input.trim()}>
                                    ➤
                                </button>
                            )}
                        </div>

                        <div className="input-row-bottom">
                            <ExecutionModeToggle
                                value={executionMode}
                                onChange={onExecutionModeChange}
                                disabled={isLoading}
                            />
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
