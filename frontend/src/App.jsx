import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Upload from './pages/Upload';
import Results from './pages/Results';
import Detail from './pages/Detail';
import { ToastProvider } from './components/Toast';
import './index.css';

function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <NavLink to="/" className="navbar__brand">
          <span className="navbar__logo">◆</span>
          <span className="navbar__title">Microstock Checker</span>
        </NavLink>
        <div className="navbar__links">
          <NavLink to="/" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`} end>
            Periksa File
          </NavLink>
          <NavLink to="/results" className={({ isActive }) => `navbar__link ${isActive ? 'navbar__link--active' : ''}`}>
            Hasil
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Upload />} />
            <Route path="/results" element={<Results />} />
            <Route path="/results/:id" element={<Detail />} />
          </Routes>
        </main>
      </BrowserRouter>
    </ToastProvider>
  );
}
