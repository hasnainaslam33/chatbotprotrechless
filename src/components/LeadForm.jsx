import React from 'react';

export function LeadForm() {
  return (
    <div className="panel lead-box" id="lead-form">
      <h2>Send this to Pro Trenchless</h2>
      <p className="mini">Ask for booking only after the tool gives value. This form is ready to connect to Gravity Forms, Tally, HubSpot, GoHighLevel, Zapier, ServiceTitan, or a custom webhook.</p>
      <div className="form-section">
        <div className="field">
          <label>Name</label>
          <input placeholder="Full name" />
        </div>
        <div className="field">
          <label>Phone</label>
          <input placeholder="Best phone number" />
        </div>
        <div className="field">
          <label>Email</label>
          <input placeholder="Email address" />
        </div>
        <div className="field">
          <label>Property address or service area</label>
          <input placeholder="Street, city, ZIP" />
        </div>
        <div className="field">
          <label>Preferred appointment time</label>
          <input placeholder="Morning, afternoon, urgent, or specific time" />
        </div>
        <div className="field">
          <label>Upload video, estimate, report, or photos</label>
          <input type="file" multiple />
        </div>
        <label className="check">
          <input type="checkbox" /> I consent to be contacted by Pro Trenchless Services about this request.
        </label>
        <button className="btn" type="button">
          Request Review
        </button>
      </div>
      <p className="disclaimer">
        This AI tool provides educational guidance only. Final diagnosis, repair method, pricing, code compliance, permits, and safety decisions require professional inspection and verification.
      </p>
    </div>
  );
}
