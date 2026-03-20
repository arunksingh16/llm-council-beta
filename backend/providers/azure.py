"""Azure OpenAI provider (Azure AI Foundry)."""

import httpx
import logging
from typing import List, Dict, Any
from .base import LLMProvider
from ..settings import get_settings

logger = logging.getLogger(__name__)


class AzureProvider(LLMProvider):
    """Provider for Azure OpenAI (AI Foundry) endpoints.

    Uses the OpenAI-compatible API exposed by Azure at:
        {endpoint}/chat/completions
    with deployment names as the model parameter.
    """

    def _get_config(self) -> tuple:
        settings = get_settings()
        return (
            settings.azure_endpoint or "",
            settings.azure_api_key or "",
        )

    async def query(self, model_id: str, messages: List[Dict[str, str]], timeout: float = 120.0, temperature: float = 0.7) -> Dict[str, Any]:
        endpoint, api_key = self._get_config()
        if not endpoint:
            return {"error": True, "error_message": "Azure endpoint not configured"}
        if not api_key:
            return {"error": True, "error_message": "Azure API key not configured"}

        # Strip prefix
        deployment = model_id.removeprefix("azure:")

        # Normalize URL - remove trailing slash
        if endpoint.endswith('/'):
            endpoint = endpoint[:-1]

        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }

            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{endpoint}/chat/completions",
                    headers=headers,
                    json={
                        "model": deployment,
                        "messages": messages,
                        "temperature": temperature,
                    }
                )

                if response.status_code != 200:
                    return {
                        "error": True,
                        "error_message": f"Azure API error: {response.status_code} - {response.text}"
                    }

                data = response.json()
                content = data["choices"][0]["message"]["content"]
                return {"content": content, "error": False}

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
        """Validate by making a minimal chat completion call."""
        settings = get_settings()
        endpoint = settings.azure_endpoint or ""

        if not endpoint:
            return {"success": False, "message": "Configure the Azure endpoint first."}

        # Find a deployment to test with
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

        # Normalize URL
        if endpoint.endswith('/'):
            endpoint = endpoint[:-1]

        logger.info(f"Azure validate_key: endpoint={endpoint}, deployment={test_deployment}")

        try:
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{endpoint}/chat/completions",
                    headers=headers,
                    json={
                        "model": test_deployment,
                        "messages": [{"role": "user", "content": "Hi"}],
                        "max_completion_tokens": 10,
                    }
                )

                if response.status_code == 200:
                    return {
                        "success": True,
                        "message": f"Connected to Azure. Tested with {test_deployment}."
                    }
                elif response.status_code == 401 or response.status_code == 403:
                    return {"success": False, "message": "Authentication failed. Check your API key."}
                else:
                    return {"success": False, "message": f"Azure API error: {response.status_code} - {response.text[:200]}"}

        except httpx.ConnectError:
            return {"success": False, "message": "Connection failed. Check the endpoint URL."}
        except httpx.TimeoutException:
            return {"success": False, "message": "Connection timed out."}
        except Exception as e:
            logger.error(f"Azure validate_key error: {e}")
            return {"success": False, "message": f"Failed: {e}"}
