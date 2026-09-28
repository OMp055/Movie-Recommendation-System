import type { Movie, MovieDetails } from '../types';

export const GENRE_MAP: Record<number, string> = {
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
};

// Tokenizer and Stopwords remover
export const tokenize = (text: string): string[] => {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  const stopwords = new Set([
    'the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an',
    'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were',
    'be', 'has', 'have', 'had', 'who', 'whom', 'which', 'about', 'into', 'after',
  ]);
  return words.filter(w => !stopwords.has(w) && w.length >= 2);
};

export const getMovieGenreIds = (m: any): number[] => {
  const ids: number[] = [];
  if (Array.isArray(m.genre_ids)) {
    ids.push(...m.genre_ids);
  }
  if (Array.isArray(m.genres)) {
    m.genres.forEach((g: any) => {
      const gid = typeof g === 'object' && g ? g.id : g;
      if (typeof gid === 'number') ids.push(gid);
    });
  }
  return Array.from(new Set(ids));
};

export const getMovieGenreNames = (m: any): string[] => {
  const names: string[] = [];
  if (Array.isArray(m.genres)) {
    m.genres.forEach((g: any) => {
      const name = typeof g === 'string' ? g : g?.name;
      if (name) names.push(name);
    });
  }
  getMovieGenreIds(m).forEach(id => {
    if (GENRE_MAP[id]) names.push(GENRE_MAP[id]);
  });
  return Array.from(new Set(names));
};

// Genre Jaccard Similarity: Ratio of shared genres to total unique genres
export const computeGenreJaccard = (movieA: any, movieB: any): number => {
  const setA = new Set(getMovieGenreIds(movieA));
  const setB = new Set(getMovieGenreIds(movieB));
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersection = 0;
  setA.forEach(id => {
    if (setB.has(id)) intersection++;
  });
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
};

// Calculate TF (Term Frequency)
export const computeTF = (tokens: string[]): Record<string, number> => {
  const tf: Record<string, number> = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  const total = tokens.length || 1;
  for (const key in tf) {
    tf[key] = tf[key] / total;
  }
  return tf;
};

// Calculate IDF (Inverse Document Frequency)
export const computeIDF = (documents: string[][]): Record<string, number> => {
  const idf: Record<string, number> = {};
  const N = documents.length;
  
  documents.forEach(doc => {
    const uniqueTokens = new Set(doc);
    uniqueTokens.forEach(token => {
      idf[token] = (idf[token] || 0) + 1;
    });
  });
  
  for (const key in idf) {
    idf[key] = Math.log((N + 1) / (idf[key] + 1)) + 1;
  }
  
  return idf;
};

// Compute TF-IDF vector for a document
export const computeTFIDF = (tf: Record<string, number>, idf: Record<string, number>): Record<string, number> => {
  const tfidf: Record<string, number> = {};
  for (const key in tf) {
    tfidf[key] = tf[key] * (idf[key] || 0);
  }
  return tfidf;
};

// Cosine Similarity between two vectors
export const cosineSimilarity = (vecA: Record<string, number>, vecB: Record<string, number>): number => {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  
  allKeys.forEach(key => {
    const valA = vecA[key] || 0;
    const valB = vecB[key] || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  });
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Extract features with high weighting on genres, keywords, director & cast
export const extractFeatures = (m: any): string[] => {
  const tokens: string[] = [];
  
  // Title & Overview
  tokens.push(...tokenize(`${m.title || ''} ${m.overview || ''}`));
  
  // Genres (Heavy weight - repeat 5 times to ensure genre dominance)
  const genreTokens = tokenize(getMovieGenreNames(m).join(' '));
  for (let i = 0; i < 5; i++) {
    tokens.push(...genreTokens);
  }
  
  // Keywords (Weight 3 times)
  if (m.keywords?.keywords) {
    const kwTokens = tokenize(m.keywords.keywords.map((k: any) => k.name).join(' '));
    for (let i = 0; i < 3; i++) tokens.push(...kwTokens);
  }
  
  // Director (Weight 3 times)
  if (m.credits?.crew) {
    const director = m.credits.crew.find((c: any) => c.job === 'Director');
    if (director) {
      const dirTokens = tokenize(director.name);
      for (let i = 0; i < 3; i++) tokens.push(...dirTokens);
    }
  }
  
  // Cast (Weight 2 times)
  if (m.credits?.cast) {
    const castTokens = tokenize(m.credits.cast.slice(0, 5).map((c: any) => c.name).join(' '));
    for (let i = 0; i < 2; i++) tokens.push(...castTokens);
  }
  
  return tokens;
};

// Main recommendation function (for a single target movie)
export const getRecommendations = (
  targetMovie: Movie | MovieDetails,
  corpus: Movie[],
  topN: number = 10
): Movie[] => {
  const filteredCorpus = corpus.filter(
    m => m.id !== targetMovie.id && m.poster_path && (m.vote_count >= 10 || m.popularity >= 5)
  );

  if (filteredCorpus.length === 0) return [];

  const targetDoc = extractFeatures(targetMovie);
  const corpusDocs = filteredCorpus.map(extractFeatures);
  
  const allDocs = [targetDoc, ...corpusDocs];
  const idf = computeIDF(allDocs);
  
  const targetTF = computeTF(targetDoc);
  const targetTFIDF = computeTFIDF(targetTF, idf);
  
  const similarities = filteredCorpus.map((movie, index) => {
    const docTF = computeTF(corpusDocs[index]);
    const docTFIDF = computeTFIDF(docTF, idf);
    const tfidfScore = cosineSimilarity(targetTFIDF, docTFIDF);
    const genreJaccard = computeGenreJaccard(targetMovie, movie);

    // Language bonus for non-English matches
    const langBonus = (targetMovie.original_language && 
      targetMovie.original_language !== 'en' && 
      targetMovie.original_language === movie.original_language) ? 0.15 : 0;

    // Small bonus for well-rated movies
    const voteBonus = (movie.vote_average && movie.vote_average >= 7.0) ? 0.05 : 0;

    // Balanced score: TF-IDF overview/keywords (45%) + direct genre match (45%) + bonuses
    const score = (tfidfScore * 0.45) + (genreJaccard * 0.45) + langBonus + voteBonus;
    
    return { movie, score, genreJaccard };
  });
  
  return similarities
    // Only keep movies that have at least some genre or keyword similarity
    .filter(item => item.genreJaccard > 0 || item.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);
};

// Hybrid Recommendations (based on a user's liked movies / favorites)
export const getHybridRecommendations = (
  likedMovies: Movie[],
  corpus: Movie[],
  topN: number = 10
): Movie[] => {
  if (likedMovies.length === 0 || corpus.length === 0) return [];

  const likedMovieIds = new Set(likedMovies.map(m => m.id));
  const candidateCorpus = corpus.filter(
    m => !likedMovieIds.has(m.id) && m.poster_path && (m.vote_count >= 10 || m.popularity >= 5)
  );

  if (candidateCorpus.length === 0) return [];

  const likedDocs = likedMovies.map(extractFeatures);
  const corpusDocs = candidateCorpus.map(extractFeatures);
  
  const allDocs = [...likedDocs, ...corpusDocs];
  const idf = computeIDF(allDocs);
  
  const likedTFIDFs = likedDocs.map(doc => computeTFIDF(computeTF(doc), idf));
  const corpusTFIDFs = corpusDocs.map(doc => computeTFIDF(computeTF(doc), idf));
  
  const scoredCandidates = candidateCorpus.map((candidate, cIdx) => {
    let bestScore = 0;
    let matchCount = 0;
    const candTFIDF = corpusTFIDFs[cIdx];

    likedMovies.forEach((likedMovie, lIdx) => {
      const likedTFIDF = likedTFIDFs[lIdx];
      const tfidfScore = cosineSimilarity(likedTFIDF, candTFIDF);
      const genreJaccard = computeGenreJaccard(likedMovie, candidate);
      
      const langBonus = (likedMovie.original_language && 
        likedMovie.original_language !== 'en' && 
        likedMovie.original_language === candidate.original_language) ? 0.15 : 0;

      const sim = (tfidfScore * 0.45) + (genreJaccard * 0.45) + langBonus;
      
      if (sim > bestScore) {
        bestScore = sim;
      }
      if (sim > 0.25) {
        matchCount++;
      }
    });

    // Synergy bonus if the candidate is similar to multiple movies the user liked
    const finalScore = bestScore + (matchCount > 1 ? (matchCount - 1) * 0.08 : 0);
    return { movie: candidate, score: finalScore };
  });

  return scoredCandidates
    .filter(item => item.score > 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);
};
