"""Text extraction from uploaded files."""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Max characters per file
MAX_CHARS_PER_FILE = 15000

# Text-based extensions (decoded as UTF-8)
TEXT_EXTENSIONS = {
    '.txt', '.md', '.py', '.js', '.ts', '.jsx', '.tsx', '.css', '.html',
    '.json', '.csv', '.xml', '.yaml', '.yml', '.toml', '.sh', '.sql',
    '.rs', '.go', '.java', '.c', '.cpp', '.h', '.hpp', '.rb', '.swift',
    '.kt', '.scala', '.r', '.m', '.php', '.pl', '.lua', '.zig',
    '.env', '.ini', '.cfg', '.conf', '.log', '.gitignore', '.dockerignore',
    '.dockerfile', '.makefile', '.cmake',
}


def extract_text(filename: str, content: bytes) -> Optional[str]:
    """
    Extract text content from a file.

    Args:
        filename: Original filename (used to detect type)
        content: Raw file bytes

    Returns:
        Extracted text string, or None if extraction fails.
    """
    ext = Path(filename).suffix.lower()
    name_lower = filename.lower()

    # Handle files without extensions that are text (Makefile, Dockerfile, etc.)
    if not ext and name_lower in ('makefile', 'dockerfile', 'gemfile', 'rakefile', 'procfile'):
        ext = '.makefile'

    try:
        if ext == '.pdf':
            return _extract_pdf(content)
        elif ext in TEXT_EXTENSIONS or not ext:
            return _extract_text(content)
        else:
            logger.warning(f"Unsupported file type: {ext} ({filename})")
            return None
    except Exception as e:
        logger.error(f"Failed to extract text from {filename}: {e}")
        return None


def _extract_text(content: bytes) -> Optional[str]:
    """Extract text from plain text files."""
    try:
        text = content.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text = content.decode('latin-1')
        except Exception:
            return None

    if len(text) > MAX_CHARS_PER_FILE:
        text = text[:MAX_CHARS_PER_FILE] + "\n\n... [file truncated]"
    return text


def _extract_pdf(content: bytes) -> Optional[str]:
    """Extract text from PDF files using pypdf."""
    try:
        from pypdf import PdfReader
        import io

        reader = PdfReader(io.BytesIO(content))
        pages_text = []
        total_chars = 0

        for i, page in enumerate(reader.pages):
            page_text = page.extract_text() or ""
            if page_text.strip():
                pages_text.append(f"[Page {i + 1}]\n{page_text}")
                total_chars += len(page_text)
                if total_chars > MAX_CHARS_PER_FILE:
                    pages_text.append(f"\n... [PDF truncated at page {i + 1}/{len(reader.pages)}]")
                    break

        if not pages_text:
            return "[PDF contained no extractable text - may be image-based]"

        return "\n\n".join(pages_text)

    except ImportError:
        logger.error("pypdf not installed. Install with: uv add pypdf")
        return "[PDF extraction unavailable - pypdf not installed]"
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        return None
