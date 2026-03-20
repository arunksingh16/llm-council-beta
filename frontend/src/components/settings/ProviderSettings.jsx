import React from 'react';
import openrouterIcon from '../../assets/icons/openrouter.svg';
import groqIcon from '../../assets/icons/groq.svg';
import ollamaIcon from '../../assets/icons/ollama.svg';
import openaiIcon from '../../assets/icons/openai.svg';
import anthropicIcon from '../../assets/icons/anthropic.svg';
import googleIcon from '../../assets/icons/google.svg';
import mistralIcon from '../../assets/icons/mistral.svg';
import deepseekIcon from '../../assets/icons/deepseek.svg';
import customEndpointIcon from '../../assets/icons/openai-compatible.svg';
import bedrockIcon from '../../assets/icons/bedrock.svg';

const PROVIDER_ICONS = {
    openai: openaiIcon,
    anthropic: anthropicIcon,
    google: googleIcon,
    mistral: mistralIcon,
    deepseek: deepseekIcon,
};

const DIRECT_PROVIDERS = [
    { id: 'openai', name: 'OpenAI', key: 'openai_api_key' },
    { id: 'anthropic', name: 'Anthropic', key: 'anthropic_api_key' },
    { id: 'google', name: 'Google', key: 'google_api_key' },
    { id: 'mistral', name: 'Mistral', key: 'mistral_api_key' },
    { id: 'deepseek', name: 'DeepSeek', key: 'deepseek_api_key' },
];

const BEDROCK_REGIONS = [
    'us-east-1',
    'us-east-2',
    'us-west-2',
    'ap-northeast-1',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-south-1',
    'ca-central-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'sa-east-1',
];

export default function ProviderSettings({
    settings,
    // OpenRouter
    openrouterApiKey,
    setOpenrouterApiKey,
    handleTestOpenRouter,
    isTestingOpenRouter,
    openrouterTestResult,
    // Groq
    groqApiKey,
    setGroqApiKey,
    handleTestGroq,
    isTestingGroq,
    groqTestResult,
    // Ollama
    ollamaBaseUrl,
    setOllamaBaseUrl,
    handleTestOllama,
    isTestingOllama,
    ollamaTestResult,
    ollamaStatus,
    loadOllamaModels,
    // Direct
    directKeys,
    setDirectKeys,
    handleTestDirectKey,
    validatingKeys,
    keyValidationStatus,
    // Custom Endpoint
    customEndpointName,
    setCustomEndpointName,
    customEndpointUrl,
    setCustomEndpointUrl,
    customEndpointApiKey,
    setCustomEndpointApiKey,
    handleTestCustomEndpoint,
    isTestingCustomEndpoint,
    customEndpointTestResult,
    customEndpointModels,
    // AWS Bedrock
    bedrockApiKey,
    setBedrockApiKey,
    bedrockRegion,
    setBedrockRegion,
    handleTestBedrock,
    isTestingBedrock,
    bedrockTestResult,
    bedrockModels,
    bedrockModelIds,
    setBedrockModelIds,
    handleSaveBedrockModels
}) {
    return (
        <section className="settings-section">
            <h3>LLM API Keys</h3>
            <p className="section-description">
                Configure keys for LLM providers.
                Keys are <strong>auto-saved</strong> immediately upon successful test.
            </p>

            {/* OpenRouter */}
            <form className="api-key-section" onSubmit={e => e.preventDefault()}>
                <label>
                    <img src={openrouterIcon} alt="" className="provider-icon" />
                    OpenRouter API Key
                </label>
                <div className="api-key-input-row">
                    <input
                        type="password"
                        placeholder={settings?.openrouter_api_key_set ? '••••••••••••••••' : 'Enter API key'}
                        value={openrouterApiKey}
                        onChange={(e) => {
                            setOpenrouterApiKey(e.target.value);
                        }}
                        className={settings?.openrouter_api_key_set && !openrouterApiKey ? 'key-configured' : ''}
                    />
                    <button
                        className="test-button"
                        onClick={handleTestOpenRouter}
                        disabled={!openrouterApiKey && !settings?.openrouter_api_key_set || isTestingOpenRouter}
                    >
                        {isTestingOpenRouter ? 'Testing...' : (settings?.openrouter_api_key_set && !openrouterApiKey ? 'Retest' : 'Test')}
                    </button>
                </div>
                {settings?.openrouter_api_key_set && !openrouterApiKey && (
                    <div className="key-status set">✓ API key configured</div>
                )}
                {openrouterTestResult && (
                    <div className={`test-result ${openrouterTestResult.success ? 'success' : 'error'}`}>
                        {openrouterTestResult.message}
                    </div>
                )}
                <p className="api-key-hint">
                    Get key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai</a>
                </p>
            </form>

            {/* Groq */}
            <form className="api-key-section" onSubmit={e => e.preventDefault()}>
                <label>
                    <img src={groqIcon} alt="" className="provider-icon" />
                    Groq API Key
                </label>
                <div className="api-key-input-row">
                    <input
                        type="password"
                        placeholder={settings?.groq_api_key_set ? '••••••••••••••••' : 'Enter API key'}
                        value={groqApiKey}
                        onChange={(e) => {
                            setGroqApiKey(e.target.value);
                        }}
                        className={settings?.groq_api_key_set && !groqApiKey ? 'key-configured' : ''}
                    />
                    <button
                        className="test-button"
                        onClick={handleTestGroq}
                        disabled={!groqApiKey && !settings?.groq_api_key_set || isTestingGroq}
                    >
                        {isTestingGroq ? 'Testing...' : (settings?.groq_api_key_set && !groqApiKey ? 'Retest' : 'Test')}
                    </button>
                </div>
                {settings?.groq_api_key_set && !groqApiKey && (
                    <div className="key-status set">✓ API key configured</div>
                )}
                {groqTestResult && (
                    <div className={`test-result ${groqTestResult.success ? 'success' : 'error'}`}>
                        {groqTestResult.message}
                    </div>
                )}
                <p className="api-key-hint">
                    Get key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com</a>
                </p>
            </form>

            {/* Ollama */}
            <form className="api-key-section" onSubmit={e => e.preventDefault()}>
                <label>
                    <img src={ollamaIcon} alt="" className="provider-icon" />
                    Ollama Base URL
                </label>
                <div className="api-key-input-row">
                    <input
                        type="text"
                        placeholder="http://localhost:11434"
                        value={ollamaBaseUrl}
                        onChange={(e) => {
                            setOllamaBaseUrl(e.target.value);
                        }}
                    />
                    <button
                        className="test-button"
                        onClick={handleTestOllama}
                        disabled={!ollamaBaseUrl || isTestingOllama}
                    >
                        {isTestingOllama ? 'Testing...' : 'Connect'}
                    </button>
                </div>
                {ollamaTestResult && (
                    <div className={`test-result ${ollamaTestResult.success ? 'success' : 'error'}`}>
                        {ollamaTestResult.message}
                    </div>
                )}
                {ollamaStatus && ollamaStatus.connected && (
                    <div className="ollama-auto-status connected">
                        <span className="status-indicator connected">●</span>
                        <span className="status-text">
                            <strong>Connected</strong> <span className="status-separator">·</span> <span className="status-time">Last: {new Date(ollamaStatus.lastConnected).toLocaleTimeString()}</span>
                        </span>
                    </div>
                )}
                {ollamaStatus && !ollamaStatus.connected && !ollamaStatus.testing && (
                    <div className="ollama-auto-status">
                        <span className="status-indicator disconnected">●</span>
                        <span className="status-text">Not connected</span>
                    </div>
                )}
                <div className="model-options-row" style={{ marginTop: '12px' }}>
                    <button
                        type="button"
                        className="reset-defaults-button"
                        onClick={() => loadOllamaModels(ollamaBaseUrl)}
                    >
                        Refresh Local Models
                    </button>
                </div>
            </form>

            {/* Direct LLM API Connections */}
            <div className="subsection" style={{ marginTop: '24px' }}>
                <h4>Direct LLM Connections</h4>
                {DIRECT_PROVIDERS.map(dp => (
                    <form key={dp.id} className="api-key-section" onSubmit={e => e.preventDefault()}>
                        <label>
                            <img src={PROVIDER_ICONS[dp.id]} alt="" className="provider-icon" />
                            {dp.name} API Key
                        </label>
                        <div className="api-key-input-row">
                            <input
                                type="password"
                                placeholder={settings?.[`${dp.key}_set`] ? '••••••••••••••••' : 'Enter API key'}
                                value={directKeys[dp.key]}
                                onChange={e => setDirectKeys(prev => ({ ...prev, [dp.key]: e.target.value }))}
                                className={settings?.[`${dp.key}_set`] && !directKeys[dp.key] ? 'key-configured' : ''}
                            />
                            <button
                                className="test-button"
                                onClick={() => handleTestDirectKey(dp.id, dp.key)}
                                disabled={(!directKeys[dp.key] && !settings?.[`${dp.key}_set`]) || validatingKeys[dp.id]}
                            >
                                {validatingKeys[dp.id] ? 'Testing...' : (settings?.[`${dp.key}_set`] && !directKeys[dp.key] ? 'Retest' : 'Test')}
                            </button>
                        </div>
                        {settings?.[`${dp.key}_set`] && !directKeys[dp.key] && (
                            <div className="key-status set">✓ API key configured</div>
                        )}
                        {keyValidationStatus[dp.id] && (
                            <div className={`test-result ${keyValidationStatus[dp.id].success ? 'success' : 'error'}`}>
                                {keyValidationStatus[dp.id].message}
                            </div>
                        )}
                    </form>
                ))}
            </div>

            {/* AWS Bedrock */}
            <div className="subsection" style={{ marginTop: '24px' }}>
                <h4>AWS Bedrock</h4>
                <p className="subsection-description" style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    Connect to AWS Bedrock using an API key (bearer token). Add model IDs manually — they are region-specific.
                </p>
                <form className="api-key-section" onSubmit={e => e.preventDefault()}>
                    <label>
                        <img src={bedrockIcon} alt="" className="provider-icon" />
                        Bedrock API Key
                    </label>
                    <div className="api-key-input-row">
                        <input
                            type="password"
                            placeholder={settings?.bedrock_api_key_set ? '••••••••••••••••' : 'Enter Bedrock API key'}
                            value={bedrockApiKey}
                            onChange={(e) => setBedrockApiKey(e.target.value)}
                            className={settings?.bedrock_api_key_set && !bedrockApiKey ? 'key-configured' : ''}
                        />
                    </div>

                    <label style={{ marginTop: '12px' }}>Region</label>
                    <div className="api-key-input-row">
                        <select
                            value={bedrockRegion}
                            onChange={(e) => setBedrockRegion(e.target.value)}
                            className="settings-select"
                            style={{ flex: 1 }}
                        >
                            {BEDROCK_REGIONS.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                        <button
                            className="test-button"
                            onClick={handleTestBedrock}
                            disabled={(!bedrockApiKey && !settings?.bedrock_api_key_set) || isTestingBedrock}
                        >
                            {isTestingBedrock ? 'Testing...' : (settings?.bedrock_api_key_set && !bedrockApiKey ? 'Retest' : 'Test')}
                        </button>
                    </div>

                    {settings?.bedrock_api_key_set && !bedrockApiKey && (
                        <div className="key-status set">
                            ✓ API key configured ({settings?.bedrock_region || 'us-east-1'})
                            {bedrockModels.length > 0 && ` · ${bedrockModels.length} model(s) configured`}
                        </div>
                    )}
                    {bedrockTestResult && (
                        <div className={`test-result ${bedrockTestResult.success ? 'success' : 'error'}`}>
                            {bedrockTestResult.message}
                        </div>
                    )}

                    {/* Model IDs */}
                    <label style={{ marginTop: '16px' }}>Model IDs</label>
                    <p className="subsection-description" style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', marginTop: '2px' }}>
                        Add Bedrock model IDs (e.g. <code style={{ fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px' }}>us.anthropic.claude-3-5-haiku-20241022-v1:0</code>)
                    </p>
                    {(bedrockModelIds || []).map((mid, idx) => (
                        <div key={idx} className="api-key-input-row" style={{ marginBottom: '6px' }}>
                            <input
                                type="text"
                                placeholder="e.g. us.anthropic.claude-3-5-haiku-20241022-v1:0"
                                value={mid}
                                onChange={(e) => {
                                    const updated = [...bedrockModelIds];
                                    updated[idx] = e.target.value;
                                    setBedrockModelIds(updated);
                                }}
                                style={{ fontFamily: 'var(--font-code, monospace)', fontSize: '13px' }}
                            />
                            <button
                                type="button"
                                className="test-button"
                                style={{ minWidth: '36px', padding: '0 8px', color: '#ef4444' }}
                                onClick={() => {
                                    const updated = bedrockModelIds.filter((_, i) => i !== idx);
                                    setBedrockModelIds(updated);
                                }}
                                title="Remove model"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                            type="button"
                            className="reset-defaults-button"
                            onClick={() => setBedrockModelIds([...(bedrockModelIds || []), ''])}
                        >
                            + Add Model
                        </button>
                        <button
                            type="button"
                            className="test-button"
                            onClick={handleSaveBedrockModels}
                            disabled={!bedrockModelIds || bedrockModelIds.every(m => !m.trim())}
                        >
                            Save Models
                        </button>
                    </div>

                    <p className="api-key-hint">
                        Get key at <a href="https://console.aws.amazon.com/bedrock/" target="_blank" rel="noopener noreferrer">AWS Bedrock Console</a>
                    </p>
                </form>
            </div>

            {/* Custom OpenAI-compatible Endpoint */}
            <div className="subsection" style={{ marginTop: '24px' }}>
                <h4>Custom OpenAI-Compatible Endpoint</h4>
                <p className="subsection-description" style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
                    Connect to any OpenAI-compatible API (Together AI, Fireworks, vLLM, LM Studio, etc.)
                </p>
                <form className="api-key-section" onSubmit={e => e.preventDefault()}>
                    <label>
                        <img src={customEndpointIcon} alt="" className="provider-icon" />
                        Display Name
                    </label>
                    <div className="api-key-input-row">
                        <input
                            type="text"
                            placeholder="e.g., Together AI, My vLLM Server"
                            value={customEndpointName}
                            onChange={(e) => {
                                setCustomEndpointName(e.target.value);
                            }}
                        />
                    </div>

                    <label style={{ marginTop: '12px' }}>Base URL</label>
                    <div className="api-key-input-row">
                        <input
                            type="text"
                            placeholder="https://api.together.xyz/v1"
                            value={customEndpointUrl}
                            onChange={(e) => {
                                setCustomEndpointUrl(e.target.value);
                            }}
                        />
                    </div>

                    <label style={{ marginTop: '12px' }}>API Key <span style={{ fontWeight: 'normal', opacity: 0.7 }}>(optional for local servers)</span></label>
                    <div className="api-key-input-row">
                        <input
                            type="password"
                            placeholder={settings?.custom_endpoint_url ? '••••••••••••••••' : 'Enter API key'}
                            value={customEndpointApiKey}
                            onChange={(e) => {
                                setCustomEndpointApiKey(e.target.value);
                            }}
                        />
                        <button
                            className="test-button"
                            onClick={handleTestCustomEndpoint}
                            disabled={!customEndpointName || !customEndpointUrl || isTestingCustomEndpoint}
                        >
                            {isTestingCustomEndpoint ? 'Testing...' : 'Connect'}
                        </button>
                    </div>

                    {/* Show configured status when endpoint is saved */}
                    {settings?.custom_endpoint_url && (
                        <div className="key-status set">
                            ✓ Endpoint configured
                            {customEndpointModels.length > 0 && ` · ${customEndpointModels.length} models available`}
                        </div>
                    )}
                    {customEndpointTestResult && (
                        <div className={`test-result ${customEndpointTestResult.success ? 'success' : 'error'}`}>
                            {customEndpointTestResult.message}
                        </div>
                    )}
                </form>
            </div>
        </section>
    );
}
