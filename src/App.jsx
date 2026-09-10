import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header.jsx';
import { Footer } from './components/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ToolPage from './pages/ToolPage.jsx';
import ComparisonReportPage from './pages/ComparisonReportPage.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools/:slug" element={<ToolPage />} />
        <Route path="/comparison/:reportId/:token" element={<ComparisonReportPage />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  );
}
