import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { FluidBackground } from './components/FluidBackground';
import { Home } from './pages/Home';
import { MovieDetails } from './pages/MovieDetails';
import { Search } from './pages/Search';
import { Favorites } from './pages/Favorites';

function App() {
  return (
    <Router>
      <FluidBackground />
      <div className="min-h-screen text-white selection:bg-primary selection:text-white bg-transparent">
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/search" element={<Search />} />
            <Route path="/favorites" element={<Favorites />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
