import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Movie } from '../types';
import { MovieCard } from './MovieCard';

interface MovieListProps {
  title: string;
  movies: Movie[];
  favorites: Movie[];
  onToggleFavorite: (movie: Movie) => void;
}

export const MovieList = ({ title, movies, favorites, onToggleFavorite }: MovieListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -current.offsetWidth : current.offsetWidth;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (movies.length === 0) return null;

  return (
    <div className="my-8 md:my-12">
      <div className="flex items-center justify-between px-4 md:px-8 mb-6">
        <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-2 rounded-full glass hover:bg-white/20 transition-colors hidden md:block"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-2 rounded-full glass hover:bg-white/20 transition-colors hidden md:block"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
      
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto px-4 md:px-8 pb-8 pt-4 hide-scrollbar snap-x snap-mandatory"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="flex-none w-40 md:w-56 snap-start">
              <MovieCard
                movie={movie}
                isFavorite={favorites.some(f => f.id === movie.id)}
                onToggleFavorite={onToggleFavorite}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
