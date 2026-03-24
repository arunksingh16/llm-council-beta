"""MCP tool use integration for LLM providers.

Converts MCP tool schemas to provider-specific formats, parses tool call
responses, and provides the agentic tool execution loop.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Map provider prefix to tool format family
PROVIDER_TOOL_FORMAT = {
    "openai": "openai",
    "groq": "openai",
    "openrouter": "openai",
    "deepseek": "openai",
    "mistral": "openai",
    "custom": "openai",
    "azure": "openai",
    "ollama": "openai",
    "anthropic": "anthropic",
    "google": "google",
    "bedrock": None,  # Not supported yet
}


def get_provider_prefix(model_id: str) -> str:
    """Extract provider prefix from model ID."""
    if ":" in model_id:
        return model_id.split(":")[0]
    return "openrouter"


def get_tool_format(model_id: str) -> Optional[str]:
    """Get the tool format family for a model."""
    prefix = get_provider_prefix(model_id)
    return PROVIDER_TOOL_FORMAT.get(prefix)


# ---- MCP to Provider Format Converters ----

def mcp_tools_to_openai(mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to OpenAI function calling format."""
    tools = []
    for tool in mcp_tools:
        tools.append({
            "type": "function",
            "function": {
                "name": tool.get("name", ""),
                "description": tool.get("description", ""),
                "parameters": tool.get("inputSchema", {"type": "object", "properties": {}}),
            }
        })
    return tools


def mcp_tools_to_anthropic(mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to Anthropic tool format."""
    tools = []
    for tool in mcp_tools:
        tools.append({
            "name": tool.get("name", ""),
            "description": tool.get("description", ""),
            "input_schema": tool.get("inputSchema", {"type": "object", "properties": {}}),
        })
    return tools


def mcp_tools_to_google(mcp_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MCP tool schemas to Google function declarations."""
    declarations = []
    for tool in mcp_tools:
        declarations.append({
            "name": tool.get("name", ""),
            "description": tool.get("description", ""),
            "parameters": tool.get("inputSchema", {"type": "object", "properties": {}}),
        })
    return declarations


def get_tools_for_provider(model_id: str, mcp_tools: List[Dict[str, Any]]) -> Optional[List[Dict[str, Any]]]:
    """Convert MCP tools to the format needed by the model's provider. Returns None if unsupported."""
    if not mcp_tools:
        return None

    fmt = get_tool_format(model_id)
    if fmt == "openai":
        return mcp_tools_to_openai(mcp_tools)
    elif fmt == "anthropic":
        return mcp_tools_to_anthropic(mcp_tools)
    elif fmt == "google":
        return mcp_tools_to_google(mcp_tools)
    return None


# ---- Response Parsers ----

def extract_tool_calls_openai(response_data: Dict[str, Any]) -> Tuple[Optional[str], List[Dict], Optional[Dict]]:
    """
    Parse OpenAI-format response for tool calls.
    Returns: (content, tool_calls_list, raw_assistant_message)
    """
    choices = response_data.get("choices", [])
    if not choices:
        return None, [], None

    message = choices[0].get("message", {})
    content = message.get("content")
    tool_calls_raw = message.get("tool_calls")

    if not tool_calls_raw:
        return content, [], None

    tool_calls = []
    for tc in tool_calls_raw:
        func = tc.get("function", {})
        args = func.get("arguments", "{}")
        try:
            parsed_args = json.loads(args) if isinstance(args, str) else args
        except json.JSONDecodeError:
            parsed_args = {}

        tool_calls.append({
            "id": tc.get("id", ""),
            "name": func.get("name", ""),
            "arguments": parsed_args,
        })

    return content, tool_calls, message


def extract_tool_calls_anthropic(response_data: Dict[str, Any]) -> Tuple[Optional[str], List[Dict], Optional[Dict]]:
    """
    Parse Anthropic-format response for tool use blocks.
    Returns: (text_content, tool_calls_list, raw_assistant_message)
    """
    content_blocks = response_data.get("content", [])
    text_parts = []
    tool_calls = []

    for block in content_blocks:
        if block.get("type") == "text":
            text_parts.append(block.get("text", ""))
        elif block.get("type") == "tool_use":
            tool_calls.append({
                "id": block.get("id", ""),
                "name": block.get("name", ""),
                "arguments": block.get("input", {}),
            })

    text_content = "\n".join(text_parts) if text_parts else None

    # Build raw message for conversation continuation
    raw_message = {"role": "assistant", "content": content_blocks} if tool_calls else None

    return text_content, tool_calls, raw_message


# ---- Tool Result Formatters ----

def format_tool_result_openai(tool_call: Dict, result: Any) -> Dict:
    """Format tool result for OpenAI conversation continuation."""
    content = json.dumps(result) if not isinstance(result, str) else result
    # Truncate large results
    if len(content) > 10000:
        content = content[:10000] + "\n...[truncated]"
    return {
        "role": "tool",
        "tool_call_id": tool_call.get("id", ""),
        "content": content,
    }


def format_tool_result_anthropic(tool_call: Dict, result: Any) -> Dict:
    """Format tool result for Anthropic conversation continuation."""
    content = json.dumps(result) if not isinstance(result, str) else result
    if len(content) > 10000:
        content = content[:10000] + "\n...[truncated]"
    return {
        "role": "user",
        "content": [{
            "type": "tool_result",
            "tool_use_id": tool_call.get("id", ""),
            "content": content,
        }]
    }


def format_tool_result_for_provider(model_id: str, tool_call: Dict, result: Any) -> Dict:
    """Format tool result for the model's provider format."""
    fmt = get_tool_format(model_id)
    if fmt == "anthropic":
        return format_tool_result_anthropic(tool_call, result)
    # Default to OpenAI format
    return format_tool_result_openai(tool_call, result)


def format_raw_assistant_message_openai(message: Dict) -> Dict:
    """Ensure the raw assistant message is in the right format for OpenAI conversation."""
    return {
        "role": "assistant",
        "content": message.get("content"),
        "tool_calls": message.get("tool_calls", []),
    }


# ---- Agentic Tool Loop ----

async def query_model_with_tools(
    model_id: str,
    messages: List[Dict[str, str]],
    timeout: float = 120.0,
    temperature: float = 0.7,
    max_tool_rounds: int = 5,
) -> Dict[str, Any]:
    """
    Query a model with MCP tool support. Handles the tool call loop.

    If no MCP tools are available or the provider doesn't support tools,
    falls back to a regular query.
    """
    from .council import query_model, get_provider_for_model
    from .mcp_manager import mcp_manager
    from .settings import get_settings

    settings = get_settings()

    # Check if tool use is enabled and tools are available
    if not getattr(settings, 'mcp_tool_use_enabled', True):
        return await query_model(model_id, messages, timeout, temperature)

    all_mcp_tools = mcp_manager.get_all_tools()
    logger.info(f"[MCP] query_model_with_tools: model={model_id}, mcp_tools_count={len(all_mcp_tools)}")

    provider_tools = get_tools_for_provider(model_id, all_mcp_tools)

    if not provider_tools:
        logger.info(f"[MCP] No tools for provider format of {model_id}, falling back to regular query")
        return await query_model(model_id, messages, timeout, temperature)

    logger.info(f"[MCP] Sending {len(provider_tools)} tools to {model_id}: {[t.get('function', {}).get('name', t.get('name', '?')) for t in provider_tools]}")

    fmt = get_tool_format(model_id)
    provider = get_provider_for_model(model_id)
    current_messages = list(messages)
    tool_use_log = []  # Track all tool calls for UI

    for round_num in range(max_tool_rounds):
        # Query with tools
        response = await provider.query(
            model_id, current_messages, timeout, temperature, tools=provider_tools
        )

        if response.get("error"):
            logger.error(f"[MCP] Round {round_num + 1} error: {response.get('error_message', 'unknown')}")
            return response

        tool_calls = response.get("tool_calls", [])
        if not tool_calls:
            # No tool calls — model gave a final text response
            content_preview = (response.get("content") or "")[:100]
            logger.info(f"[MCP] Round {round_num + 1}: No tool calls, model returned text ({len(response.get('content', ''))} chars): {content_preview}...")
            # Attach tool use log to the response so the UI can display it
            if tool_use_log:
                response["tool_use_log"] = tool_use_log
            return response

        logger.info(f"[MCP] Round {round_num + 1}: {len(tool_calls)} tool call(s) from {model_id}: {[tc['name'] for tc in tool_calls]}")

        # Append raw assistant message to conversation
        raw_msg = response.get("raw_message")
        if raw_msg:
            if fmt == "openai":
                current_messages.append(format_raw_assistant_message_openai(raw_msg))
            else:
                current_messages.append(raw_msg)

        # Execute tool calls (in parallel if multiple)
        async def _exec_tool(tc):
            logger.info(f"[MCP] Executing tool: {tc['name']}({json.dumps(tc['arguments'])[:200]})")
            try:
                result = await mcp_manager.call_tool(tc["name"], tc["arguments"])
                result_str = json.dumps(result) if not isinstance(result, str) else result
                logger.info(f"[MCP] Tool result type={type(result).__name__}, keys={list(result.keys()) if isinstance(result, dict) else 'N/A'}")
                logger.info(f"[MCP] Tool result preview: {result_str[:500]}")
                # Log content block types if present
                if isinstance(result, dict) and "content" in result:
                    content_blocks = result["content"]
                    if isinstance(content_blocks, list):
                        for idx, block in enumerate(content_blocks):
                            if isinstance(block, dict):
                                btype = block.get("type", "unknown")
                                logger.info(f"[MCP]   content[{idx}]: type={btype}, keys={list(block.keys())}")
                return tc, result
            except Exception as e:
                logger.error(f"[MCP] Tool call failed: {tc['name']}: {e}")
                return tc, {"error": str(e)}

        results = await asyncio.gather(*[_exec_tool(tc) for tc in tool_calls])

        # Append tool results to messages and log
        for tc, result in results:
            tool_msg = format_tool_result_for_provider(model_id, tc, result)
            current_messages.append(tool_msg)

            # Extract displayable content from MCP result
            log_entry = {
                "tool": tc["name"],
                "arguments": tc["arguments"],
                "success": True,
            }

            # For create_view, pass the raw elements JSON to the frontend for rendering
            if tc["name"] == "create_view":
                elements_json = tc["arguments"].get("elements", "")
                if elements_json:
                    log_entry["excalidraw_elements"] = elements_json

            if isinstance(result, dict):
                if "error" in result:
                    log_entry["success"] = False
                    log_entry["error"] = str(result["error"])
                # MCP tool results have a "content" array with typed blocks
                content_blocks = result.get("content", [])
                if isinstance(content_blocks, list):
                    for block in content_blocks:
                        if isinstance(block, dict):
                            btype = block.get("type", "")
                            if btype == "image":
                                log_entry["image"] = {
                                    "data": block.get("data", ""),
                                    "mimeType": block.get("mimeType", "image/png"),
                                }
                            elif btype == "resource":
                                res = block.get("resource", {})
                                uri = res.get("uri", "")
                                if uri:
                                    log_entry["resource_uri"] = uri
                                blob = res.get("blob", "")
                                mime = res.get("mimeType", "")
                                if blob and mime.startswith("image/"):
                                    log_entry["image"] = {"data": blob, "mimeType": mime}
                            elif btype == "text":
                                text = block.get("text", "")
                                if text and len(text) < 500:
                                    log_entry["text"] = text

            tool_use_log.append(log_entry)

    # Max rounds exceeded
    response = {"content": "[Tool use loop exceeded maximum rounds]", "error": False}
    if tool_use_log:
        response["tool_use_log"] = tool_use_log
    return response
