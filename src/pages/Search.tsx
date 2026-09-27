import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchMovies, getGenres } from '../api/tmdb';
import { MovieCard } from '../components/MovieCard';
import type { Movie, Genre } from '../types';

export const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedFavs = localStorage.getItem('cinepulse_favorites');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
    
    const fetchGenres = async () => {
      try {
        const genresData = await getGenres();
        setGenres(genresData);
      } catch (error) {
        console.error('Failed to fetch genres:', error);
      }
    };
    
    fetchGenres();
  }, []);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        setMovies([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        // Basic debounce mechanism could be added here in a real app
        const results = await searchMovies(query);
        setMovies(results);
      } catch (error) {
        console.error('Failed to search movies:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query]);

  const handleToggleFavorite = (movie: Movie) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.id === movie.id);
      let newFavs;
      if (isFav) {
        newFavs = prev.filter(f => f.id !== movie.id);
      } else {
        newFavs = [...prev, movie];
      }
      localStorage.setItem('cinepulse_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const filteredMovies = selectedGenre
    ? movies.filter(m => m.genre_ids?.includes(selectedGenre))
    : movies;

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">
          Search Results for "{query}"
        </h1>
        <p className="text-gray-400">
          Found {filteredMovies.length} movies
        </p>
      </div>

      {genres.length > 0 && movies.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedGenre(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedGenre === null ? 'bg-primary text-white' : 'glass text-gray-300 hover:text-white'
            }`}
          >
            All
          </button>
          {genres.map(genre => {
            // Only show genres that exist in current results
            const hasMoviesInGenre = movies.some(m => m.genre_ids?.includes(genre.id));
            if (!hasMoviesInGenre) return null;
            
            return (
              <button
                key={genre.id}
                onClick={() => setSelectedGenre(genre.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedGenre === genre.id ? 'bg-primary text-white' : 'glass text-gray-300 hover:text-white'
                }`}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredMovies.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {filteredMovies.map(movie => (
            <MovieCard
              key={movie.id}
              movie={movie}
              isFavorite={favorites.some(f => f.id === movie.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold text-gray-400 mb-2">No movies found</h2>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};
