import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Info, Star } from 'lucide-react';
import type { Movie } from '../types';

interface HeroProps {
  movie: Movie;
}

export const Hero = ({ movie }: HeroProps) => {
  return (
    <div className="relative h-[80vh] w-full mt-0">
      <div className="absolute inset-0">
        <img
          src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
          alt={movie.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 md:px-8 h-full flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl"
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 text-primary font-semibold mb-4"
          >
            <Star className="w-5 h-5 fill-current" />
            <span>{movie.vote_average.toFixed(1)} / 10</span>
            <span className="text-gray-400 mx-2">|</span>
            <span className="text-gray-300">{movie.release_date?.split('-')[0]}</span>
          </motion.div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight text-shadow">
            {movie.title}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-300 mb-8 line-clamp-3 max-w-xl text-shadow">
            {movie.overview}
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/movie/${movie.id}`}
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-full font-semibold transition-all hover:scale-105 active:scale-95"
            >
              <Play className="w-5 h-5 fill-current" />
              Watch Trailer
            </Link>
            
            <Link
              to={`/movie/${movie.id}`}
              className="flex items-center gap-2 glass px-8 py-3 rounded-full font-semibold text-white hover:bg-white/20 transition-all hover:scale-105 active:scale-95"
            >
              <Info className="w-5 h-5" />
              More Info
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
