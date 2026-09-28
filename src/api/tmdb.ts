import axios from 'axios';
import type { Movie, MovieDetails, Genre } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const BASE_URL = 'https://api.tmdb.org/3';

const tmdb = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
  },
});

export const getTrendingMovies = async (): Promise<Movie[]> => {
  const response = await tmdb.get('/trending/movie/day');
  return response.data.results;
};

export const getPopularMovies = async (): Promise<Movie[]> => {
  const response = await tmdb.get('/movie/popular');
  return response.data.results;
};

export const getTopRatedMovies = async (): Promise<Movie[]> => {
  const response = await tmdb.get('/movie/top_rated');
  return response.data.results;
};

export const getUpcomingMovies = async (): Promise<Movie[]> => {
  const response = await tmdb.get('/movie/upcoming');
  return response.data.results;
};

export const getMovieDetails = async (id: string | number): Promise<MovieDetails> => {
  const response = await tmdb.get(`/movie/${id}`, {
    params: {
      append_to_response: 'credits,videos,keywords',
    },
  });
  return response.data;
};

export const searchMovies = async (query: string): Promise<Movie[]> => {
  const fetchQuery = async (q: string) => {
    const response = await tmdb.get('/search/movie', {
      params: { query: q },
    });
    return response.data.results;
  };

  let results = await fetchQuery(query);

  // Fallback for spelling mistakes (e.g., "tumbad" -> "tumbbad")
  if (results.length === 0) {
    const variations = new Set<string>();
    
    // 1. Try removing double letters
    variations.add(query.replace(/([a-zA-Z])\1+/g, '$1'));
    
    // 2. Try doubling consonants
    const consonants = 'bcdfghjklmnpqrstvwxyz';
    for (let i = 0; i < query.length; i++) {
      const char = query[i].toLowerCase();
      if (consonants.includes(char)) {
        variations.add(query.slice(0, i) + char + query.slice(i));
      }
    }
    variations.delete(query);

    // Fetch up to 4 variations to avoid hitting rate limits
    const variationPromises = Array.from(variations).slice(0, 4).map(v => fetchQuery(v));
    const variationResults = await Promise.all(variationPromises);
    
    const combined = variationResults.flat();
    // Deduplicate the combined results
    results = Array.from(new Map(combined.map(m => [m.id, m])).values());
  }

  return results;
};

export const getGenres = async (): Promise<Genre[]> => {
  const response = await tmdb.get('/genre/movie/list');
  return response.data.genres;
};

export const getSimilarMovies = async (id: string | number): Promise<Movie[]> => {
  const response = await tmdb.get(`/movie/${id}/similar`);
  return response.data.results;
};

export const getMovieRecommendations = async (id: string | number): Promise<Movie[]> => {
  try {
    const response = await tmdb.get(`/movie/${id}/recommendations`);
    return response.data.results || [];
  } catch (error) {
    console.error('Error fetching TMDB recommendations:', error);
    return [];
  }
};

export const getMovieCandidates = async (movie: MovieDetails | Movie): Promise<Movie[]> => {
  const movieId = movie.id;
  const genreIds: number[] = [];
  if ('genres' in movie && Array.isArray(movie.genres)) {
    genreIds.push(...movie.genres.map(g => g.id));
  } else if ('genre_ids' in movie && Array.isArray(movie.genre_ids)) {
    genreIds.push(...movie.genre_ids);
  }

  const lang = movie.original_language;

  const [recsRes, simRes, discRes] = await Promise.all([
    tmdb.get(`/movie/${movieId}/recommendations`).catch(() => ({ data: { results: [] } })),
    tmdb.get(`/movie/${movieId}/similar`).catch(() => ({ data: { results: [] } })),
    genreIds.length > 0
      ? tmdb.get('/discover/movie', {
          params: {
            with_genres: genreIds.slice(0, 2).join(','),
            ...(lang && lang !== 'en' ? { with_original_language: lang } : {}),
            sort_by: 'popularity.desc',
            'vote_count.gte': 30,
          },
        }).catch(() => ({ data: { results: [] } }))
      : Promise.resolve({ data: { results: [] } }),
  ]);

  const pool = new Map<number, Movie>();
  const combined = [
    ...(recsRes.data?.results || []),
    ...(discRes.data?.results || []),
    ...(simRes.data?.results || []),
  ];

  for (const m of combined) {
    if (m.id !== movieId && m.poster_path && (m.vote_count >= 10 || m.popularity >= 5)) {
      pool.set(m.id, m);
    }
  }

  return Array.from(pool.values());
};

export const getMoviesByGenre = async (genreId: number): Promise<Movie[]> => {
  const response = await tmdb.get('/discover/movie', {
    params: {
      with_genres: genreId,
    },
  });
  return response.data.results;
};

export const fetchAllForRecommendations = async (favorites?: Movie[]): Promise<Movie[]> => {
  const pool = new Map<number, Movie>();

  // If user has favorites, collect candidates directly matching those favorites
  if (favorites && favorites.length > 0) {
    const recentFavorites = favorites.slice(-4);
    const candidatePromises = recentFavorites.map(async fav => {
      const [recs, sim] = await Promise.all([
        tmdb.get(`/movie/${fav.id}/recommendations`).catch(() => ({ data: { results: [] } })),
        tmdb.get(`/movie/${fav.id}/similar`).catch(() => ({ data: { results: [] } })),
      ]);
      return [...(recs.data?.results || []), ...(sim.data?.results || [])];
    });

    // Also discover movies using the user's top genres
    const genreCount: Record<number, number> = {};
    recentFavorites.forEach(fav => {
      fav.genre_ids?.forEach(gid => {
        genreCount[gid] = (genreCount[gid] || 0) + 1;
      });
    });
    const topGenres = Object.entries(genreCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([gid]) => gid)
      .join(',');

    const discPromise = topGenres
      ? tmdb.get('/discover/movie', {
          params: {
            with_genres: topGenres,
            sort_by: 'popularity.desc',
            'vote_count.gte': 50,
          },
        }).catch(() => ({ data: { results: [] } }))
      : Promise.resolve({ data: { results: [] } });

    const [candidateLists, discRes] = await Promise.all([
      Promise.all(candidatePromises),
      discPromise,
    ]);

    for (const m of [...candidateLists.flat(), ...(discRes.data?.results || [])]) {
      if (m.poster_path && (m.vote_count >= 10 || m.popularity >= 5)) {
        pool.set(m.id, m);
      }
    }
  }

  // Also include popular and top rated movies for fallback and diversity
  const [popRes, topRes] = await Promise.all([
    tmdb.get('/movie/popular?page=1').catch(() => ({ data: { results: [] } })),
    tmdb.get('/movie/top_rated?page=1').catch(() => ({ data: { results: [] } })),
  ]);

  for (const m of [...(popRes.data?.results || []), ...(topRes.data?.results || [])]) {
    if (m.poster_path) {
      pool.set(m.id, m);
    }
  }

  return Array.from(pool.values());
};
