"""In-memory audit log for live debugging."""

import logging
import time
from collections import deque
from typing import List, Dict, Any

# Store last 500 log entries
_log_buffer: deque = deque(maxlen=500)
_log_counter = 0


def add_entry(level: str, source: str, message: str):
    """Add a log entry to the audit buffer."""
    global _log_counter
    _log_counter += 1
    _log_buffer.append({
        "id": _log_counter,
        "timestamp": time.time(),
        "level": level,
        "source": source,
        "message": message,
    })


def get_entries(since_id: int = 0) -> List[Dict[str, Any]]:
    """Get log entries after the given ID."""
    return [e for e in _log_buffer if e["id"] > since_id]


def clear():
    """Clear all entries."""
    _log_buffer.clear()


class AuditLogHandler(logging.Handler):
    """Python logging handler that feeds into the audit log buffer."""

    def emit(self, record):
        try:
            msg = self.format(record)
            add_entry(record.levelname, record.name, msg)
        except Exception:
            pass


def setup_logging():
    """Install the audit log handler on the root logger and key loggers."""
    handler = AuditLogHandler()
    handler.setLevel(logging.DEBUG)
    handler.setFormatter(logging.Formatter("%(message)s"))

    # Attach to root logger
    root = logging.getLogger()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG)

    # Also capture print-style logs from specific modules
    for name in ["backend.council", "backend.providers.bedrock", "backend.main", "backend.search"]:
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
