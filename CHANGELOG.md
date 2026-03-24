# Changelog

All notable changes to LLM Council Plus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-03-23

### Added
- **Direct Chat**: One-on-one model conversations with full history persistence, file attachments, web search, and URL auto-fetching. Accessible via "Direct Chat" tab in the app mode toggle.
- **MCP Dashboard (Phase 1)**: Model Context Protocol infrastructure for connecting to external tool servers (Excalidraw, etc.). Backend MCP client manager supports HTTP (Streamable HTTP) and stdio transports with JSON-RPC protocol. Dashboard UI shows system health, connected servers, available tools, and server management (add/remove/connect/disconnect).
- **Conversation History in Council**: Follow-up messages now carry context from prior turns. `build_conversation_history()` extracts user queries + chairman synthesis for up to 5 previous turns, passed to Stage 1 members and Stage 3 chairman.
- **Conversation Type Separation**: Conversations now have a `type` field ("council" or "direct") to keep council and direct chat histories separate. List API supports `?type=` filter.
- **Light/Dark Theme Toggle**: Full theme system with CSS variables, `ThemeToggle` component, and localStorage persistence. Provider icons use colored avatar backgrounds for visibility on light backgrounds.
- **URL Fetch Fallback**: Direct HTTP fetcher with BeautifulSoup when Jina Reader fails (HTTP 451 blocked). Uses browser User-Agent and extracts from article/main elements.
- **App Mode Toggle**: Three-way navigation — Council, Direct Chat, MCP — via pill-style toggle at top center

### Changed
- **Version bump**: 0.3.1 → 0.4.0
- **Storage module**: `create_conversation()` accepts `conv_type` parameter, `list_conversations()` accepts optional `conv_type` filter, index entries include `type` field
- **Settings**: Added `mcp_servers` list for MCP server configurations
- **UI fonts**: Switched MCP dashboard and stat cards from Syne (italic/heavy) to Plus Jakarta Sans for readability
- **Layout fixes**: Added top padding to ChatInterface, DirectChat, and MCP Dashboard to prevent overlap with fixed mode toggle

### Fixed
- SVG provider icons invisible on white/light backgrounds (9/11 icons used `fill="#ffffff"`)
- Settings modal hardcoded dark colors on light theme (45+ rgba values replaced with CSS variables)
- SearchableModelSelect hardcoded dark-theme inline styles replaced with CSS variable lookups

## [0.3.1] - 2026-03-20

### Added
- **Azure OpenAI (AI Foundry) Provider**: Full integration with Azure OpenAI endpoints using OpenAI-compatible API format. Supports configurable endpoint URL, API key, and multiple deployment names. Includes test connection, auto-save on success, and provider toggle in Council Config.
- **Azure Icon & UI**: Azure provider icon, CouncilGrid detection, and dedicated settings section with deployment management

### Changed
- Updated CLAUDE.md with Azure provider documentation, model ID prefix format, and `max_completion_tokens` gotcha

## [0.3.0] - 2026-03-20

### Added
- **AWS Bedrock Provider**: Full integration with AWS Bedrock via the Converse API (boto3 + bearer token flow), including model listing and key validation
- **File Upload Support**: Attach text files and PDFs to your council queries — backend extracts content via pypdf with size/truncation safeguards (`/api/upload-files` endpoint)
- **URL Context Fetching**: URLs referenced in messages are automatically fetched via Jina Reader and included as context for all stages
- **Audit Log**: In-memory audit logging with a live viewer panel for debugging and observability (endpoints to fetch/clear logs)
- **Role-Aware Prompting**: Query type detection (factual, analytical, creative, etc.) with analyst role assignments for richer Stage 1 responses
- **Enhanced Stage 2/3 Prompts**: Richer peer review and synthesis instructions with role metadata included in chairman synthesis
- **Bedrock Icon & UI**: Bedrock provider icon and configuration UI in Settings (API key, region, model IDs)
- **Stage 1 Persistence**: Stage 1 results now remain visible after Stage 2 and Stage 3 complete (previously hidden)

### Changed
- **Improved Council Orchestration**: Query-aware and role-specialized prompts across all stages
- **Search Module**: Added URL extraction utilities and async fetching to build richer contextual inputs
- **Streaming Flow**: Messages now merge web search, URL-fetched, and file-attached contexts before council deliberation
- **Frontend Dependencies**: Updated packages for new features

### Fixed
- **Stage 1 Visibility**: Stage 1 output no longer disappears when Stage 2 arrives
- **Ollama Configuration**: Fixed toggle disabled when Ollama was connected (PR #4). Thanks @patrickgamer!

## [0.2.2] - 2026-02-18

### Fixed
- **Ollama Configuration**: Fixed an issue where the "Local (Ollama)" toggle was disabled even when Ollama was connected (PR #4). Thanks @patrickgamer!

## [0.2.1] - 2026-01-31

### Added
- **Serper.dev Integration**: Google Search via Serper API with 2,500 free queries
- **DuckDuckGo Search Optimization**: Intelligent query processing with intent detection, hybrid web+news search, and relevance reranking
- **Search Settings**: Configurable result count (5-15) and hybrid mode toggle for DuckDuckGo
- **Query Intent Detection**: Automatically detects current events, factual, comparison, and research queries
- **Auto-save Council Config**: Council members and chairman selections now auto-save (no more forgetting to click Save)
- **Council Validation**: Prevent saving incomplete configurations (empty member slots or missing chairman)

### Changed
- **Improved Font Readability**: Switched markdown headers and model names from stylized 'Syne' to readable 'Plus Jakarta Sans'
- **Search Query Processing**: DuckDuckGo now automatically removes conversational fluff and adds temporal context
- **Search Provider Auto-switch**: Testing a search API key now auto-saves and switches to that provider

### Fixed
- YAKE keyword extraction setting now only shows for Tavily/Brave (DuckDuckGo has built-in optimization)
- Font inconsistency between Stage 3 (Chairman) and Stage 1/2 responses
- CORS support for additional frontend port (5174)

## [0.2.0] - 2026-01-31

### Added
- **Mobile Responsiveness**: Full mobile support with hamburger menu, responsive layouts, and touch-friendly UI
- **Chat History Search**: Filter conversations by title in the sidebar
- **Source Validation**: Disable model source toggles when API key not configured with helpful tooltips
- **Version Display**: Show version number in sidebar and settings

### Changed
- **UI Redesign**: New "Council Chamber" dark theme with refined glassmorphism
- **Typography**: Updated font stack (Syne, Plus Jakarta Sans, Source Serif 4, JetBrains Mono)
- **Hero Animations**: Staggered fade-in animations for welcome screen elements

### Fixed
- Auto-cleanup of empty conversations when switching or creating new ones
- Duplicate API route in backend
- Duplicate CSS blocks causing style conflicts
- React key anti-pattern in message list
- Redundant decorator in provider base class

## [0.1.0] - Initial Release

### Added
- 3-stage deliberation system (Individual Responses → Peer Ranking → Chairman Synthesis)
- Multi-provider support: OpenRouter, Ollama, Groq, Direct providers, Custom endpoints
- Web search integration: DuckDuckGo, Tavily, Brave with Jina Reader
- Execution modes: Chat Only, Chat + Ranking, Full Deliberation
- Conversation persistence with JSON storage
- Settings management with import/export
- "I'm Feeling Lucky" random model selection
