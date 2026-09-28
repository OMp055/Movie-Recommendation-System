import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Heart, Play } from 'lucide-react';
import type { Movie } from '../types';
import { useState } from 'react';

interface MovieCardProps {
  movie: Movie;
  isFavorite?: boolean;
  onToggleFavorite?: (movie: Movie) => void;
}

export const MovieCard = ({ movie, isFavorite = false, onToggleFavorite }: MovieCardProps) => {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05, y: -5 }}
      transition={{ duration: 0.2 }}
      className="relative group rounded-xl overflow-hidden glass-card cursor-pointer"
    >
      <Link to={`/movie/${movie.id}`}>
        <div className="aspect-[2/3] w-full bg-surface relative">
          {movie.poster_path && !imgError ? (
            <img
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-4 text-center text-gray-500">
              {movie.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
            <h3 className="text-white font-bold text-lg leading-tight mb-2 line-clamp-2">{movie.title}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-yellow-500">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-semibold">{movie.vote_average.toFixed(1)}</span>
              </div>
              <span className="text-gray-300 text-xs">
                {movie.release_date?.split('-')[0]}
              </span>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Dynamic YouTube Trailer Link */}
      <a
        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} official trailer`)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute top-3 left-3 p-1.5 px-2.5 rounded-full glass bg-black/60 text-white hover:bg-[#ff0000] hover:text-white transition-all z-10 flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 shadow-lg"
        title="Watch Trailer on YouTube"
      >
        <Play className="w-3 h-3 fill-current" />
        <span>Trailer</span>
      </a>

      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleFavorite(movie);
          }}
          className="absolute top-3 right-3 p-2 rounded-full glass bg-black/50 text-white hover:text-primary transition-colors z-10"
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
        </button>
      )}
    </motion.div>
  );
};
