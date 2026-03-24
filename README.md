# LLM Council Beta

> **Collective AI Intelligence** — Instead of asking one LLM, convene a council of AI models that deliberate, peer-review, and synthesize the best answer.

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Lineage

This project is **LLM Council Beta**, forked from **[llm-council-plus](https://github.com/jacob-bd/llm-council-plus)** by [jacob-bd](https://github.com/jacob-bd), which itself is a fork of the original **[llm-council](https://github.com/karpathy/llm-council)** by [Andrej Karpathy](https://github.com/karpathy).

---

## What is LLM Council Beta?

Instead of asking a single LLM (like ChatGPT or Claude) for an answer, **LLM Council Beta** assembles a council of multiple AI models that:

1. **Independently answer** your question (Stage 1)
2. **Anonymously peer-review** each other's responses (Stage 2)
3. **Synthesize a final answer** through a Chairman model (Stage 3)

The result? More balanced, accurate, and thoroughly vetted responses that leverage the collective intelligence of multiple AI models.

---

## Installation

```bash
# Clone and install
git clone <your-repo-url>
cd llm-council-beta
uv sync                    # Backend dependencies
cd frontend && npm install # Frontend dependencies

# Run (from project root)
./start.sh
```

Then open **http://localhost:5173** and configure your API keys in Settings.

> **Prerequisites:** Python 3.10+, Node.js 18+, [uv](https://docs.astral.sh/uv/)

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR QUESTION                             │
│            (+ optional web search for real-time info)            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: DELIBERATION                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Claude  │  │  GPT-4  │  │ Gemini  │  │  Llama  │  ...        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘             │
│       │            │            │            │                   │
│       ▼            ▼            ▼            ▼                   │
│  Response A   Response B   Response C   Response D               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 2: PEER REVIEW                          │
│  Each model reviews ALL responses (anonymized as A, B, C, D)     │
│  and ranks them by accuracy, insight, and completeness           │
│                                                                   │
│  Rankings are aggregated to identify the best responses          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 3: SYNTHESIS                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CHAIRMAN MODEL                        │    │
│  │  Reviews all responses + rankings + search context       │    │
│  │  Synthesizes the council's collective wisdom             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│                      FINAL ANSWER                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Multi-Provider Support
Mix and match models from different sources in your council:

| Provider | Type | Description |
|----------|------|-------------|
| **OpenRouter** | Cloud | 100+ models via single API (GPT-4, Claude, Gemini, Mistral, etc.) |
| **Ollama** | Local | Run open-source models locally (Llama, Mistral, Phi, etc.) |
| **Groq** | Cloud | Ultra-fast inference for Llama and Mixtral models |
| **OpenAI Direct** | Cloud | Direct connection to OpenAI API |
| **Anthropic Direct** | Cloud | Direct connection to Anthropic API |
| **Google Direct** | Cloud | Direct connection to Google AI API |
| **Mistral Direct** | Cloud | Direct connection to Mistral API |
| **DeepSeek Direct** | Cloud | Direct connection to DeepSeek API |
| **AWS Bedrock** | Cloud | AWS Bedrock via Converse API (Claude, Llama, Mistral, etc.) |
| **Azure OpenAI** | Cloud | Azure OpenAI / AI Foundry endpoints |
| **Custom Endpoint** | Any | Connect to any OpenAI-compatible API (Together AI, Fireworks, vLLM, LM Studio, GitHub Models, etc.) |

### Execution Modes

Choose how deeply the council deliberates:

| Mode | Stages | Best For |
|------|--------|----------|
| **Chat Only** | Stage 1 only | Quick responses, comparing model outputs |
| **Chat + Ranking** | Stages 1 & 2 | See how models rank each other |
| **Full Deliberation** | All 3 stages | Complete council synthesis (default) |

### Web Search Integration

Ground your council's responses in real-time information:

| Provider | Type | Notes |
|----------|------|-------|
| **DuckDuckGo** | Free | Hybrid web+news search, no API key needed |
| **Tavily** | API Key | Purpose-built for LLMs, rich content |
| **Brave Search** | API Key | Privacy-focused, 2,000 free queries/month |

**Full Article Fetching**: Uses [Jina Reader](https://jina.ai/reader) to extract full article content from top search results (configurable 0-10 results).

---

### Temperature Controls

Fine-tune creativity vs consistency:

- **Council Heat**: Controls Stage 1 response creativity (default: 0.5)
- **Chairman Heat**: Controls final synthesis creativity (default: 0.4)
- **Stage 2 Heat**: Controls peer ranking consistency (default: 0.3)

### Direct Chat

One-on-one model conversations with full features:

- Conversation persistence (separate from council history)
- File attachments (text, PDF)
- Web search toggle per message
- URL auto-fetch for referenced articles/docs

### MCP Integration

Connect to external MCP (Model Context Protocol) servers from the MCP dashboard to extend capabilities.

### File Upload & URL Context

Attach files or reference URLs to give the council richer context:

- **File Uploads**: Attach text files (.txt, .md, .py, .js, .json, .csv, etc.) and PDFs — content is extracted server-side and included as context for all stages
- **Automatic URL Fetching**: URLs in your message are automatically detected and fetched via Jina Reader, so models can read referenced articles/docs
- Up to 5 files per message, with size and truncation safeguards

### Role-Aware Prompting

The council automatically detects your query type (factual, analytical, creative, etc.) and assigns specialist roles to each council member for more diverse, targeted responses.

### Audit Log

A live audit log viewer for debugging and observability — track API calls, model responses, and errors in real-time from the UI.

### Additional Features

- **Live Progress Tracking**: See each model respond in real-time
- **Council Sizing**: Adjust council size from 2 to 8
- **Abort Anytime**: Cancel in-progress requests
- **Conversation History**: All conversations saved locally
- **Customizable Prompts**: Edit Stage 1, 2, and 3 system prompts
- **Rate Limit Warnings**: Alerts when your config may hit API limits (when >5 council members)
- **"I'm Feeling Lucky"**: Randomize your council composition
- **Import & Export**: Backup and share your favorite council configurations, system prompts, and settings

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **[uv](https://docs.astral.sh/uv/)** (Python package manager)

### Running the Application

**Option 1: Use the start script (recommended)**
```bash
./start.sh
```

**Option 2: Run manually**

Terminal 1 (Backend):
```bash
uv run python -m backend.main
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173** in your browser.

### Network Access

The application is configured to be accessible from other devices on your local network.

**Using start.sh (automatic):**
The start script exposes both frontend and backend on the network automatically. Just run `./start.sh` and access from any device.

**Access URLs:**
- **Local:** `http://localhost:5173`
- **Network:** `http://YOUR_IP:5173` (e.g., `http://192.168.1.100:5173`)

**Find your network IP:**
```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Manual setup (if not using start.sh):**
```bash
# Backend already listens on 0.0.0.0:8001

# Frontend with network access
cd frontend
npm run dev -- --host
```

---

## Configuration

### First-Time Setup

On first launch, the Settings panel will open automatically. Configure at least one LLM provider:

1. **LLM API Keys** tab: Enter API keys for your chosen providers
2. **Council Config** tab: Select council members and chairman
3. **Save Changes**

### LLM API Keys

| Provider | Get API Key |
|----------|-------------|
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) |
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) |
| Google AI | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Mistral | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com/) |
| AWS Bedrock | [AWS Console](https://console.aws.amazon.com/bedrock/) (requires IAM credentials or bearer token) |

**API keys are auto-saved** when you click "Test" and the connection succeeds.

### Ollama (Local Models)

1. Install [Ollama](https://ollama.com/)
2. Pull models: `ollama pull llama3.1`
3. Start Ollama: `ollama serve`
4. In Settings, enter your Ollama URL (default: `http://localhost:11434`)
5. Click "Connect" to verify

### Custom OpenAI-Compatible Endpoint

Connect to any OpenAI-compatible API:

1. Go to **LLM API Keys** → **Custom OpenAI-Compatible Endpoint**
2. Enter:
   - **Display Name**: e.g., "Together AI", "My vLLM Server"
   - **Base URL**: e.g., `https://api.together.xyz/v1`
   - **API Key**: (optional for local servers)
3. Click "Connect" to test and save

**Compatible services**: Together AI, Fireworks AI, vLLM, LM Studio, Ollama (if you prefer this method), GitHub Models (`https://models.inference.ai.azure.com/v1`), and more.

### Council Configuration

1. **Enable Model Sources**: Toggle which providers appear in model selection
2. **Select Council Members**: Choose 2-8 models for your council
3. **Select Chairman**: Pick a model to synthesize the final answer
4. **Adjust Temperature**: Use sliders for creativity control

**Tips:**
- Mix different model families for diverse perspectives
- Use faster models (Groq, Ollama) for large councils
- Free OpenRouter models have rate limits (20/min, 50/day)

### Search Providers

| Provider | Setup |
|----------|-------|
| DuckDuckGo | Works out of the box, no setup needed |
| Tavily | Get key at [tavily.com](https://tavily.com), enter in Search Providers tab |
| Brave | Get key at [brave.com/search/api](https://brave.com/search/api/), enter in Search Providers tab |

**Search Query Processing:**

| Mode | Description | Best For |
|------|-------------|----------|
| **Direct** (default) | Sends your exact query to the search engine | Short, focused questions. Works best with semantic search engines like Tavily and Brave. |
| **Smart Keywords (YAKE)** | Extracts key terms from your prompt before searching | Very long prompts or multi-paragraph context that might confuse the search engine. Uses [YAKE](https://github.com/LIAAD/yake) keyword extraction. |

> **Tip:** Start with **Direct** mode. Only switch to **YAKE** if you notice search results are irrelevant when pasting long documents or complex prompts.

---

## Usage

### Basic Usage

1. Start a new conversation (+ button in sidebar)
2. Type your question
3. (Optional) Enable web search toggle for real-time info
4. Press Enter or click Send

### Understanding the Output

**Stage 1 - Council Deliberation**
- Tab view showing each model's individual response
- Live progress as models respond

**Stage 2 - Peer Rankings**
- Each model's evaluation and ranking of peers
- Aggregate scores showing consensus rankings
- De-anonymization reveals which model gave which response

**Stage 3 - Chairman Synthesis**
- Final, synthesized answer from the Chairman
- Incorporates best insights from all responses and rankings

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line in input |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | FastAPI, Python 3.10+, httpx (async HTTP) |
| **Frontend** | React 19, Vite, react-markdown |
| **Styling** | CSS with light/dark theme support |
| **Storage** | JSON files in `data/` directory |
| **Package Management** | uv (Python), npm (JavaScript) |

---

## Data Storage

All data is stored locally in the `data/` directory:

```
data/
├── settings.json          # Your configuration (includes API keys)
└── conversations/         # Conversation history
    ├── {uuid}.json
    └── ...
```

**Privacy**: No data is sent to external servers except API calls to your configured LLM providers.

> **⚠️ Security Warning: API Keys Stored in Plain Text**
>
> In this build, **API keys are stored in clear text** in `data/settings.json`. The `data/` folder is included in `.gitignore` by default to prevent accidental exposure.
>
> **Important:**
> - **Do NOT remove `data/` from `.gitignore`** — this protects your API keys from being pushed to GitHub
> - Never commit `data/settings.json` to version control
> - If you accidentally expose your keys, rotate them immediately at each provider's dashboard

---

## Troubleshooting

### Common Issues

**"Failed to load conversations"**
- Backend might still be starting up
- App retries automatically (3 attempts with 1s, 2s, 3s delays)

**Models not appearing in dropdown**
- Ensure the provider is enabled in Council Config
- Check that API key is configured and tested successfully
- For Ollama, verify connection is active

**Jina Reader returns 451 errors**
- HTTP 451 = site blocks AI scrapers (common with news sites)
- Try Tavily/Brave instead, or set `full_content_results` to 0

**Rate limit errors (OpenRouter)**
- Free models: 20 requests/min, 50/day
- Consider using Groq (14,400/day) or Ollama (unlimited)
- Reduce council size for free tier usage

**Binary compatibility errors (node_modules)**
- When syncing between Intel/Apple Silicon Macs:
  ```bash
  rm -rf frontend/node_modules && cd frontend && npm install
  ```

### Logs

- **Backend logs**: Terminal running `uv run python -m backend.main`
- **Frontend logs**: Browser DevTools console

---

## Credits & Acknowledgements

This project stands on the shoulders of:

- **[Andrej Karpathy](https://github.com/karpathy)** — original [llm-council](https://github.com/karpathy/llm-council) concept and codebase
- **[jacob-bd](https://github.com/jacob-bd)** — [llm-council-plus](https://github.com/jacob-bd/llm-council-plus) fork with multi-provider support, web search, streaming, and significant feature additions

**LLM Council Beta** builds further with additional providers (Azure OpenAI, AWS Bedrock), Direct Chat, MCP integration, conversation history, and more.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contributing

Contributions are welcome! This project embraces the spirit of "vibe coding" - feel free to fork and make it your own.

---

<p align="center">
  <strong>Built with the collective wisdom of AI</strong><br>
  <em>Ask the council. Get better answers.</em>
</p>
