import type { Movie, MovieDetails } from '../types';

// Simple Tokenizer and Stopwords remover
const tokenize = (text: string): string[] => {
  if (!text) return [];
  const words = text.toLowerCase().match(/\b(\w+)\b/g) || [];
  const stopwords = new Set(['the', 'is', 'in', 'and', 'to', 'a', 'of', 'for', 'with', 'on', 'as', 'an', 'by', 'at', 'this', 'that', 'from', 'it', 'his', 'her', 'are', 'was', 'were', 'be', 'has', 'have']);
  return words.filter(w => !stopwords.has(w) && w.length > 2);
};

// Calculate TF (Term Frequency)
const computeTF = (tokens: string[]): Record<string, number> => {
  const tf: Record<string, number> = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });
  const total = tokens.length;
  for (const key in tf) {
    tf[key] = tf[key] / total;
  }
  return tf;
};

// Calculate IDF (Inverse Document Frequency)
const computeIDF = (documents: string[][]): Record<string, number> => {
  const idf: Record<string, number> = {};
  const N = documents.length;
  
  documents.forEach(doc => {
    const uniqueTokens = new Set(doc);
    uniqueTokens.forEach(token => {
      idf[token] = (idf[token] || 0) + 1;
    });
  });
  
  for (const key in idf) {
    idf[key] = Math.log(N / idf[key]);
  }
  
  return idf;
};

// Compute TF-IDF vector for a document
const computeTFIDF = (tf: Record<string, number>, idf: Record<string, number>): Record<string, number> => {
  const tfidf: Record<string, number> = {};
  for (const key in tf) {
    tfidf[key] = tf[key] * (idf[key] || 0);
  }
  return tfidf;
};

// Cosine Similarity between two vectors
const cosineSimilarity = (vecA: Record<string, number>, vecB: Record<string, number>): number => {
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

// Extract features with weighted importance (Genres > Keywords > Overview > Title)
const extractFeatures = (m: any): string[] => {
  let tokens: string[] = [];
  
  // Title & Overview (base weight)
  tokens.push(...tokenize(`${m.title} ${m.overview}`));
  
  // Genres (High weight - repeat 4 times)
  let genreText = "";
  if (m.genre_ids) {
    genreText = m.genre_ids.join(' ');
  } else if (m.genres) {
    genreText = m.genres.map((g: any) => g.name).join(' ');
  }
  const genreTokens = tokenize(genreText);
  for (let i = 0; i < 4; i++) tokens.push(...genreTokens);
  
  // Keywords (Medium weight - repeat 3 times)
  if (m.keywords?.keywords) {
    const kwTokens = tokenize(m.keywords.keywords.map((k: any) => k.name).join(' '));
    for (let i = 0; i < 3; i++) tokens.push(...kwTokens);
  }
  
  // Cast (Medium weight - repeat 2 times)
  if (m.credits?.cast) {
    const castTokens = tokenize(m.credits.cast.slice(0, 5).map((c: any) => c.name).join(' '));
    for (let i = 0; i < 2; i++) tokens.push(...castTokens);
  }
  
  return tokens;
};

// Quality Score Multiplier (Boost highly rated and popular movies slightly)
const getQualityMultiplier = (movie: Movie): number => {
  // Normalize rating (0-10) to a slight boost factor (0.9 to 1.1)
  const ratingBoost = 0.9 + ((movie.vote_average || 5) / 10) * 0.2;
  // Logarithmic popularity boost to prevent massive skew
  const popBoost = 1 + (Math.log10((movie.popularity || 1) + 1) * 0.05);
  return ratingBoost * popBoost;
};

// Main recommendation function
export const getRecommendations = (
  targetMovie: Movie | MovieDetails,
  corpus: Movie[],
  topN: number = 10
): Movie[] => {
  const targetDoc = extractFeatures(targetMovie);
  
  // Exclude target movie from corpus
  const filteredCorpus = corpus.filter(m => m.id !== targetMovie.id);
  const corpusDocs = filteredCorpus.map(extractFeatures);
  
  const allDocs = [targetDoc, ...corpusDocs];
  const idf = computeIDF(allDocs);
  
  const targetTF = computeTF(targetDoc);
  const targetTFIDF = computeTFIDF(targetTF, idf);
  
  const similarities = filteredCorpus.map((movie, index) => {
    const docTF = computeTF(corpusDocs[index]);
    const docTFIDF = computeTFIDF(docTF, idf);
    let score = cosineSimilarity(targetTFIDF, docTFIDF);
    
    // Apply quality boost
    score *= getQualityMultiplier(movie);
    
    return { movie, score };
  });
  
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);
};

export const getHybridRecommendations = (
  likedMovies: Movie[],
  corpus: Movie[],
  topN: number = 10
): Movie[] => {
  if (likedMovies.length === 0) return [];

  const corpusDocs = corpus.map(extractFeatures);
  const likedDocs = likedMovies.map(extractFeatures);
  
  // Compute global IDF once for all documents
  const allDocs = [...likedDocs, ...corpusDocs];
  const idf = computeIDF(allDocs);
  
  // Precompute TF-IDF for all corpus movies
  const corpusTFIDFs = corpusDocs.map(doc => computeTFIDF(computeTF(doc), idf));
  
  const aggregatedScores: Record<number, { movie: Movie, score: number }> = {};
  
  // For each liked movie, compute similarity against the entire corpus
  likedMovies.forEach((_likedMovie, likedIndex) => {
    const targetTFIDF = computeTFIDF(computeTF(likedDocs[likedIndex]), idf);
    
    corpus.forEach((movie, corpusIndex) => {
      if (likedMovies.some(lm => lm.id === movie.id)) return; // Skip already liked
      
      let score = cosineSimilarity(targetTFIDF, corpusTFIDFs[corpusIndex]);
      score *= getQualityMultiplier(movie); // Apply quality boost
      
      if (aggregatedScores[movie.id]) {
        // Boost movies that are similar to MULTIPLE liked movies (synergy bonus)
        aggregatedScores[movie.id].score += (score * 1.2);
      } else {
        aggregatedScores[movie.id] = { movie, score };
      }
    });
  });

  return Object.values(aggregatedScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(item => item.movie);
};
