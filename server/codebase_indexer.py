import os
import re
import json
from pathlib import Path

IGNORE_DIRS = {
    'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv',
    'venv', 'coverage', '.next', '.cache', 'public/assets'
}

SUPPORTED_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs',
    '.json', '.css', '.html', '.sql', '.yaml', '.yml', '.md'
}

class CodebaseIndexer:
    def __init__(self):
        self.indexed_files = []
        self.stats = {
            "total_files": 0,
            "total_lines": 0,
            "languages": {},
            "components": [],
            "api_routes": [],
            "models_schemas": []
        }
        self.indexed_path = None

    def scan_directory(self, root_path: str):
        """Scans the directory, parses AST / structure, and builds code metadata index."""
        target_path = Path(root_path).resolve()
        if not target_path.exists() or not target_path.is_dir():
            raise ValueError(f"Directory path does not exist: {root_path}")

        self.indexed_path = str(target_path)
        self.indexed_files = []
        self.stats = {
            "total_files": 0,
            "total_lines": 0,
            "languages": {},
            "components": [],
            "api_routes": [],
            "models_schemas": []
        }

        for path in target_path.rglob("*"):
            if path.is_dir():
                continue
            
            # Check ignored directories
            if any(part in IGNORE_DIRS for part in path.parts):
                continue
            
            ext = path.suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue

            try:
                rel_path = str(path.relative_to(target_path)).replace("\\", "/")
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()

                lines = content.splitlines()
                num_lines = len(lines)
                
                # Language stats
                lang = ext[1:].upper()
                self.stats["languages"][lang] = self.stats["languages"].get(lang, 0) + 1
                self.stats["total_files"] += 1
                self.stats["total_lines"] += num_lines

                # Extract exports, components, and API routes via regex AST heuristics
                exports = self._extract_exports(content, ext)
                routes = self._extract_api_routes(content, ext, rel_path)
                schemas = self._extract_schemas(content, ext, rel_path)

                if routes:
                    self.stats["api_routes"].extend(routes)
                if schemas:
                    self.stats["models_schemas"].extend(schemas)

                file_summary = {
                    "path": rel_path,
                    "abs_path": str(path).replace("\\", "/"),
                    "lines": num_lines,
                    "extension": ext,
                    "language": lang,
                    "exports": exports,
                    "routes": routes,
                    "schemas": schemas,
                    "snippet": content[:1500]  # First 1.5k chars for fast context
                }

                self.indexed_files.append(file_summary)
            except Exception as e:
                print(f"Error scanning file {path}: {e}")

        return {
            "path": self.indexed_path,
            "stats": self.stats,
            "file_count": len(self.indexed_files),
            "files": self.indexed_files
        }

    def _extract_exports(self, content: str, ext: str):
        """Extract key function, class, or component definitions."""
        exports = []
        if ext in ['.js', '.jsx', '.ts', '.tsx']:
            # Export default / export const / function / class
            matches = re.findall(r'export\s+(?:default\s+)?(?:function|const|class|type|interface)\s+([A-Za-z0-9_]+)', content)
            exports.extend(matches)
        elif ext == '.py':
            matches = re.findall(r'^(?:def|class)\s+([A-Za-z0-9_]+)', content, re.MULTILINE)
            exports.extend(matches)
        return list(set(exports))[:10]

    def _extract_api_routes(self, content: str, ext: str, rel_path: str):
        """Extract HTTP endpoints from Express/FastAPI/Flask/Spring/Next.js routes."""
        routes = []
        if ext == '.py': # FastAPI / Flask / Django
            matches = re.findall(r'@app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']', content, re.IGNORECASE)
            for method, endpoint in matches:
                routes.append({"method": method.upper(), "endpoint": endpoint, "file": rel_path})
        elif ext in ['.js', '.ts']: # Express / Fastify / Node
            matches = re.findall(r'app\.(get|post|put|delete|patch)\(["\']([^"\']+)["\']', content, re.IGNORECASE)
            for method, endpoint in matches:
                routes.append({"method": method.upper(), "endpoint": endpoint, "file": rel_path})
        return routes

    def _extract_schemas(self, content: str, ext: str, rel_path: str):
        """Extract Pydantic models, TypeScript interfaces, or DB schemas."""
        schemas = []
        if ext == '.py':
            matches = re.findall(r'class\s+([A-Za-z0-9_]+)\((?:BaseModel|SQLModel|db\.Model)\)', content)
            schemas.extend(matches)
        elif ext in ['.ts', '.tsx']:
            matches = re.findall(r'(?:interface|type)\s+([A-Za-z0-9_]+)', content)
            schemas.extend(matches)
        return [{"name": s, "file": rel_path} for s in list(set(schemas))[:5]]

# Global singleton indexer instance
codebase_indexer = CodebaseIndexer()
