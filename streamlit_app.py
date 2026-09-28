import streamlit as st
import httpx
import os
import re
import urllib.parse
from dotenv import load_dotenv
from recommendation import get_recommendations, get_hybrid_recommendations

# Load TMDB API Key
load_dotenv(dotenv_path=".env")
API_KEY = os.getenv("VITE_TMDB_API_KEY")
BASE_URL = "https://api.tmdb.org/3"

st.set_page_config(page_title="CinePulse (Python Edition)", layout="wide", page_icon="🎬")

# Custom CSS for styling
st.markdown("""
<style>
    .stApp {
        background-color: #0d0d0d;
        color: white;
    }
    .movie-card {
        background: rgba(255,255,255,0.05);
        border-radius: 15px;
        padding: 10px;
        text-align: center;
        transition: transform 0.3s;
    }
    .movie-card:hover {
        transform: scale(1.05);
    }
    .movie-card img {
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    }
</style>
""", unsafe_allow_html=True)

# ---------------------------------------------------------
# API Functions
# ---------------------------------------------------------
@st.cache_data(ttl=3600)
def fetch_tmdb(endpoint: str, params: dict = None):
    url = f"{BASE_URL}{endpoint}"
    query = {"api_key": API_KEY}
    if params: query.update(params)
    try:
        response = httpx.get(url, params=query, timeout=10.0)
        return response.json()
    except Exception as e:
        return {}

def search_movies(q: str):
    data = fetch_tmdb("/search/movie", {"query": q})
    results = data.get("results", [])
    
    # Spelling Fallback
    if not results:
        var = re.sub(r'([a-zA-Z])\1+', r'\1', q)
        if var != q:
            results = fetch_tmdb("/search/movie", {"query": var}).get("results", [])
    return results

@st.cache_data(ttl=3600)
def fetch_corpus(liked_movie_ids_tuple=()):
    candidates = {}
    
    # Fetch targeted candidates for liked movies
    for mid in liked_movie_ids_tuple:
        recs = fetch_tmdb(f"/movie/{mid}/recommendations").get("results", [])
        for m in recs:
            if m.get("id") and m.get("poster_path"):
                candidates[m["id"]] = m
        sim = fetch_tmdb(f"/movie/{mid}/similar").get("results", [])
        for m in sim:
            if m.get("id") and m.get("poster_path") and (m.get("vote_count", 0) >= 10):
                candidates[m["id"]] = m

    # Also include popular & top-rated for diversity
    for page in [1, 2]:
        for m in fetch_tmdb("/movie/popular", {"page": page}).get("results", []):
            if m.get("id") and m.get("poster_path"):
                candidates[m["id"]] = m
        for m in fetch_tmdb("/movie/top_rated", {"page": page}).get("results", []):
            if m.get("id") and m.get("poster_path"):
                candidates[m["id"]] = m
                
    return list(candidates.values())

# ---------------------------------------------------------
# UI Components
# ---------------------------------------------------------
def display_movie_grid(movies):
    if not movies:
        st.warning("No movies found.")
        return
        
    cols = st.columns(5)
    for i, movie in enumerate(movies[:20]):
        with cols[i % 5]:
            poster = movie.get('poster_path')
            img_url = f"https://image.tmdb.org/t/p/w500{poster}" if poster else "https://via.placeholder.com/500x750?text=No+Poster"
            
            title = movie.get('title', 'Unknown')
            yt_query = urllib.parse.quote(f"{title} official trailer")
            yt_link = f"https://www.youtube.com/results?search_query={yt_query}"

            st.markdown(f"""
            <div class="movie-card">
                <img src="{img_url}" width="100%">
                <h4 style="margin-top:10px; font-size:16px;">{title}</h4>
                <p style="color:gray; font-size:12px;">★ {movie.get('vote_average', 0)}/10</p>
                <a href="{yt_link}" target="_blank" style="display:inline-block; margin-top:6px; margin-bottom:10px; padding:6px 14px; background:#ff0000; color:white; border-radius:20px; text-decoration:none; font-size:12px; font-weight:bold;">▶ Watch Trailer</a>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button("Like ❤️", key=f"like_{movie['id']}_{i}"):
                if 'favorites' not in st.session_state:
                    st.session_state.favorites = []
                # Add to favorites if not already there
                if not any(f['id'] == movie['id'] for f in st.session_state.favorites):
                    st.session_state.favorites.append(movie)
                    st.toast(f"Added {movie['title']} to Favorites!")

# ---------------------------------------------------------
# Main App Structure
# ---------------------------------------------------------
st.title("🎬 CinePulse: Python Edition")

# Initialize session state for favorites
if 'favorites' not in st.session_state:
    st.session_state.favorites = []

# Sidebar Navigation
page = st.sidebar.radio("Navigation", ["Home", "Search", "Favorites", "My Recommendations"])

if page == "Home":
    st.header("Trending Today")
    trending = fetch_tmdb("/trending/movie/day").get("results", [])
    display_movie_grid(trending)

elif page == "Search":
    st.header("Search Movies")
    query = st.text_input("Enter movie title...", placeholder="e.g. Inception or Tumbbad")
    if query:
        results = search_movies(query)
        st.subheader(f"Search Results for '{query}'")
        display_movie_grid(results)

elif page == "Favorites":
    st.header("Your Favorite Movies")
    if not st.session_state.favorites:
        st.info("You haven't added any favorites yet! Go to Home or Search to like some movies.")
    else:
        display_movie_grid(st.session_state.favorites)
        if st.button("Clear Favorites"):
            st.session_state.favorites = []
            st.rerun()

elif page == "My Recommendations":
    st.header("For You")
    st.write("These recommendations are generated instantly in pure Python using TF-IDF based on your liked movies!")
    
    if not st.session_state.favorites:
        st.warning("Like some movies first to get personalized recommendations!")
    else:
        with st.spinner("Analyzing your taste and generating recommendations..."):
            fav_ids = tuple(f['id'] for f in st.session_state.favorites if f.get('id'))
            corpus = fetch_corpus(fav_ids)
            # Use the Python recommendation engine we built!
            hybrid_recs = get_hybrid_recommendations(st.session_state.favorites, corpus, top_n=10)
            display_movie_grid(hybrid_recs)
