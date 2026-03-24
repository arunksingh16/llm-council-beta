"""Base class for LLM providers."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def query(self, model_id: str, messages: List[Dict[str, str]], timeout: float = 120.0, temperature: float = 0.7, tools: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Send a query to the LLM.

        Args:
            model_id: The ID of the model to query.
            messages: List of message dicts (role, content).
            timeout: Request timeout in seconds.
            temperature: Sampling temperature.
            tools: Optional list of tool definitions (provider-specific format).

        Returns:
            Dict containing 'content' (str) or 'error' (bool) and 'error_message' (str).
            When tools are used and model wants to call tools:
            - 'tool_calls': List of tool call dicts
            - 'raw_message': The raw assistant message for conversation continuation
        """
        pass

    @abstractmethod
    async def get_models(self) -> List[Dict[str, Any]]:
        """
        Fetch available models from the provider.
        
        Returns:
            List of model dicts (id, name, context_length, etc.).
        """
        pass

    @abstractmethod
    async def validate_key(self, api_key: str) -> Dict[str, Any]:
        """
        Validate the provided API key.
        
        Args:
            api_key: The API key to test.
            
        Returns:
            Dict with 'success' (bool) and 'message' (str).
        """
        pass
