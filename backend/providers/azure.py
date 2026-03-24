"""Azure OpenAI provider (Azure AI Foundry).

Uses the OpenAI Python SDK with a custom base_url, matching the
official Azure AI Foundry usage pattern. This ensures compatibility
with all Azure-hosted models (including reasoning/pro models that
reject raw /chat/completions calls).
"""

import asyncio
import logging
from typing import List, Dict, Any
from .base import LLMProvider
from ..settings import get_settings

logger = logging.getLogger(__name__)


class AzureProvider(LLMProvider):
    """Provider for Azure OpenAI (AI Foundry) endpoints."""

    def _get_config(self) -> tuple:
        settings = get_settings()
        return (
            settings.azure_endpoint or "",
            settings.azure_api_key or "",
        )

    def _get_client(self, endpoint: str = None, api_key: str = None):
        """Create an OpenAI client pointed at the Azure endpoint."""
        from openai import OpenAI

        if not endpoint or not api_key:
            stored_endpoint, stored_key = self._get_config()
            endpoint = endpoint or stored_endpoint
            api_key = api_key or stored_key

        return OpenAI(base_url=endpoint, api_key=api_key)

    async def query(self, model_id: str, messages: List[Dict[str, str]], timeout: float = 120.0, temperature: float = 0.7, tools: list = None) -> Dict[str, Any]:
        endpoint, api_key = self._get_config()
        if not endpoint:
            return {"error": True, "error_message": "Azure endpoint not configured"}
        if not api_key:
            return {"error": True, "error_message": "Azure API key not configured"}

        deployment = model_id.removeprefix("azure:")

        try:
            client = self._get_client(endpoint, api_key)

            def _call():
                kwargs = {
                    "model": deployment,
                    "messages": messages,
                    "temperature": temperature,
                }
                if tools:
                    kwargs["tools"] = tools
                return client.chat.completions.create(**kwargs)

            completion = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _call),
                timeout=timeout,
            )

            # Check for tool calls
            message = completion.choices[0].message
            if tools and message.tool_calls:
                from ..tool_use import extract_tool_calls_openai
                # Convert SDK response to dict format for extract_tool_calls_openai
                data = {
                    "choices": [{
                        "message": {
                            "content": message.content,
                            "tool_calls": [
                                {
                                    "id": tc.id,
                                    "type": tc.type,
                                    "function": {
                                        "name": tc.function.name,
                                        "arguments": tc.function.arguments,
                                    }
                                }
                                for tc in message.tool_calls
                            ]
                        }
                    }]
                }
                content, tool_calls, raw_message = extract_tool_calls_openai(data)
                if tool_calls:
                    return {
                        "content": content,
                        "tool_calls": tool_calls,
                        "raw_message": raw_message,
                        "error": False,
                    }

            content = message.content
            if not content:
                return {"error": True, "error_message": "Empty response from Azure"}

            return {"content": content, "error": False}

        except asyncio.TimeoutError:
            return {"error": True, "error_message": f"Azure request timed out after {timeout}s"}
        except Exception as e:
            logger.error(f"Azure query error: {e}")
            return {"error": True, "error_message": f"Azure error: {e}"}

    async def get_models(self) -> List[Dict[str, Any]]:
        """Return user-configured Azure deployment names from settings."""
        settings = get_settings()
        if not settings.azure_api_key:
            return []

        models = []
        for deployment in (settings.azure_deployment_names or []):
            deployment = deployment.strip()
            if not deployment:
                continue
            models.append({
                "id": f"azure:{deployment}",
                "name": f"{deployment} [Azure]",
                "provider": "Azure OpenAI",
            })
        return models

    async def validate_key(self, api_key: str) -> Dict[str, Any]:
        """Validate by making a minimal chat completion call via the SDK."""
        settings = get_settings()
        endpoint = settings.azure_endpoint or ""

        if not endpoint:
            return {"success": False, "message": "Configure the Azure endpoint first."}

        test_deployment = None
        if settings.azure_deployment_names:
            for name in settings.azure_deployment_names:
                if name.strip():
                    test_deployment = name.strip()
                    break

        if not test_deployment:
            return {
                "success": False,
                "message": "Add at least one deployment name first, then test."
            }

        logger.info(f"Azure validate_key: endpoint={endpoint}, deployment={test_deployment}")

        try:
            client = self._get_client(endpoint, api_key)

            def _validate():
                return client.chat.completions.create(
                    model=test_deployment,
                    messages=[{"role": "user", "content": "Hi"}],
                    max_completion_tokens=10,
                )

            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _validate),
                timeout=15.0,
            )

            return {
                "success": True,
                "message": f"Connected to Azure. Tested with {test_deployment}."
            }

        except asyncio.TimeoutError:
            return {"success": False, "message": "Connection timed out."}
        except Exception as e:
            logger.error(f"Azure validate_key error: {e}")
            return {"success": False, "message": f"Failed: {e}"}
