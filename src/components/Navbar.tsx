import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchMovies } from '../api/tmdb';
import type { Movie } from '../types';

export const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await searchMovies(searchQuery);
        setSuggestions(results.slice(0, 5));
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
      setIsSearchOpen(false);
      setSuggestions([]);
    }
  };

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled ? 'glass-card py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tighter">
          <Film className="w-8 h-8" />
          <span>CinePulse</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/favorites" className="text-white hover:text-primary transition-colors flex items-center gap-2">
            <Heart className="w-5 h-5" />
            <span className="hidden md:inline">Favorites</span>
          </Link>
          
          <div className="relative flex items-center">
            <AnimatePresence>
              {isSearchOpen && (
                <motion.form
                  initial={{ width: 0, opacity: 0, scale: 0.95 }}
                  animate={{ width: '450px', opacity: 1, scale: 1 }}
                  exit={{ width: 0, opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  onSubmit={handleSearch}
                  className="absolute right-14 top-1/2 -translate-y-1/2"
                >
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                      placeholder="Search for movies..."
                      className="w-full bg-white/5 backdrop-blur-3xl backdrop-saturate-150 border border-white/20 border-t-white/30 border-l-white/30 rounded-full py-3 pl-6 pr-12 text-base focus:outline-none focus:ring-1 focus:ring-white/40 text-white placeholder:text-gray-300 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all"
                      autoFocus
                    />
                    <AnimatePresence>
                      {isFocused && suggestions.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 15, rotateX: -5 }}
                          animate={{ opacity: 1, y: 0, rotateX: 0 }}
                          exit={{ opacity: 0, y: 10, scale: 0.98 }}
                          style={{ perspective: 1000 }}
                          className="absolute top-full mt-4 right-0 w-full min-w-[450px] bg-black/20 backdrop-blur-3xl backdrop-saturate-150 border border-white/20 border-t-white/30 rounded-3xl overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,0.4)] z-50 flex flex-col"
                        >
                          {suggestions.map((movie) => (
                            <div
                              key={movie.id}
                              onClick={() => {
                                navigate(`/movie/${movie.id}`);
                                setSearchQuery('');
                                setIsSearchOpen(false);
                                setSuggestions([]);
                              }}
                              className="flex items-center gap-4 p-4 hover:bg-white/10 cursor-pointer transition-all border-b border-white/10 last:border-0 relative group"
                            >
                              {movie.poster_path ? (
                                <img
                                  src={`https://image.tmdb.org/t/p/w92${movie.poster_path}`}
                                  alt={movie.title}
                                  className="w-12 h-16 object-cover rounded-xl shadow-lg group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-12 h-16 bg-white/10 rounded-xl flex items-center justify-center shadow-inner">
                                  <Film className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div className="flex flex-col flex-1 z-10">
                                <span className="text-base font-semibold text-white line-clamp-1 drop-shadow-sm">{movie.title}</span>
                                <span className="text-sm text-gray-300 font-medium">{movie.release_date?.split('-')[0]}</span>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => handleSearch()}
                            className="p-4 text-sm text-center text-white font-semibold hover:bg-white/10 transition-colors bg-white/5 backdrop-blur-md border-t border-white/10"
                          >
                            View all results for "{searchQuery}"
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
            <button
              onClick={(e) => {
                if (isSearchOpen && searchQuery.trim()) {
                  handleSearch(e as unknown as React.FormEvent);
                } else {
                  setIsSearchOpen(!isSearchOpen);
                }
              }}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-3xl backdrop-saturate-150 rounded-full border border-white/20 border-t-white/40 border-l-white/40 text-white transition-all shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] z-10 ml-2"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
