import { useState, useEffect } from 'react';
import { MovieCard } from '../components/MovieCard';
import type { Movie } from '../types';

export const Favorites = () => {
  const [favorites, setFavorites] = useState<Movie[]>([]);

  useEffect(() => {
    const savedFavs = localStorage.getItem('cinepulse_favorites');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
  }, []);

  const handleToggleFavorite = (movie: Movie) => {
    setFavorites(prev => {
      const newFavs = prev.filter(f => f.id !== movie.id);
      localStorage.setItem('cinepulse_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-24 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">My Favorites</h1>
        <p className="text-gray-400">
          You have {favorites.length} saved movies
        </p>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {favorites.map(movie => (
            <MovieCard
              key={movie.id}
              movie={movie}
              isFavorite={true}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <h2 className="text-2xl font-semibold text-gray-400 mb-2">No favorites yet</h2>
          <p className="text-gray-500">Start exploring and save some movies you like!</p>
        </div>
      )}
    </div>
  );
};
