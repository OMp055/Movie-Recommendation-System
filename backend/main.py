import os
import re
import math
import httpx
import asyncio
from typing import List, Dict, Any, Optional, Set
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables (assumes .env is in the root directory)
load_dotenv(dotenv_path="../.env")

API_KEY = os.getenv("VITE_TMDB_API_KEY")
BASE_URL = "https://api.tmdb.org/3"

app = FastAPI(title="Movie Recommendation Engine API")

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GENRE_MAP: Dict[int, str] = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Science Fiction',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
}

# -----------------------------------------------------------------------------
# Recommendation Engine Core (TF-IDF & Cosine Similarity)
# -----------------------------------------------------------------------------
class RecommendationEngine:
    def __init__(self):
        self.stopwords = {
            'the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an',
            'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were',
            'be', 'has', 'have', 'had', 'who', 'whom', 'which', 'about', 'into', 'after'
        }

    def tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        words = re.findall(r'\b\w+\b', text.lower())
        return [w for w in words if w not in self.stopwords and len(w) >= 2]

    def get_genre_ids(self, m: Dict[str, Any]) -> List[int]:
        ids: Set[int] = set()
        if 'genre_ids' in m and isinstance(m['genre_ids'], list):
            ids.update([gid for gid in m['genre_ids'] if isinstance(gid, int)])
        if 'genres' in m and isinstance(m['genres'], list):
            for g in m['genres']:
                if isinstance(g, dict) and 'id' in g:
                    ids.add(g['id'])
                elif isinstance(g, int):
                    ids.add(g)
        return list(ids)

    def get_genre_names(self, m: Dict[str, Any]) -> List[str]:
        names: Set[str] = set()
        if 'genres' in m and isinstance(m['genres'], list):
            for g in m['genres']:
                if isinstance(g, dict) and 'name' in g:
                    names.add(g['name'])
                elif isinstance(g, str):
                    names.add(g)
        for gid in self.get_genre_ids(m):
            if gid in GENRE_MAP:
                names.add(GENRE_MAP[gid])
        return list(names)

    def compute_genre_jaccard(self, movie_a: Dict[str, Any], movie_b: Dict[str, Any]) -> float:
        set_a = set(self.get_genre_ids(movie_a))
        set_b = set(self.get_genre_ids(movie_b))
        if not set_a or not set_b:
            return 0.0
        intersection = len(set_a.intersection(set_b))
        union = len(set_a.union(set_b))
        return intersection / union if union > 0 else 0.0

    def compute_tf(self, tokens: List[str]) -> Dict[str, float]:
        tf = {}
        for token in tokens:
            tf[token] = tf.get(token, 0.0) + 1.0
        total = len(tokens)
        if total == 0: return {}
        return {k: v / total for k, v in tf.items()}

    def compute_idf(self, documents: List[List[str]]) -> Dict[str, float]:
        idf = {}
        n_docs = len(documents)
        for doc in documents:
            for token in set(doc):
                idf[token] = idf.get(token, 0.0) + 1.0
        return {k: math.log((n_docs + 1) / (v + 1)) + 1 for k, v in idf.items()}

    def compute_tfidf(self, tf: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
        return {k: v * idf.get(k, 0.0) for k, v in tf.items()}

    def cosine_similarity(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        dot_product = sum(vec_a.get(k, 0.0) * vec_b.get(k, 0.0) for k in set(vec_a) | set(vec_b))
        norm_a = sum(v * v for v in vec_a.values())
        norm_b = sum(v * v for v in vec_b.values())
        if norm_a == 0 or norm_b == 0: return 0.0
        return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))

    def extract_features(self, movie: Dict[str, Any]) -> List[str]:
        tokens = []
        # Title and Overview
        text = f"{movie.get('title', '')} {movie.get('overview', '')}"
        tokens.extend(self.tokenize(text))
        
        # Genres (Weight 5x)
        genre_tokens = self.tokenize(' '.join(self.get_genre_names(movie)))
        tokens.extend(genre_tokens * 5)
            
        # Keywords (Weight 3x)
        if 'keywords' in movie and isinstance(movie['keywords'], dict) and 'keywords' in movie['keywords']:
            kw_tokens = self.tokenize(' '.join(k.get('name', '') for k in movie['keywords']['keywords']))
            tokens.extend(kw_tokens * 3)
                
        # Cast (Weight 2x)
        if 'credits' in movie and isinstance(movie['credits'], dict) and 'cast' in movie['credits']:
            cast_tokens = self.tokenize(' '.join(c.get('name', '') for c in movie['credits']['cast'][:5]))
            tokens.extend(cast_tokens * 2)
                
        return tokens

    def get_recommendations(self, target_movie: Dict[str, Any], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
        target_doc = self.extract_features(target_movie)
        filtered_corpus = [
            m for m in corpus 
            if m.get('id') != target_movie.get('id') and m.get('poster_path')
        ]
        if not filtered_corpus:
            return []

        corpus_docs = [self.extract_features(m) for m in filtered_corpus]
        
        idf = self.compute_idf([target_doc] + corpus_docs)
        target_tfidf = self.compute_tfidf(self.compute_tf(target_doc), idf)
        
        similarities = []
        for i, movie in enumerate(filtered_corpus):
            doc_tfidf = self.compute_tfidf(self.compute_tf(corpus_docs[i]), idf)
            tfidf_sim = self.cosine_similarity(target_tfidf, doc_tfidf)
            genre_jaccard = self.compute_genre_jaccard(target_movie, movie)
            
            lang_bonus = 0.15 if (
                target_movie.get('original_language') and 
                target_movie.get('original_language') != 'en' and 
                target_movie.get('original_language') == movie.get('original_language')
            ) else 0.0

            score = (tfidf_sim * 0.45) + (genre_jaccard * 0.45) + lang_bonus
            if genre_jaccard > 0 or score > 0.1:
                similarities.append({"movie": movie, "score": score})
            
        similarities.sort(key=lambda x: x["score"], reverse=True)
        return [item["movie"] for item in similarities[:top_n]]

engine = RecommendationEngine()

# -----------------------------------------------------------------------------
# TMDB API Wrappers
# -----------------------------------------------------------------------------
async def fetch_tmdb(endpoint: str, params: dict = None):
    if not API_KEY:
        raise HTTPException(status_code=500, detail="TMDB API Key is missing.")
    
    url = f"{BASE_URL}{endpoint}"
    query = {"api_key": API_KEY}
    if params: query.update(params)
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=query, timeout=10.0)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="TMDB Error")
        return response.json()

@app.get("/api/trending")
async def get_trending():
    data = await fetch_tmdb("/trending/movie/day")
    return data.get("results", [])

@app.get("/api/search")
async def search_movies(q: str = Query(..., min_length=1)):
    data = await fetch_tmdb("/search/movie", {"query": q})
    results = data.get("results", [])
    
    if not results:
        variations = set()
        variations.add(re.sub(r'([a-zA-Z])\1+', r'\1', q))
        consonants = 'bcdfghjklmnpqrstvwxyz'
        for i, char in enumerate(q.lower()):
            if char in consonants:
                variations.add(q[:i] + char + q[i:])
        
        if q in variations: variations.remove(q)
        
        async def fetch_variation(var: str):
            try:
                res = await fetch_tmdb("/search/movie", {"query": var})
                return res.get("results", [])
            except Exception:
                return []
            
        variation_tasks = [fetch_variation(v) for v in list(variations)[:4]]
        variation_results = await asyncio.gather(*variation_tasks, return_exceptions=True)
        
        combined = []
        for v_res in variation_results:
            if isinstance(v_res, list):
                combined.extend(v_res)
                
        unique_results = {m["id"]: m for m in combined}.values()
        results = list(unique_results)
        
    return results

@app.get("/api/recommendations/{movie_id}")
async def get_movie_recommendations(movie_id: int):
    target_movie = await fetch_tmdb(f"/movie/{movie_id}", {"append_to_response": "credits,keywords"})
    
    # Gather targeted candidates
    async def safe_fetch(endpoint: str, params: dict = None):
        try:
            res = await fetch_tmdb(endpoint, params)
            return res.get("results", [])
        except Exception:
            return []

    genre_ids = [g["id"] for g in target_movie.get("genres", []) if "id" in g]
    discover_params = {
        "with_genres": ",".join(map(str, genre_ids[:2])) if genre_ids else "",
        "sort_by": "popularity.desc",
        "vote_count.gte": 30
    }

    tasks = [
        safe_fetch(f"/movie/{movie_id}/recommendations"),
        safe_fetch(f"/movie/{movie_id}/similar"),
        safe_fetch("/discover/movie", discover_params) if genre_ids else asyncio.sleep(0),
        safe_fetch("/movie/popular", {"page": 1}),
        safe_fetch("/movie/top_rated", {"page": 1}),
    ]
    
    results = await asyncio.gather(*tasks)
    corpus = []
    for r in results:
        if isinstance(r, list):
            corpus.extend(r)
    
    unique_corpus = list({m["id"]: m for m in corpus if m.get("id") and m.get("poster_path")}.values())
    recommendations = engine.get_recommendations(target_movie, unique_corpus, top_n=12)
    return recommendations

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
