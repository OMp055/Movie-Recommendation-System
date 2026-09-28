import { useState, useEffect } from 'react';
import { Hero } from '../components/Hero';
import { MovieList } from '../components/MovieList';
import { getTrendingMovies, getPopularMovies, getTopRatedMovies, getUpcomingMovies, fetchAllForRecommendations } from '../api/tmdb';
import { getHybridRecommendations } from '../utils/recommendation';
import type { Movie } from '../types';

export const Home = () => {
  const [trending, setTrending] = useState<Movie[]>([]);
  const [popular, setPopular] = useState<Movie[]>([]);
  const [topRated, setTopRated] = useState<Movie[]>([]);
  const [upcoming, setUpcoming] = useState<Movie[]>([]);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load favorites from local storage
    const savedFavs = localStorage.getItem('cinepulse_favorites');
    if (savedFavs) {
      setFavorites(JSON.parse(savedFavs));
    }

    const fetchData = async () => {
      try {
        const [trendingData, popularData, topRatedData, upcomingData] = await Promise.all([
          getTrendingMovies(),
          getPopularMovies(),
          getTopRatedMovies(),
          getUpcomingMovies(),
        ]);
        
        setTrending(trendingData);
        setPopular(popularData);
        setTopRated(topRatedData);
        setUpcoming(upcomingData);
      } catch (error) {
        console.error('Failed to fetch movies:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (favorites.length > 0) {
        try {
          const corpus = await fetchAllForRecommendations(favorites);
          const recs = getHybridRecommendations(favorites, corpus, 12);
          setRecommendations(recs);
        } catch (error) {
          console.error('Failed to fetch corpus for recommendations:', error);
        }
      } else {
        setRecommendations([]);
      }
    };
    
    if (!loading) {
      fetchRecommendations();
    }
  }, [favorites, loading]);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const heroMovie = trending[0];

  return (
    <div className="pb-16">
      {heroMovie && <Hero movie={heroMovie} />}
      
      <div className="-mt-32 relative z-10">
        <MovieList
          title="Trending Now"
          movies={trending.slice(1)}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
        
        {recommendations.length > 0 && (
          <MovieList
            title="Recommended For You"
            movies={recommendations}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        
        <MovieList
          title="Popular Movies"
          movies={popular}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
        
        <MovieList
          title="Top Rated"
          movies={topRated}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
        
        <MovieList
          title="Upcoming"
          movies={upcoming}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
        />
      </div>
    </div>
  );
};
