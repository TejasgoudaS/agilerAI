import os
import re
import json
import math
import hashlib
from collections import Counter

import httpx

from codebase_indexer import codebase_indexer

try:
    from rank_bm25 import BM25Okapi
except Exception:
    BM25Okapi = None

EMBEDDING_MODEL = "text-embedding-3-small"
CACHE_PATH = os.path.join(os.path.dirname(__file__), ".cache", "embeddings.json")
RRF_K = 60  # standard reciprocal rank fusion smoothing constant


def _get_api_key() -> str:
    return os.getenv("VITE_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY", "")


class RAGEngine:
    """
    Hybrid retrieval engine for code repositories.

    - Sparse:  BM25Okapi over tokenized file content (path + exports + snippet).
    - Dense:   OpenAI text-embedding-3-small vectors, cosine similarity.
    - Fusion:  Reciprocal Rank Fusion (RRF) combining the two rankings — avoids
               needing a heavyweight cross-encoder reranker while still
               correcting each method's blind spots (BM25 misses synonyms/
               paraphrases, embeddings miss exact identifier/path matches).

    Falls back to a plain TF-IDF cosine search if BM25 or the embeddings API
    are unavailable (no API key, offline demo, rate limit), so retrieval
    never hard-fails.
    """

    def __init__(self):
        self._embedding_cache = self._load_cache()

    # ── Disk cache for file embeddings (keyed by content hash) ─────────
    def _load_cache(self) -> dict:
        try:
            if os.path.exists(CACHE_PATH):
                with open(CACHE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    def _save_cache(self):
        try:
            os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
            with open(CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(self._embedding_cache, f)
        except Exception:
            pass

    @staticmethod
    def _content_hash(text: str) -> str:
        return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()

    def tokenize(self, text: str):
        """Tokenize code & text into normalized word symbols."""
        return re.findall(r'[A-Za-z0-9_]{2,}', text.lower())

    @staticmethod
    def _file_text(item: dict) -> str:
        return f"{item['path']} {' '.join(item.get('exports', []))} {item['snippet']}"

    # ── Dense embeddings ─────────────────────────────────────────────
    def _embed_batch(self, texts: list, api_key: str) -> list:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": EMBEDDING_MODEL, "input": texts},
            )
            resp.raise_for_status()
            return [item["embedding"] for item in resp.json()["data"]]

    def _get_file_embeddings(self, indexed_files: list, api_key: str) -> dict:
        """Returns {path: vector}. Only embeds cache misses (content changed or new file)."""
        to_embed_meta = []
        to_embed_texts = []
        result = {}

        for f in indexed_files:
            text = self._file_text(f)
            h = self._content_hash(text)
            cached = self._embedding_cache.get(f['path'])
            if cached and cached.get('hash') == h:
                result[f['path']] = cached['vector']
            else:
                to_embed_meta.append((f['path'], h))
                to_embed_texts.append(text[:6000])

        # Batch to stay well under request size/token limits
        for i in range(0, len(to_embed_texts), 64):
            batch_texts = to_embed_texts[i:i + 64]
            batch_meta = to_embed_meta[i:i + 64]
            vectors = self._embed_batch(batch_texts, api_key)
            for (path, h), vec in zip(batch_meta, vectors):
                result[path] = vec
                self._embedding_cache[path] = {"hash": h, "vector": vec}

        if to_embed_texts:
            self._save_cache()

        return result

    @staticmethod
    def _cosine(a: list, b: list) -> float:
        if not a or not b:
            return 0.0
        dot = sum(x * y for x, y in zip(a, b))
        na = math.sqrt(sum(x * x for x in a))
        nb = math.sqrt(sum(y * y for y in b))
        return dot / (na * nb) if na > 0 and nb > 0 else 0.0

    # ── Sparse: BM25 ─────────────────────────────────────────────────
    def _bm25_ranking(self, query_tokens: list, indexed_files: list):
        corpus = [self.tokenize(self._file_text(f)) for f in indexed_files]
        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(query_tokens)
        ranked = sorted(range(len(indexed_files)), key=lambda i: scores[i], reverse=True)
        return ranked

    # ── Legacy sparse fallback: TF-IDF cosine (no deps, always works) ──
    def _tfidf_search(self, query: str, indexed_files: list, top_k: int):
        query_tokens = self.tokenize(query)
        query_counter = Counter(query_tokens)
        doc_scores = []

        for file_item in indexed_files:
            doc_counter = Counter(self.tokenize(self._file_text(file_item)))
            common_words = set(query_counter.keys()) & set(doc_counter.keys())
            dot_product = sum(query_counter[w] * doc_counter[w] for w in common_words)
            query_norm = math.sqrt(sum(v ** 2 for v in query_counter.values()))
            doc_norm = math.sqrt(sum(v ** 2 for v in doc_counter.values()))
            score = dot_product / (query_norm * doc_norm) if (query_norm * doc_norm) > 0 else 0.0

            for q_term in query_tokens:
                if q_term in file_item['path'].lower():
                    score += 0.25

            if score > 0.05:
                doc_scores.append((score, file_item))

        doc_scores.sort(key=lambda x: x[0], reverse=True)
        return [
            self._format_match(item, round(score, 3), "tfidf-fallback")
            for score, item in doc_scores[:top_k]
        ]

    def _format_match(self, item: dict, score: float, method: str) -> dict:
        return {
            "path": item["path"],
            "relevance_score": score,
            "retrieval_method": method,
            "language": item["language"],
            "lines": item["lines"],
            "exports": item["exports"],
            "routes": item["routes"],
            "snippet": item["snippet"][:500],
        }

    # ── Public API: hybrid search with RRF fusion ───────────────────
    def search_codebase(self, query: str, top_k: int = 6):
        """
        Performs hybrid (BM25 + dense embedding) search over the indexed
        codebase, fused via Reciprocal Rank Fusion. Returns top-K relevant
        files with matched snippets, relevance scores, and which retrieval
        method(s) surfaced each result.
        """
        indexed_files = codebase_indexer.indexed_files
        if not indexed_files:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return [self._format_match(f, 0.0, "none") for f in indexed_files[:top_k]]

        api_key = _get_api_key()

        bm25_ranked_idx = None
        try:
            if BM25Okapi is not None:
                bm25_ranked_idx = self._bm25_ranking(query_tokens, indexed_files)
        except Exception:
            bm25_ranked_idx = None

        dense_ranked_idx = None
        if api_key:
            try:
                embeddings = self._get_file_embeddings(indexed_files, api_key)
                query_vec = self._embed_batch([query[:6000]], api_key)[0]
                dense_scores = [
                    self._cosine(query_vec, embeddings.get(f['path']))
                    for f in indexed_files
                ]
                dense_ranked_idx = sorted(range(len(indexed_files)), key=lambda i: dense_scores[i], reverse=True)
            except Exception:
                dense_ranked_idx = None

        if bm25_ranked_idx is None and dense_ranked_idx is None:
            return self._tfidf_search(query, indexed_files, top_k)

        # Reciprocal Rank Fusion: score(doc) = sum over rankers of 1/(k + rank)
        rrf_scores = [0.0] * len(indexed_files)
        methods_used = []
        if bm25_ranked_idx is not None:
            for rank, idx in enumerate(bm25_ranked_idx):
                rrf_scores[idx] += 1.0 / (RRF_K + rank + 1)
            methods_used.append("bm25")
        if dense_ranked_idx is not None:
            for rank, idx in enumerate(dense_ranked_idx):
                rrf_scores[idx] += 1.0 / (RRF_K + rank + 1)
            methods_used.append("dense")

        method_label = "+".join(methods_used)
        ranked = sorted(range(len(indexed_files)), key=lambda i: rrf_scores[i], reverse=True)
        top_matches = [
            self._format_match(indexed_files[idx], round(rrf_scores[idx], 5), method_label)
            for idx in ranked[:top_k] if rrf_scores[idx] > 0
        ]
        return top_matches or self._tfidf_search(query, indexed_files, top_k)

    def get_codebase_context_str(self, query: str, top_k: int = 5) -> str:
        """Returns formatted string context ready for ingestion by CrewAI agents."""
        matches = self.search_codebase(query, top_k=top_k)
        if not matches:
            return "No specific codebase files matched query context."

        context_lines = ["--- RELEVANT CODEBASE FILES & CONTEXT (hybrid BM25+dense retrieval) ---"]
        for idx, match in enumerate(matches, 1):
            context_lines.append(
                f"\nFile #{idx}: `{match['path']}` (Lang: {match['language']}, Lines: {match['lines']}, "
                f"Score: {match['relevance_score']}, Method: {match['retrieval_method']})"
            )
            if match['exports']:
                context_lines.append(f"  Exports/Symbols: {', '.join(match['exports'])}")
            if match['routes']:
                routes_str = ", ".join([f"{r['method']} {r['endpoint']}" for r in match['routes']])
                context_lines.append(f"  API Endpoints: {routes_str}")
            context_lines.append(f"  Snippet Preview:\n```\n{match['snippet']}\n```")

        return "\n".join(context_lines)


rag_engine = RAGEngine()
