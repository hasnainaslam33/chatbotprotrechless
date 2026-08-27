import { NavLink } from 'react-router-dom';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/tools/symptom-checker', label: 'Symptom Checker' },
  { to: '/tools/estimate-review', label: 'Estimate Review' },
  { to: '/tools/sewer-camera-review', label: 'Camera Review' }
];

export default function Navbar() {
  return (
    <nav className="nav-links" aria-label="Primary navigation">
      {navLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
