import math
import re
from typing import List, Dict, Any, Set

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

def tokenize(text: str) -> List[str]:
    """Simple Tokenizer and Stopwords remover"""
    if not text:
        return []
    words = re.findall(r'\b(\w+)\b', text.lower())
    stopwords = {
        'the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an',
        'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were',
        'be', 'has', 'have', 'had', 'who', 'whom', 'which', 'about', 'into', 'after'
    }
    return [w for w in words if w not in stopwords and len(w) >= 2]

def get_movie_genre_ids(m: Dict[str, Any]) -> List[int]:
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

def get_movie_genre_names(m: Dict[str, Any]) -> List[str]:
    names: Set[str] = set()
    if 'genres' in m and isinstance(m['genres'], list):
        for g in m['genres']:
            if isinstance(g, dict) and 'name' in g:
                names.add(g['name'])
            elif isinstance(g, str):
                names.add(g)
    for gid in get_movie_genre_ids(m):
        if gid in GENRE_MAP:
            names.add(GENRE_MAP[gid])
    return list(names)

def compute_genre_jaccard(movie_a: Dict[str, Any], movie_b: Dict[str, Any]) -> float:
    set_a = set(get_movie_genre_ids(movie_a))
    set_b = set(get_movie_genre_ids(movie_b))
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a.intersection(set_b))
    union = len(set_a.union(set_b))
    return intersection / union if union > 0 else 0.0

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Calculate TF (Term Frequency)"""
    tf: Dict[str, float] = {}
    for token in tokens:
        tf[token] = tf.get(token, 0.0) + 1.0
    total = len(tokens)
    if total == 0:
        return {}
    for key in tf:
        tf[key] = tf[key] / total
    return tf

def compute_idf(documents: List[List[str]]) -> Dict[str, float]:
    """Calculate IDF (Inverse Document Frequency)"""
    idf: Dict[str, float] = {}
    n_docs = len(documents)
    
    for doc in documents:
        unique_tokens = set(doc)
        for token in unique_tokens:
            idf[token] = idf.get(token, 0.0) + 1.0
            
    for key in idf:
        idf[key] = math.log((n_docs + 1) / (idf[key] + 1)) + 1
        
    return idf

def compute_tfidf(tf: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
    """Compute TF-IDF vector for a document"""
    tfidf: Dict[str, float] = {}
    for key in tf:
        tfidf[key] = tf[key] * idf.get(key, 0.0)
    return tfidf

def cosine_similarity(vec_a: Dict[str, float], vec_b: Dict[str, float]) -> float:
    """Cosine Similarity between two vectors"""
    dot_product = 0.0
    norm_a = 0.0
    norm_b = 0.0
    
    all_keys = set(vec_a.keys()).union(set(vec_b.keys()))
    
    for key in all_keys:
        val_a = vec_a.get(key, 0.0)
        val_b = vec_b.get(key, 0.0)
        dot_product += val_a * val_b
        norm_a += val_a * val_a
        norm_b += val_b * val_b
        
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (math.sqrt(norm_a) * math.sqrt(norm_b))

def extract_features(m: Dict[str, Any]) -> List[str]:
    """Extract features with heavy weighting on genres, keywords, director & cast"""
    tokens = []
    
    # Title & Overview
    text = f"{m.get('title', '')} {m.get('overview', '')}"
    tokens.extend(tokenize(text))
    
    # Genres (Heavy weight - repeat 5 times to ensure genre dominance)
    genre_tokens = tokenize(' '.join(get_movie_genre_names(m)))
    for _ in range(5):
        tokens.extend(genre_tokens)
        
    # Keywords (Medium weight - repeat 3 times)
    if 'keywords' in m and isinstance(m['keywords'], dict) and 'keywords' in m['keywords']:
        kw_tokens = tokenize(' '.join(k.get('name', '') for k in m['keywords']['keywords']))
        for _ in range(3):
            tokens.extend(kw_tokens)
            
    # Director (Repeat 3 times)
    if 'credits' in m and isinstance(m['credits'], dict) and 'crew' in m['credits']:
        for person in m['credits']['crew']:
            if person.get('job') == 'Director':
                dir_tokens = tokenize(person.get('name', ''))
                for _ in range(3):
                    tokens.extend(dir_tokens)
            
    # Cast (Repeat 2 times)
    if 'credits' in m and isinstance(m['credits'], dict) and 'cast' in m['credits']:
        cast_tokens = tokenize(' '.join(c.get('name', '') for c in m['credits']['cast'][:5]))
        for _ in range(2):
            tokens.extend(cast_tokens)
            
    return tokens

def get_recommendations(target_movie: Dict[str, Any], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    """Main recommendation function combining TF-IDF and direct Genre similarity"""
    filtered_corpus = [
        m for m in corpus 
        if m.get('id') != target_movie.get('id') and m.get('poster_path')
    ]
    if not filtered_corpus:
        return []

    target_doc = extract_features(target_movie)
    corpus_docs = [extract_features(m) for m in filtered_corpus]
    
    all_docs = [target_doc] + corpus_docs
    idf = compute_idf(all_docs)
    
    target_tf = compute_tf(target_doc)
    target_tfidf = compute_tfidf(target_tf, idf)
    
    similarities = []
    for i, movie in enumerate(filtered_corpus):
        doc_tf = compute_tf(corpus_docs[i])
        doc_tfidf = compute_tfidf(doc_tf, idf)
        tfidf_score = cosine_similarity(target_tfidf, doc_tfidf)
        genre_jaccard = compute_genre_jaccard(target_movie, movie)
        
        # Language bonus for non-English matching films
        lang_bonus = 0.15 if (
            target_movie.get('original_language') and 
            target_movie.get('original_language') != 'en' and 
            target_movie.get('original_language') == movie.get('original_language')
        ) else 0.0

        # Small rating bonus
        vote_bonus = 0.05 if (movie.get('vote_average') or 0) >= 7.0 else 0.0

        score = (tfidf_score * 0.45) + (genre_jaccard * 0.45) + lang_bonus + vote_bonus
        
        if genre_jaccard > 0 or score > 0.1:
            similarities.append({"movie": movie, "score": score})
        
    similarities.sort(key=lambda x: x["score"], reverse=True)
    return [item["movie"] for item in similarities[:top_n]]

def get_hybrid_recommendations(liked_movies: List[Dict[str, Any]], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    """Hybrid Recommendations (used for the user's Favorites)"""
    if not liked_movies or not corpus:
        return []

    liked_movie_ids = {m.get('id') for m in liked_movies}
    candidate_corpus = [
        m for m in corpus 
        if m.get('id') not in liked_movie_ids and m.get('poster_path')
    ]
    if not candidate_corpus:
        return []

    corpus_docs = [extract_features(m) for m in candidate_corpus]
    liked_docs = [extract_features(m) for m in liked_movies]
    
    all_docs = liked_docs + corpus_docs
    idf = compute_idf(all_docs)
    
    corpus_tfidfs = [compute_tfidf(compute_tf(doc), idf) for doc in corpus_docs]
    liked_tfidfs = [compute_tfidf(compute_tf(doc), idf) for doc in liked_docs]
    
    scored_candidates = []
    
    for c_idx, candidate in enumerate(candidate_corpus):
        cand_tfidf = corpus_tfidfs[c_idx]
        best_score = 0.0
        match_count = 0
        
        for l_idx, liked in enumerate(liked_movies):
            liked_tfidf = liked_tfidfs[l_idx]
            tfidf_sim = cosine_similarity(liked_tfidf, cand_tfidf)
            genre_jaccard = compute_genre_jaccard(liked, candidate)
            
            lang_bonus = 0.15 if (
                liked.get('original_language') and 
                liked.get('original_language') != 'en' and 
                liked.get('original_language') == candidate.get('original_language')
            ) else 0.0
            
            sim = (tfidf_sim * 0.45) + (genre_jaccard * 0.45) + lang_bonus
            if sim > best_score:
                best_score = sim
            if sim > 0.25:
                match_count += 1
                
        # Synergy bonus if similar to multiple liked movies
        final_score = best_score + ((match_count - 1) * 0.08 if match_count > 1 else 0.0)
        if final_score > 0.12:
            scored_candidates.append({"movie": candidate, "score": final_score})

    scored_candidates.sort(key=lambda x: x["score"], reverse=True)
    return [item["movie"] for item in scored_candidates[:top_n]]
