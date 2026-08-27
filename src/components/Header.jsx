import { Link } from 'react-router-dom';
import Navbar from './Navbar.jsx';

export function Header() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link className="logo" to="/" aria-label="Instant Sewer and Drain Answers home">
          <img
            src="/assets/Pro-trenchless-simple-logo.png"
            alt="Instant Sewer and Drain Answers logo"
            className="logo-img"
          />
        </Link>

        <Navbar />

        <a href="tel:4842065551" className="btn">
          Call (484) 206-5551
        </a>
      </div>
    </header>
  );
}
