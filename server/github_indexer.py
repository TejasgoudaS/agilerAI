"""
GitHub API-based repository indexer.
Indexes repos directly from a GitHub URL — no manual directory path needed.
Supports public repos without auth, private repos with personal access token.
"""
import os
import re
import time
from typing import Optional
from math import log

GITHUB_API = "https://api.github.com"
MAX_FILES = 500       # Cap for large monorepos
MAX_FILE_SIZE = 50000  # 50KB per file

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".go",
    ".cs", ".rb", ".php", ".swift", ".kt", ".rs",
    ".sql", ".md", ".yaml", ".yml", ".json", ".toml",
    ".html", ".css", ".scss", ".graphql"
}

IGNORE_PATHS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv",
    "dist", "build", ".next", ".nuxt", "coverage", ".pytest_cache",
    "vendor", "target", "bin", "obj", ".gradle"
}


class GitHubIndexer:
    def __init__(self):
        self.indexed_files: list[dict] = []
        self.repo_info: dict = {}
        self.stats: dict = {}
        self.last_indexed_url: str = ""

    def _headers(self, token: Optional[str] = None) -> dict:
        h = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        tok = token or os.getenv("GITHUB_TOKEN", "")
        if tok:
            h["Authorization"] = f"Bearer {tok}"
        return h

    def _parse_url(self, url: str) -> tuple[str, str, str]:
        """Parse github.com/owner/repo[/tree/branch] into (owner, repo, branch)."""
        url = url.strip().rstrip("/")
        # Handle SSH: git@github.com:owner/repo.git
        url = re.sub(r"git@github\.com:", "https://github.com/", url)
        url = re.sub(r"\.git$", "", url)
        m = re.match(r"https?://github\.com/([^/]+)/([^/]+)(?:/tree/([^/]+))?", url)
        if not m:
            raise ValueError(f"Invalid GitHub URL: {url}")
        owner, repo, branch = m.group(1), m.group(2), m.group(3) or ""
        return owner, repo, branch

    def index_from_url(self, github_url: str, token: Optional[str] = None) -> dict:
        """Main entry point — index a GitHub repo and return stats."""
        try:
            import httpx
        except ImportError:
            raise RuntimeError("httpx required: pip install httpx")

        owner, repo, branch = self._parse_url(github_url)
        headers = self._headers(token)

        with httpx.Client(timeout=30.0) as client:
            # Get default branch if not specified
            if not branch:
                r = client.get(f"{GITHUB_API}/repos/{owner}/{repo}", headers=headers)
                r.raise_for_status()
                branch = r.json().get("default_branch", "main")
                self.repo_info = r.json()

            # Get file tree (recursive)
            r = client.get(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/trees/{branch}",
                headers=headers,
                params={"recursive": "1"}
            )
            r.raise_for_status()
            tree = r.json().get("tree", [])

            files_to_index = [
                f for f in tree
                if f["type"] == "blob"
                and any(f["path"].endswith(ext) for ext in SUPPORTED_EXTENSIONS)
                and not any(part in IGNORE_PATHS for part in f["path"].split("/"))
                and f.get("size", 0) < MAX_FILE_SIZE
            ][:MAX_FILES]

            self.indexed_files = []
            lang_counts: dict[str, int] = {}
            raw_base = f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}"

            for file_info in files_to_index:
                path = file_info["path"]
                ext = os.path.splitext(path)[1]
                try:
                    r = client.get(f"{raw_base}/{path}", headers=headers, timeout=10.0)
                    if r.status_code != 200:
                        continue
                    content = r.text
                    symbols = self._extract_symbols(content, ext, path)
                    self.indexed_files.append({
                        "path": path,
                        "extension": ext,
                        "size": len(content),
                        "content_preview": content[:300],
                        "symbols": symbols,
                        "github_url": f"https://github.com/{owner}/{repo}/blob/{branch}/{path}"
                    })
                    lang_counts[ext] = lang_counts.get(ext, 0) + 1
                    time.sleep(0.05)  # Gentle rate limit
                except Exception:
                    continue

        self.last_indexed_url = github_url
        self.stats = {
            "owner": owner,
            "repo": repo,
            "branch": branch,
            "fileCount": len(self.indexed_files),
            "languages": lang_counts,
            "stars": self.repo_info.get("stargazers_count", 0),
            "forks": self.repo_info.get("forks_count", 0),
            "description": self.repo_info.get("description", ""),
            "topics": self.repo_info.get("topics", []),
        }
        return self.stats

    def _extract_symbols(self, content: str, ext: str, path: str) -> list[str]:
        """Extract function/class/export names from file content."""
        symbols = []
        patterns = {
            ".py": [r"^def (\w+)", r"^class (\w+)", r"^async def (\w+)"],
            ".js": [r"export (?:default )?(?:function|class|const) (\w+)", r"function (\w+)\s*\("],
            ".ts": [r"export (?:default )?(?:function|class|interface|type|const) (\w+)"],
            ".jsx": [r"export (?:default )?(?:function|const) (\w+)", r"function (\w+)\s*\("],
            ".tsx": [r"export (?:default )?(?:function|const|interface|type) (\w+)"],
            ".java": [r"(?:public|private|protected)?\s*(?:class|interface|enum) (\w+)", r"(?:public|private|protected)?\s+\w+\s+(\w+)\s*\("],
            ".go": [r"^func (\w+)", r"^type (\w+)"],
        }
        for pat in patterns.get(ext, []):
            import re
            for m in re.finditer(pat, content, re.MULTILINE):
                symbols.append(m.group(1))
        return list(set(symbols))[:20]

    def search(self, query: str, top_k: int = 8) -> list[dict]:
        """Simple TF-IDF-style search over indexed GitHub files."""
        if not self.indexed_files or not query:
            return []
        query_terms = set(query.lower().split())
        scored = []
        for f in self.indexed_files:
            text = f"{f['path']} {' '.join(f['symbols'])} {f['content_preview']}".lower()
            score = sum(text.count(t) for t in query_terms)
            if score > 0:
                scored.append((score, f))
        scored.sort(key=lambda x: -x[0])
        return [f for _, f in scored[:top_k]]


github_indexer = GitHubIndexer()
