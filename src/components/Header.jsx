import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile menu after navigating.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className={`site-header${menuOpen ? ' menu-open' : ''}`}>
      <div className="container nav">
        <a className="logo" href="https://protrenchless.com/" aria-label="Pro Trenchless Services website">
          <img
            src="/assets/Pro-trenchless-simple-logo.png"
            alt="Instant Sewer and Drain Answers logo"
            className="logo-img"
          />
        </a>

        <Navbar />

        <a href="tel:4842065551" className="btn nav-call">
          <span className="nav-call-full">Call (484) 206-5551</span>
          <span className="nav-call-short" aria-hidden="true">Call</span>
        </a>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>
    </header>
  );
}
