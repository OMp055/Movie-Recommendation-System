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

export const getMoviesByGenre = async (genreId: number): Promise<Movie[]> => {
  const response = await tmdb.get('/discover/movie', {
    params: {
      with_genres: genreId,
    },
  });
  return response.data.results;
};

export const fetchAllForRecommendations = async (): Promise<Movie[]> => {
  // Fetch a few pages of popular and top rated movies to build a local corpus for recommendations
  const responses = await Promise.all([
    tmdb.get('/movie/popular?page=1'),
    tmdb.get('/movie/popular?page=2'),
    tmdb.get('/movie/top_rated?page=1'),
    tmdb.get('/movie/top_rated?page=2'),
  ]);
  
  const movies = responses.flatMap(res => res.data.results);
  
  // Deduplicate
  const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
  return uniqueMovies;
};
