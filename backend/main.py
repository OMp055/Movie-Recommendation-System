import os
import re
import math
import httpx
import asyncio
from typing import List, Dict, Any, Optional, Set
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

# -----------------------------------------------------------------------------
# Recommendation Engine Core (TF-IDF & Cosine Similarity)
# -----------------------------------------------------------------------------
class RecommendationEngine:
    def __init__(self):
        self.stopwords = {'the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an', 'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were', 'be', 'has', 'have'}

    def tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        words = re.findall(r'\b\w+\b', text.lower())
        return [w for w in words if w not in self.stopwords and len(w) > 2]

    def compute_tf(self, tokens: List[str]) -> Dict[str, float]:
        tf = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1
        total = len(tokens)
        if total == 0: return {}
        return {k: v / total for k, v in tf.items()}

    def compute_idf(self, documents: List[List[str]]) -> Dict[str, float]:
        idf = {}
        n_docs = len(documents)
        for doc in documents:
            for token in set(doc):
                idf[token] = idf.get(token, 0) + 1
        return {k: math.log(n_docs / v) for k, v in idf.items()}

    def compute_tfidf(self, tf: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
        return {k: v * idf.get(k, 0) for k, v in tf.items()}

    def cosine_similarity(self, vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
        dot_product = sum(vec_a.get(k, 0) * vec_b.get(k, 0) for k in set(vec_a) | set(vec_b))
        norm_a = sum(v * v for v in vec_a.values())
        norm_b = sum(v * v for v in vec_b.values())
        if norm_a == 0 or norm_b == 0: return 0.0
        return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))

    def extract_features(self, movie: Dict[str, Any]) -> List[str]:
        tokens = []
        # Title and Overview
        text = f"{movie.get('title', '')} {movie.get('overview', '')}"
        tokens.extend(self.tokenize(text))
        
        # Genres (Weight 4x)
        genres = movie.get('genre_ids', [])
        if not genres and 'genres' in movie:
            genres = [g.get('name', '') for g in movie['genres']]
        genre_tokens = self.tokenize(' '.join(map(str, genres)))
        tokens.extend(genre_tokens * 4)
            
        # Keywords (Weight 3x)
        if 'keywords' in movie and 'keywords' in movie['keywords']:
            kw_tokens = self.tokenize(' '.join(k.get('name', '') for k in movie['keywords']['keywords']))
            tokens.extend(kw_tokens * 3)
                
        # Cast (Weight 2x)
        if 'credits' in movie and 'cast' in movie['credits']:
            cast_tokens = self.tokenize(' '.join(c.get('name', '') for c in movie['credits']['cast'][:5]))
            tokens.extend(cast_tokens * 2)
                
        return tokens

    def get_quality_multiplier(self, movie: Dict[str, Any]) -> float:
        rating_boost = 0.9 + (movie.get('vote_average', 5) / 10.0) * 0.2
        pop_boost = 1 + (math.log10(movie.get('popularity', 1) + 1) * 0.05)
        return rating_boost * pop_boost

    def get_recommendations(self, target_movie: Dict[str, Any], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
        target_doc = self.extract_features(target_movie)
        filtered_corpus = [m for m in corpus if m.get('id') != target_movie.get('id')]
        corpus_docs = [self.extract_features(m) for m in filtered_corpus]
        
        idf = self.compute_idf([target_doc] + corpus_docs)
        target_tfidf = self.compute_tfidf(self.compute_tf(target_doc), idf)
        
        similarities = []
        for i, movie in enumerate(filtered_corpus):
            doc_tfidf = self.compute_tfidf(self.compute_tf(corpus_docs[i]), idf)
            score = self.cosine_similarity(target_tfidf, doc_tfidf) * self.get_quality_multiplier(movie)
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
        response = await client.get(url, params=query)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="TMDB Error")
        return response.json()

@app.get("/api/trending")
async def get_trending():
    data = await fetch_tmdb("/trending/movie/day")
    return data.get("results", [])

@app.get("/api/search")
async def search_movies(q: str = Query(..., min_length=1)):
    # 1. Standard search
    data = await fetch_tmdb("/search/movie", {"query": q})
    results = data.get("results", [])
    
    # 2. Spelling mistake fallback (if no results)
    if not results:
        variations = set()
        # Remove double letters
        variations.add(re.sub(r'([a-zA-Z])\1+', r'\1', q))
        # Double consonants
        consonants = 'bcdfghjklmnpqrstvwxyz'
        for i, char in enumerate(q.lower()):
            if char in consonants:
                variations.add(q[:i] + char + q[i:])
        
        if q in variations: variations.remove(q)
        
        async def fetch_variation(var: str):
            res = await fetch_tmdb("/search/movie", {"query": var})
            return res.get("results", [])
            
        variation_tasks = [fetch_variation(v) for v in list(variations)[:4]]
        variation_results = await asyncio.gather(*variation_tasks, return_exceptions=True)
        
        # Combine and deduplicate
        combined = []
        for v_res in variation_results:
            if isinstance(v_res, list):
                combined.extend(v_res)
                
        unique_results = {m["id"]: m for m in combined}.values()
        results = list(unique_results)
        
    return results

@app.get("/api/recommendations/{movie_id}")
async def get_movie_recommendations(movie_id: int):
    # Fetch movie details
    target_movie = await fetch_tmdb(f"/movie/{movie_id}", {"append_to_response": "credits,keywords"})
    
    # Fetch a recommendation corpus (Popular + Top Rated)
    async def fetch_corpus_page(endpoint: str, page: int):
        res = await fetch_tmdb(endpoint, {"page": page})
        return res.get("results", [])
        
    tasks = [
        fetch_corpus_page("/movie/popular", 1),
        fetch_corpus_page("/movie/popular", 2),
        fetch_corpus_page("/movie/top_rated", 1),
        fetch_corpus_page("/movie/top_rated", 2),
    ]
    
    pages = await asyncio.gather(*tasks)
    corpus = []
    for page in pages: corpus.extend(page)
    
    # Deduplicate corpus
    unique_corpus = list({m["id"]: m for m in corpus}.values())
    
    # Calculate Recommendations using Python TF-IDF engine!
    recommendations = engine.get_recommendations(target_movie, unique_corpus, top_n=12)
    return recommendations

if __name__ == "__main__":
    import uvicorn
    # Run the API server on port 8000
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
