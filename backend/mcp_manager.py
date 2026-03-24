"""MCP (Model Context Protocol) client manager.

Manages connections to MCP servers, discovers tools, and checks health.
Supports both stdio (subprocess) and HTTP (Streamable HTTP) transports.
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

# MCP protocol version
MCP_PROTOCOL_VERSION = "2024-11-05"

CLIENT_INFO = {
    "name": "llm-council-plus",
    "version": "0.1.0",
}


class MCPServerConnection:
    """Represents a connection to a single MCP server."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.server_id: str = config["id"]
        self.name: str = config["name"]
        self.transport: str = config.get("type", "http")  # "http" or "stdio"
        self.url: Optional[str] = config.get("url")
        self.command: Optional[str] = config.get("command")
        self.args: List[str] = config.get("args", [])
        self.env: Dict[str, str] = config.get("env", {})
        self.headers: Dict[str, str] = config.get("headers", {})

        # Connection state
        self.connected: bool = False
        self.server_info: Optional[Dict[str, Any]] = None
        self.server_capabilities: Optional[Dict[str, Any]] = None
        self.tools: List[Dict[str, Any]] = []
        self.last_ping_ms: Optional[float] = None
        self.last_error: Optional[str] = None
        self.session_id: Optional[str] = None

        # Stdio process
        self._process: Optional[asyncio.subprocess.Process] = None
        self._request_id: int = 0
        self._pending: Dict[int, asyncio.Future] = {}
        self._reader_task: Optional[asyncio.Task] = None

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    # ---- HTTP Transport ----

    async def _http_request(self, method: str, params: Optional[Dict] = None) -> Any:
        """Send a JSON-RPC request over HTTP."""
        if not self.url:
            raise ValueError("No URL configured for HTTP transport")

        request_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **self.headers,
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(self.url, json=payload, headers=headers)

            # Capture session ID from response
            if "Mcp-Session-Id" in resp.headers:
                self.session_id = resp.headers["Mcp-Session-Id"]

            if resp.status_code != 200:
                raise Exception(f"HTTP {resp.status_code}: {resp.text[:200]}")

            content_type = resp.headers.get("content-type", "")

            if "text/event-stream" in content_type:
                # Parse SSE response - find the last data line with JSON-RPC result
                result = None
                for line in resp.text.split("\n"):
                    if line.startswith("data: "):
                        try:
                            parsed = json.loads(line[6:])
                            if "result" in parsed:
                                result = parsed["result"]
                            elif "error" in parsed:
                                raise Exception(f"MCP error: {parsed['error']}")
                        except json.JSONDecodeError:
                            continue
                return result
            else:
                data = resp.json()
                if "error" in data:
                    raise Exception(f"MCP error: {data['error']}")
                return data.get("result")

    async def _http_notify(self, method: str, params: Optional[Dict] = None) -> None:
        """Send a JSON-RPC notification (no id, no response expected)."""
        if not self.url:
            return

        payload = {
            "jsonrpc": "2.0",
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        headers = {
            "Content-Type": "application/json",
            **self.headers,
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id

        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(self.url, json=payload, headers=headers)

    # ---- Stdio Transport ----

    async def _stdio_start(self) -> None:
        """Start the stdio subprocess."""
        if not self.command:
            raise ValueError("No command configured for stdio transport")

        import os
        import shlex
        env = {**os.environ, **self.env}

        # Use create_subprocess_exec for safety (no shell injection)
        self._process = await asyncio.create_subprocess_exec(
            self.command, *self.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        self._reader_task = asyncio.create_task(self._stdio_reader())

    async def _stdio_reader(self) -> None:
        """Read JSON-RPC responses from stdout."""
        if not self._process or not self._process.stdout:
            return
        try:
            while True:
                line = await self._process.stdout.readline()
                if not line:
                    break
                try:
                    msg = json.loads(line.decode().strip())
                    msg_id = msg.get("id")
                    if msg_id is not None and msg_id in self._pending:
                        future = self._pending.pop(msg_id)
                        if "error" in msg:
                            future.set_exception(Exception(f"MCP error: {msg['error']}"))
                        else:
                            future.set_result(msg.get("result"))
                except (json.JSONDecodeError, Exception) as e:
                    logger.debug(f"Stdio parse error: {e}")
        except asyncio.CancelledError:
            pass

    async def _stdio_request(self, method: str, params: Optional[Dict] = None) -> Any:
        """Send a JSON-RPC request over stdio."""
        if not self._process or not self._process.stdin:
            raise Exception("Stdio process not running")

        request_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        future: asyncio.Future = asyncio.get_event_loop().create_future()
        self._pending[request_id] = future

        data = json.dumps(payload) + "\n"
        self._process.stdin.write(data.encode())
        await self._process.stdin.drain()

        return await asyncio.wait_for(future, timeout=30.0)

    async def _stdio_notify(self, method: str, params: Optional[Dict] = None) -> None:
        """Send a JSON-RPC notification over stdio."""
        if not self._process or not self._process.stdin:
            return

        payload = {
            "jsonrpc": "2.0",
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        data = json.dumps(payload) + "\n"
        self._process.stdin.write(data.encode())
        await self._process.stdin.drain()

    # ---- Unified interface ----

    async def _request(self, method: str, params: Optional[Dict] = None) -> Any:
        if self.transport == "stdio":
            return await self._stdio_request(method, params)
        return await self._http_request(method, params)

    async def _notify(self, method: str, params: Optional[Dict] = None) -> None:
        if self.transport == "stdio":
            await self._stdio_notify(method, params)
        else:
            await self._http_notify(method, params)

    # ---- Public API ----

    async def connect(self) -> bool:
        """Initialize connection to the MCP server."""
        try:
            self.last_error = None
            start = time.time()

            # Start stdio process if needed
            if self.transport == "stdio":
                await self._stdio_start()

            # Send initialize request
            result = await self._request("initialize", {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": CLIENT_INFO,
            })

            self.server_info = result.get("serverInfo", {})
            self.server_capabilities = result.get("capabilities", {})

            # Send initialized notification
            await self._notify("notifications/initialized")

            # Discover tools
            await self.refresh_tools()

            self.connected = True
            self.last_ping_ms = round((time.time() - start) * 1000, 1)
            logger.info(f"Connected to MCP server '{self.name}' ({len(self.tools)} tools, {self.last_ping_ms}ms)")
            return True

        except Exception as e:
            self.connected = False
            self.last_error = str(e)
            logger.error(f"Failed to connect to MCP server '{self.name}': {e}")
            return False

    async def disconnect(self) -> None:
        """Disconnect from the MCP server."""
        if self.transport == "stdio" and self._process:
            if self._reader_task:
                self._reader_task.cancel()
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()
            self._process = None

        self.connected = False
        self.tools = []
        self.session_id = None
        logger.info(f"Disconnected from MCP server '{self.name}'")

    async def refresh_tools(self) -> List[Dict[str, Any]]:
        """Fetch the list of available tools from the server."""
        try:
            result = await self._request("tools/list")
            self.tools = result.get("tools", []) if result else []
            return self.tools
        except Exception as e:
            logger.error(f"Failed to list tools from '{self.name}': {e}")
            self.tools = []
            return []

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Call a tool on the MCP server."""
        return await self._request("tools/call", {
            "name": tool_name,
            "arguments": arguments,
        })

    async def list_resources(self) -> List[Dict[str, Any]]:
        """List available resources from the server."""
        try:
            result = await self._request("resources/list")
            return result.get("resources", []) if result else []
        except Exception as e:
            logger.debug(f"resources/list not supported by '{self.name}': {e}")
            return []

    async def read_resource(self, uri: str) -> Any:
        """Read a specific resource by URI."""
        try:
            result = await self._request("resources/read", {"uri": uri})
            return result
        except Exception as e:
            logger.debug(f"resources/read failed for '{self.name}' uri={uri}: {e}")
            return None

    async def ping(self) -> float:
        """Ping the server and return latency in ms."""
        start = time.time()
        try:
            await self._request("ping")
            ms = round((time.time() - start) * 1000, 1)
            self.last_ping_ms = ms
            self.last_error = None
            return ms
        except Exception as e:
            self.last_error = str(e)
            raise

    def to_status_dict(self) -> Dict[str, Any]:
        """Return status info for API responses."""
        return {
            "id": self.server_id,
            "name": self.name,
            "type": self.transport,
            "url": self.url,
            "command": self.command,
            "connected": self.connected,
            "server_info": self.server_info,
            "tools_count": len(self.tools),
            "tools": [
                {
                    "name": t.get("name", ""),
                    "description": t.get("description", ""),
                }
                for t in self.tools
            ],
            "last_ping_ms": self.last_ping_ms,
            "last_error": self.last_error,
            "enabled": self.config.get("enabled", True),
        }


class MCPManager:
    """Manages multiple MCP server connections."""

    def __init__(self):
        self.connections: Dict[str, MCPServerConnection] = {}

    def load_from_settings(self, mcp_servers: List[Dict[str, Any]]) -> None:
        """Load server configs from settings. Does not auto-connect."""
        for config in mcp_servers:
            server_id = config.get("id")
            if server_id and server_id not in self.connections:
                self.connections[server_id] = MCPServerConnection(config)

    async def add_server(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Add a new MCP server config and optionally connect."""
        if not config.get("id"):
            config["id"] = str(uuid.uuid4())[:8]

        server = MCPServerConnection(config)
        self.connections[server.server_id] = server

        # Auto-connect if enabled
        if config.get("enabled", True):
            await server.connect()

        return server.to_status_dict()

    async def remove_server(self, server_id: str) -> bool:
        """Remove and disconnect a server."""
        if server_id not in self.connections:
            return False

        conn = self.connections[server_id]
        if conn.connected:
            await conn.disconnect()

        del self.connections[server_id]
        return True

    async def connect_server(self, server_id: str) -> bool:
        """Connect to a specific server."""
        if server_id not in self.connections:
            return False
        return await self.connections[server_id].connect()

    async def disconnect_server(self, server_id: str) -> bool:
        """Disconnect from a specific server."""
        if server_id not in self.connections:
            return False
        await self.connections[server_id].disconnect()
        return True

    def get_server(self, server_id: str) -> Optional[MCPServerConnection]:
        return self.connections.get(server_id)

    def get_all_status(self) -> List[Dict[str, Any]]:
        """Get status of all configured servers."""
        return [conn.to_status_dict() for conn in self.connections.values()]

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Get all available tools across all connected servers."""
        tools = []
        for conn in self.connections.values():
            if conn.connected:
                for tool in conn.tools:
                    tools.append({
                        "server_id": conn.server_id,
                        "server_name": conn.name,
                        **tool,
                    })
        return tools

    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Any:
        """Route a tool call to the server that provides it."""
        for conn in self.connections.values():
            if conn.connected:
                for tool in conn.tools:
                    if tool.get("name") == tool_name:
                        return await conn.call_tool(tool_name, arguments)
        raise ValueError(f"Tool '{tool_name}' not found on any connected MCP server")

    def get_health_summary(self) -> Dict[str, Any]:
        """Get overall health summary."""
        total = len(self.connections)
        connected = sum(1 for c in self.connections.values() if c.connected)
        total_tools = sum(len(c.tools) for c in self.connections.values() if c.connected)

        return {
            "overall": "healthy" if connected == total and total > 0 else "degraded" if connected > 0 else "offline",
            "total_servers": total,
            "connected_servers": connected,
            "total_tools": total_tools,
            "servers": {
                c.server_id: {
                    "name": c.name,
                    "connected": c.connected,
                    "latency_ms": c.last_ping_ms,
                    "error": c.last_error,
                }
                for c in self.connections.values()
            },
        }

    async def refresh_all(self) -> Dict[str, Any]:
        """Refresh connections and tools for all servers."""
        results = {}
        for server_id, conn in self.connections.items():
            if conn.config.get("enabled", True):
                if not conn.connected:
                    success = await conn.connect()
                    results[server_id] = "connected" if success else f"failed: {conn.last_error}"
                else:
                    try:
                        await conn.ping()
                        await conn.refresh_tools()
                        results[server_id] = "refreshed"
                    except Exception:
                        conn.connected = False
                        # Try to reconnect
                        success = await conn.connect()
                        results[server_id] = "reconnected" if success else f"failed: {conn.last_error}"
            else:
                results[server_id] = "disabled"

        return results

    async def shutdown(self) -> None:
        """Disconnect all servers."""
        for conn in self.connections.values():
            if conn.connected:
                await conn.disconnect()


# Global singleton
mcp_manager = MCPManager()
