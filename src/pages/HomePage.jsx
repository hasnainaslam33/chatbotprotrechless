import { useEffect, useState } from 'react';
import HeroSection from '../components/HeroSection.jsx';
import ToolCard from '../components/ToolCard.jsx';
import { toolPages } from '../data/toolPages.js';
import ChatBox from '../components/ChatBox.jsx';

const featureTools = toolPages.slice(0, 6);

export default function HomePage() {
  const [selectedType, setSelectedType] = useState('Homeowner');

  useEffect(() => {
    const storedType = localStorage.getItem('pt_user_type') || 'Homeowner';
    setSelectedType(storedType);
  }, []);

  useEffect(() => {
    localStorage.setItem('pt_user_type', selectedType);
  }, [selectedType]);

  return (
    <main className="page home-page">
      <HeroSection selectedType={selectedType} onSelect={setSelectedType} />
      <section className="section chat-section">
        <div className="container">
          <ChatBox inline selectedType={selectedType} />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Choose the right sewer tool</h2>
          <p className="section-copy">
            The goal is simple: do not just clear the drain. Find the cause, compare options, and avoid approving the wrong repair.
          </p>
          <div className="tool-grid">
            {featureTools.map((tool) => (
              <ToolCard key={tool.slug} tool={tool} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-contrast">
        <div className="container split">
          <div className="callout">
            <h2>Don’t just clear it. Find the cause.</h2>
            <p>
              Every completed journey should move the user toward a smarter next step: camera inspection, locate, cleaning, jetting, lining,
              pipe bursting, repair review, or replacement planning.
            </p>
            <a className="btn secondary" href="https://protrenchless.com/sewer-camera-inspection/">
              Learn more about sewer camera inspections
            </a>
          </div>
          <div className="steps">
            {[
              {
                title: 'Give value first',
                copy: 'Explain likely causes, risk level, and what information is missing before asking for a booking.'
              },
              {
                title: 'Capture qualified leads',
                copy: 'Name, phone, email, address, user type, urgency, files, appointment preference, and contact consent.'
              },
              {
                title: 'Feed the main site',
                copy: 'Link results to Pro Trenchless service pages and turn anonymized questions into reviewed SEO content.'
              }
            ].map((step, index) => (
              <div key={step.title} className="step">
                <span className="step-num">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <br />
                  <span className="mini">{step.copy}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </main>
  );
}
