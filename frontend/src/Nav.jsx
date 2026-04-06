import React from "react";
import { useState } from "react";

const Logo = () => (
  <svg width="22" height="26" viewBox="0 0 48 56" fill="none">
    <path d="M24 4C24 4 6 22 6 34A18 18 0 0 0 42 34C42 22 24 4 24 4Z" fill="#1D9E75" opacity=".9"/>
  </svg>
);

const LINKS = [
  { id: "wqi",            label: "WQI Calculator" },
  { id: "forecast",       label: "Forecast"        },
  { id: "classification", label: "Classification"  },
    { id: "anomaly",        label: "Anomaly Detection"},
];

export default function Nav({ page, setPage }) {
  const [open, setOpen] = useState(false);
  const activeClass = page === "anomaly" ? "active-red" : "active-teal";

  return (
    <nav className="nav" style={{ position: "relative" }}>
      <button className="nav-brand" onClick={() => { setPage("wqi"); setOpen(false); }}>
        <Logo /> AquaML
      </button>

      <div className={`nav-links${open ? " open" : ""}`}>
        {LINKS.map(l => (
          <button
            key={l.id}
            className={`nav-link${page === l.id ? " " + activeClass : ""}`}
            onClick={() => { setPage(l.id); setOpen(false); }}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Hamburger */}
      <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          {open ? (
            <>
              <line x1="4" y1="4" x2="18" y2="18" stroke="#5a6358" strokeWidth="2" strokeLinecap="round"/>
              <line x1="18" y1="4" x2="4" y2="18" stroke="#5a6358" strokeWidth="2" strokeLinecap="round"/>
            </>
          ) : (
            <>
              <line x1="3" y1="6"  x2="19" y2="6"  stroke="#5a6358" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="11" x2="19" y2="11" stroke="#5a6358" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="16" x2="19" y2="16" stroke="#5a6358" strokeWidth="2" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </button>
    </nav>
  );
}
