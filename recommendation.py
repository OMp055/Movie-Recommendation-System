import math
import re
from typing import List, Dict, Any

def tokenize(text: str) -> List[str]:
    """Simple Tokenizer and Stopwords remover"""
    if not text:
        return []
    words = re.findall(r'\b(\w+)\b', text.lower())
    stopwords = {'the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an', 'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were', 'be', 'has', 'have'}
    return [w for w in words if w not in stopwords and len(w) > 2]

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Calculate TF (Term Frequency)"""
    tf = {}
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1
    total = len(tokens)
    if total == 0: return {}
    for key in tf:
        tf[key] = tf[key] / total
    return tf

def compute_idf(documents: List[List[str]]) -> Dict[str, float]:
    """Calculate IDF (Inverse Document Frequency)"""
    idf = {}
    n_docs = len(documents)
    
    for doc in documents:
        unique_tokens = set(doc)
        for token in unique_tokens:
            idf[token] = idf.get(token, 0) + 1
            
    for key in idf:
        idf[key] = math.log(n_docs / idf[key])
        
    return idf

def compute_tfidf(tf: Dict[str, float], idf: Dict[str, float]) -> Dict[str, float]:
    """Compute TF-IDF vector for a document"""
    tfidf = {}
    for key in tf:
        tfidf[key] = tf[key] * idf.get(key, 0)
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
    """Extract features with weighted importance (Genres > Keywords > Overview > Title)"""
    tokens = []
    
    # Title & Overview (base weight)
    text = f"{m.get('title', '')} {m.get('overview', '')}"
    tokens.extend(tokenize(text))
    
    # Genres (High weight - repeat 4 times)
    genre_text = ""
    if 'genre_ids' in m:
        genre_text = ' '.join(map(str, m['genre_ids']))
    elif 'genres' in m:
        genre_text = ' '.join(g.get('name', '') for g in m['genres'])
    genre_tokens = tokenize(genre_text)
    for _ in range(4):
        tokens.extend(genre_tokens)
        
    # Keywords (Medium weight - repeat 3 times)
    if 'keywords' in m and 'keywords' in m['keywords']:
        kw_tokens = tokenize(' '.join(k.get('name', '') for k in m['keywords']['keywords']))
        for _ in range(3):
            tokens.extend(kw_tokens)
            
    # Cast (Medium weight - repeat 2 times)
    if 'credits' in m and 'cast' in m['credits']:
        cast_tokens = tokenize(' '.join(c.get('name', '') for c in m['credits']['cast'][:5]))
        for _ in range(2):
            tokens.extend(cast_tokens)
            
    return tokens

def get_quality_multiplier(movie: Dict[str, Any]) -> float:
    """Quality Score Multiplier (Boost highly rated and popular movies slightly)"""
    # Normalize rating (0-10) to a slight boost factor (0.9 to 1.1)
    rating_boost = 0.9 + (movie.get('vote_average', 5) / 10.0) * 0.2
    # Logarithmic popularity boost to prevent massive skew
    pop_boost = 1 + (math.log10(movie.get('popularity', 1) + 1) * 0.05)
    return rating_boost * pop_boost

def get_recommendations(target_movie: Dict[str, Any], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    """Main recommendation function"""
    target_doc = extract_features(target_movie)
    
    # Exclude target movie from corpus
    filtered_corpus = [m for m in corpus if m.get('id') != target_movie.get('id')]
    corpus_docs = [extract_features(m) for m in filtered_corpus]
    
    all_docs = [target_doc] + corpus_docs
    idf = compute_idf(all_docs)
    
    target_tf = compute_tf(target_doc)
    target_tfidf = compute_tfidf(target_tf, idf)
    
    similarities = []
    for i, movie in enumerate(filtered_corpus):
        doc_tf = compute_tf(corpus_docs[i])
        doc_tfidf = compute_tfidf(doc_tf, idf)
        score = cosine_similarity(target_tfidf, doc_tfidf)
        
        # Apply quality boost
        score *= get_quality_multiplier(movie)
        
        similarities.append({"movie": movie, "score": score})
        
    similarities.sort(key=lambda x: x["score"], reverse=True)
    return [item["movie"] for item in similarities[:top_n]]

def get_hybrid_recommendations(liked_movies: List[Dict[str, Any]], corpus: List[Dict[str, Any]], top_n: int = 10) -> List[Dict[str, Any]]:
    """Hybrid Recommendations (used for the user's Favorites)"""
    if not liked_movies:
        return []

    corpus_docs = [extract_features(m) for m in corpus]
    liked_docs = [extract_features(m) for m in liked_movies]
    
    # Compute global IDF once for all documents
    all_docs = liked_docs + corpus_docs
    idf = compute_idf(all_docs)
    
    # Precompute TF-IDF for all corpus movies
    corpus_tfidfs = [compute_tfidf(compute_tf(doc), idf) for doc in corpus_docs]
    
    aggregated_scores: Dict[int, Dict[str, Any]] = {}
    liked_movie_ids = {m.get('id') for m in liked_movies}
    
    # For each liked movie, compute similarity against the entire corpus
    for liked_index, liked_movie in enumerate(liked_movies):
        target_tfidf = compute_tfidf(compute_tf(liked_docs[liked_index]), idf)
        
        for corpus_index, movie in enumerate(corpus):
            movie_id = movie.get('id')
            if movie_id in liked_movie_ids:
                continue # Skip already liked
                
            score = cosine_similarity(target_tfidf, corpus_tfidfs[corpus_index])
            score *= get_quality_multiplier(movie) # Apply quality boost
            
            if movie_id in aggregated_scores:
                # Boost movies that are similar to MULTIPLE liked movies (synergy bonus)
                aggregated_scores[movie_id]['score'] += (score * 1.2)
            else:
                aggregated_scores[movie_id] = {"movie": movie, "score": score}

    # Sort and return top N
    results = list(aggregated_scores.values())
    results.sort(key=lambda x: x["score"], reverse=True)
    return [item["movie"] for item in results[:top_n]]
