"""AWS Bedrock provider using Converse API with bearer token auth."""

import os
import asyncio
import logging
from typing import List, Dict, Any
from .base import LLMProvider
from ..settings import get_settings

logger = logging.getLogger(__name__)


class BedrockProvider(LLMProvider):
    """AWS Bedrock provider using boto3 Converse API.

    Auth: AWS_BEARER_TOKEN_BEDROCK env var (bearer token).
    Model IDs are user-configured (not auto-discovered).
    """

    def _get_config(self) -> tuple:
        settings = get_settings()
        return (
            settings.bedrock_api_key or "",
            settings.bedrock_region or "us-east-1",
        )

    def _get_client(self, api_key: str = None, region: str = None):
        import boto3

        if not api_key or not region:
            stored_key, stored_region = self._get_config()
            api_key = api_key or stored_key
            region = region or stored_region

        # Set bearer token env var (must be set BEFORE creating session)
        os.environ['AWS_BEARER_TOKEN_BEDROCK'] = api_key

        # Temporarily suppress ALL other AWS credential sources so boto3
        # only sees the bearer token. Without this, IAM creds from env vars
        # or ~/.aws/* files take priority and bearer token auth never fires.
        suppress_keys = [
            'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
            'AWS_PROFILE', 'AWS_CONFIG_FILE', 'AWS_SHARED_CREDENTIALS_FILE',
        ]
        stashed = {}
        for key in suppress_keys:
            if key in os.environ:
                stashed[key] = os.environ.pop(key)
        # Point config/creds files to non-existent paths
        os.environ['AWS_CONFIG_FILE'] = '/dev/null'
        os.environ['AWS_SHARED_CREDENTIALS_FILE'] = '/dev/null'

        logger.debug(f"Bedrock _get_client: suppressed {list(stashed.keys())}, region={region}")

        try:
            # Create a fresh session so boto3 re-resolves credentials
            session = boto3.Session(region_name=region)
            client = session.client("bedrock-runtime", region_name=region)
        finally:
            # Restore original env vars
            os.environ.pop('AWS_CONFIG_FILE', None)
            os.environ.pop('AWS_SHARED_CREDENTIALS_FILE', None)
            for key, val in stashed.items():
                os.environ[key] = val

        return client

    def _convert_messages(self, messages: List[Dict[str, str]]) -> tuple:
        """Convert OpenAI-format messages to Bedrock Converse format.

        Returns (system_prompts, converse_messages)
        """
        system_prompts = []
        converse_messages = []

        for msg in messages:
            role = msg.get("role", "")
            content = msg.get("content", "")

            if role == "system":
                system_prompts.append({"text": content})
            elif role == "user":
                converse_messages.append({
                    "role": "user",
                    "content": [{"text": content}]
                })
            elif role == "assistant":
                converse_messages.append({
                    "role": "assistant",
                    "content": [{"text": content}]
                })

        return system_prompts, converse_messages

    async def query(self, model_id: str, messages: List[Dict[str, str]], timeout: float = 120.0, temperature: float = 0.7) -> Dict[str, Any]:
        api_key, region = self._get_config()
        if not api_key:
            return {"error": True, "error_message": "AWS Bedrock API key not configured"}

        model = model_id.removeprefix("bedrock:")
        system_prompts, converse_messages = self._convert_messages(messages)

        try:
            client = self._get_client(api_key, region)

            def _call():
                kwargs = {
                    "modelId": model,
                    "messages": converse_messages,
                    "inferenceConfig": {
                        "temperature": temperature,
                        "maxTokens": 4096,
                    },
                }
                if system_prompts:
                    kwargs["system"] = system_prompts
                return client.converse(**kwargs)

            response = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _call),
                timeout=timeout
            )

            content_blocks = response["output"]["message"]["content"]
            text_parts = [b["text"] for b in content_blocks if "text" in b]
            content = "\n".join(text_parts)

            if not content:
                return {"error": True, "error_message": "Empty response from Bedrock"}

            return {"content": content, "error": False}

        except asyncio.TimeoutError:
            return {"error": True, "error_message": f"Bedrock request timed out after {timeout}s"}
        except Exception as e:
            logger.error(f"Bedrock query error: {e}")
            return {"error": True, "error_message": f"Bedrock error: {e}"}

    async def get_models(self) -> List[Dict[str, Any]]:
        """Return user-configured Bedrock model IDs from settings."""
        settings = get_settings()
        if not settings.bedrock_api_key:
            return []

        models = []
        for model_id in (settings.bedrock_model_ids or []):
            model_id = model_id.strip()
            if not model_id:
                continue
            display_name = model_id
            parts = model_id.split(".")
            if len(parts) > 1:
                display_name = ".".join(parts[1:])
            models.append({
                "id": f"bedrock:{model_id}",
                "name": f"{display_name} [Bedrock]",
                "provider": "AWS Bedrock",
            })
        return models

    async def validate_key(self, api_key: str) -> Dict[str, Any]:
        """Validate by making a real converse call via bedrock-runtime."""
        settings = get_settings()
        region = settings.bedrock_region or "us-east-1"

        logger.info(f"Bedrock validate_key: region={region}")

        test_model = None
        if settings.bedrock_model_ids:
            for mid in settings.bedrock_model_ids:
                if mid.strip():
                    test_model = mid.strip()
                    break

        if not test_model:
            logger.warning("Bedrock validate_key: No model IDs configured")
            return {
                "success": False,
                "message": "Add at least one model ID first, then test."
            }

        logger.info(f"Bedrock validate_key: test_model={test_model}, api_key_length={len(api_key)}, api_key_prefix={api_key[:12]}...")

        try:
            client = self._get_client(api_key, region)
            logger.info(f"Bedrock validate_key: boto3 client created for bedrock-runtime in {region}")
            logger.info(f"Bedrock validate_key: AWS_BEARER_TOKEN_BEDROCK env set={bool(os.environ.get('AWS_BEARER_TOKEN_BEDROCK'))}")

            def _validate():
                logger.info(f"Bedrock validate_key: Calling converse(modelId={test_model}, maxTokens=1)")
                try:
                    result = client.converse(
                        modelId=test_model,
                        messages=[{
                            "role": "user",
                            "content": [{"text": "Hi"}]
                        }],
                        inferenceConfig={"maxTokens": 1},
                    )
                    logger.info(f"Bedrock validate_key: converse SUCCESS, response keys={list(result.keys())}")
                    return result
                except Exception as inner_e:
                    logger.error(f"Bedrock validate_key: converse FAILED: {type(inner_e).__name__}: {inner_e}")
                    raise

            await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(None, _validate),
                timeout=15.0
            )
            return {
                "success": True,
                "message": f"Connected to Bedrock in {region}. Tested with {test_model}."
            }

        except asyncio.TimeoutError:
            logger.error("Bedrock validate_key: Connection timed out after 15s")
            return {"success": False, "message": "Connection timed out"}
        except Exception as e:
            logger.error(f"Bedrock validate_key: {type(e).__name__}: {e}")
            return {"success": False, "message": f"Failed: {e}"}
