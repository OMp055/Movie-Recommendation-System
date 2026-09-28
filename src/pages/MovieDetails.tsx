import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Clock, Calendar, Heart, Play, Download } from 'lucide-react';
import { getMovieDetails, getMovieCandidates } from '../api/tmdb';
import { getRecommendations } from '../utils/recommendation';
import { MovieList } from '../components/MovieList';
import type { MovieDetails as MovieDetailsType, Movie } from '../types';

export const MovieDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [contentBasedRecs, setContentBasedRecs] = useState<Movie[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedFavs = localStorage.getItem('cinepulse_favorites');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        const details = await getMovieDetails(id);
        setMovie(details);

        // Fetch smart candidate pool (recommendations, similar, and genre discover)
        const candidates = await getMovieCandidates(details);
        
        // Accurate AI content-based similarity
        const recs = getRecommendations(details, candidates, 12);
        setContentBasedRecs(recs);
      } catch (error) {
        console.error('Error fetching movie details:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

  const handleToggleFavorite = (targetMovie: Movie) => {
    setFavorites(prev => {
      const isFav = prev.some(f => f.id === targetMovie.id);
      let newFavs;
      if (isFav) {
        newFavs = prev.filter(f => f.id !== targetMovie.id);
      } else {
        newFavs = [...prev, targetMovie];
      }
      localStorage.setItem('cinepulse_favorites', JSON.stringify(newFavs));
      return newFavs;
    });
  };

  if (loading || !movie) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Find trailer, teaser or any video from YouTube
  const trailer = movie.videos?.results.find(v => v.type === 'Trailer' && v.site === 'YouTube')
    || movie.videos?.results.find(v => v.type === 'Teaser' && v.site === 'YouTube')
    || movie.videos?.results.find(v => v.site === 'YouTube');

  // Dynamic YouTube trailer link: direct video URL if available, else query search
  const youtubeUrl = trailer?.key
    ? `https://www.youtube.com/watch?v=${trailer.key}`
    : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${movie.title} official trailer`)}`;

  // Dynamic Download link
  const formattedTitle = movie.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const downloadUrl = `https://bollyflix.af/${formattedTitle}/`;

  const isFavorite = favorites.some(f => f.id === movie.id);

  return (
    <div className="min-h-screen pb-16">
      {/* Backdrop */}
      <div className="relative h-[60vh] md:h-[80vh] w-full">
        <div className="absolute inset-0">
          <img
            src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
            alt={movie.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-8 -mt-40 md:-mt-64 relative z-10">
        <div className="flex flex-col md:flex-row gap-8 md:gap-12">
          {/* Poster */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-48 md:w-80 flex-shrink-0 mx-auto md:mx-0 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10"
          >
            <img
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              alt={movie.title}
              className="w-full h-auto"
            />
          </motion.div>

          {/* Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 mt-4 md:mt-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-2">{movie.title}</h1>
            {movie.tagline && (
              <p className="text-xl text-gray-400 italic mb-6">{movie.tagline}</p>
            )}

            <div className="flex flex-wrap items-center gap-6 mb-8 text-sm md:text-base">
              <div className="flex items-center gap-2 text-yellow-500 font-semibold">
                <Star className="w-5 h-5 fill-current" />
                <span>{movie.vote_average.toFixed(1)} / 10</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Clock className="w-5 h-5" />
                <span>{movie.runtime} min</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Calendar className="w-5 h-5" />
                <span>{movie.release_date}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-8">
              {movie.genres.map(genre => (
                <span key={genre.id} className="px-4 py-1.5 rounded-full glass-card text-sm font-medium">
                  {genre.name}
                </span>
              ))}
            </div>

            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-3">Overview</h3>
              <p className="text-gray-300 leading-relaxed max-w-3xl">
                {movie.overview}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <a
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#ff0000] hover:bg-[#cc0000] text-white px-8 py-3 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30"
              >
                <Play className="w-5 h-5 fill-current" />
                Watch Trailer
              </a>

              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-600/30"
              >
                <Download className="w-5 h-5" />
                Download Movie
              </a>

              <button
                onClick={() => handleToggleFavorite(movie)}
                className={`flex items-center gap-2 px-8 py-3 rounded-full font-semibold transition-all hover:scale-105 active:scale-95 glass ${
                  isFavorite ? 'text-primary' : 'text-white hover:bg-white/20'
                }`}
              >
                <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                {isFavorite ? 'In Favorites' : 'Add to Favorites'}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Cast */}
        {movie.credits?.cast && movie.credits.cast.length > 0 && (
          <div className="mt-16 md:mt-24">
            <h3 className="text-2xl md:text-3xl font-bold mb-6">Top Cast</h3>
            <div className="flex gap-4 md:gap-6 overflow-x-auto pb-8 hide-scrollbar snap-x">
              {movie.credits.cast.slice(0, 10).map(person => (
                <div key={person.id} className="flex-none w-32 md:w-40 snap-start text-center">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden mx-auto mb-3 glass border-white/10">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center text-gray-500">
                        No Image
                      </div>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm md:text-base leading-tight mb-1">{person.name}</h4>
                  <p className="text-gray-400 text-xs md:text-sm leading-tight">{person.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mt-12">
          {contentBasedRecs.length > 0 && (
            <MovieList
              title="More Like This (AI Recommended)"
              movies={contentBasedRecs}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        </div>
      </div>
    </div>
  );
};
