import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./LoginLanding.css";

/* ============================================================
   CLAUSE VISUALIZATION DATA
   ============================================================ */

const CLAUSE_SAMPLES = [
  {
    id: "§ 4.7",
    label: "Indemnification",
    changeType: "modified",
    riskKind: "OBLIGATION SHIFT",
    riskTone: "amber",
    beforeParts: [
      { t: "Seller shall indemnify Buyer " },
      { t: "against any losses", del: true },
      { t: " arising from third-party claims only." },
    ],
    afterParts: [
      { t: "Seller shall indemnify Buyer and its affiliates " },
      { t: "against all losses, including indirect damages", ins: true },
      { t: " arising from any third-party claims." },
    ],
    indicators: ["flagged"],
  },
  {
    id: "§ 8.2",
    label: "Liability Cap",
    changeType: "modified",
    riskKind: "NUMERIC CHANGE",
    riskTone: "red",
    beforeParts: [
      { t: "Aggregate liability shall not exceed " },
      { t: "$5,000,000", del: true },
      { t: " per calendar year." },
    ],
    afterParts: [
      { t: "Aggregate liability shall not exceed " },
      { t: "$2,500,000", ins: true },
      { t: " per calendar year." },
    ],
    indicators: ["flagged"],
  },
  {
    id: "§ 6.1",
    label: "Material Adverse Change",
    changeType: "deleted",
    riskKind: "INTEGRITY ALERT",
    riskTone: "red",
    beforeParts: [
      { t: "Buyer may terminate if a Material Adverse Change occurs prior to Closing.", del: true },
    ],
    afterParts: [],
    indicators: ["deleted", "moved"],
  },
  {
    id: "§ 12.4",
    label: "Non-Compete Period",
    changeType: "modified",
    riskKind: "TIMING CHANGE",
    riskTone: "amber",
    beforeParts: [
      { t: "Non-compete obligations apply for " },
      { t: "24 months", del: true },
      { t: " following the Closing Date." },
    ],
    afterParts: [
      { t: "Non-compete obligations apply for " },
      { t: "36 months", ins: true },
      { t: " following the Closing Date." },
    ],
    indicators: ["flagged"],
  },
];

const INDICATOR_LABELS = {
  flagged: "Under review",
  moved: "Content relocated",
  deleted: "Clause removed",
};

/* ============================================================
   CLAUSE VISUALIZATION PANEL
   ============================================================ */

function ClauseVizPanel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActive((i) => (i + 1) % CLAUSE_SAMPLES.length);
    }, 3800);
    return () => clearInterval(t);
  }, []);

  const clause = CLAUSE_SAMPLES[active];

  function renderParts(parts) {
    return parts.map((part, i) => {
      if (part.del) return <span key={i} className="viz-del">{part.t}</span>;
      if (part.ins) return <span key={i} className="viz-ins">{part.t}</span>;
      return <span key={i}>{part.t}</span>;
    });
  }

  return (
    <div className="viz-panel">
      <div className="viz-panel-head">
        <span className="viz-panel-title">Forensic Analysis</span>
        <span className="viz-panel-status">
          <span className="viz-live-dot" />
          Live
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          className="viz-clause-wrapper"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="viz-clause-head">
            <span className="viz-clause-id">{clause.id}</span>
            <span className="viz-clause-label">{clause.label}</span>
            <span className={`viz-risk-badge ${clause.riskTone}`}>{clause.riskKind}</span>
          </div>

          <div className="viz-diff-block">
            {clause.beforeParts.length > 0 && (
              <div className={`viz-side ${clause.changeType === "deleted" ? "deleted-side" : "before-side"}`}>
                <span className="viz-side-ver">A</span>
                <p className="viz-text">{renderParts(clause.beforeParts)}</p>
              </div>
            )}

            {clause.afterParts.length > 0 ? (
              <div className="viz-side after-side">
                <span className="viz-side-ver">B</span>
                <p className="viz-text">{renderParts(clause.afterParts)}</p>
              </div>
            ) : clause.changeType === "deleted" ? (
              <div className="viz-side deleted-side">
                <span className="viz-side-ver">B</span>
                <p className="viz-text viz-deleted-msg">Clause removed from revised version</p>
              </div>
            ) : null}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="viz-footer">
        <div className="viz-indicators">
          {clause.indicators.map((ind) => (
            <span key={ind} className={`viz-indicator ${ind}`}>
              {INDICATOR_LABELS[ind]}
            </span>
          ))}
        </div>
        <div className="viz-dots">
          {CLAUSE_SAMPLES.map((_, i) => (
            <button
              key={i}
              className={`viz-dot-btn ${i === active ? "active" : ""}`}
              onClick={() => setActive(i)}
              aria-label={`Clause ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   FEATURE POINTS DATA
   ============================================================ */

const FEATURE_POINTS = [
  {
    icon: "◈",
    title: "Structural proof",
    desc: "Added, deleted, and modified clauses tracked with deterministic precision.",
  },
  {
    icon: "⚑",
    title: "Material risk focus",
    desc: "Obligations, numerics, timing, definitions, cross-references, and integrity.",
  },
  {
    icon: "↔",
    title: "Version-aware workflow",
    desc: "Compare any two saved versions and review the delta immediately.",
  },
];

/* ============================================================
   LANDING PAGE
   ============================================================ */

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const rightVariants = {
  hidden: { opacity: 0, x: 16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.15 },
  },
};

export default function LoginLanding() {
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();
    navigate("/dashboard");
  }

  return (
    <div className="login-shell">
      {/* Nav */}
      <motion.nav
        className="login-nav"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="login-brand-row">
          <div className="login-brand">ChangeSense</div>
          <span className="login-badge">Verification Layer</span>
        </div>
        <span className="login-nav-hint">M&amp;A · Diligence · Contract Review</span>
      </motion.nav>

      {/* Main frame */}
      <div className="login-frame">
        {/* Left column */}
        <motion.section
          className="login-copy"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="login-kicker" variants={itemVariants}>
            High-Stakes Legal Intelligence
          </motion.div>

          <motion.div className="login-hero" variants={itemVariants}>
            <h1>
              Deterministic change verification for the clauses you{" "}
              <em>cannot afford to miss.</em>
            </h1>
            <p>
              Review versions, surface ghost edits, and isolate material changes
              from one minimal workspace built for fast legal sign-off.
            </p>
          </motion.div>

          <motion.div className="login-points" variants={itemVariants}>
            {FEATURE_POINTS.map((pt) => (
              <div className="login-point" key={pt.title}>
                <div className="login-point-icon">{pt.icon}</div>
                <strong>{pt.title}</strong>
                <span>{pt.desc}</span>
              </div>
            ))}
          </motion.div>
        </motion.section>

        {/* Right column */}
        <motion.section
          className="login-panel"
          variants={rightVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Animated clause visualization */}
          <ClauseVizPanel />

          {/* Login card */}
          <div className="login-card">
            <div className="login-card-head">
              <div className="login-kicker">Workspace Access</div>
              <h2>Open your dashboard</h2>
              <p>Use the demo login to enter the document workspace.</p>
            </div>

            <form className="login-form" onSubmit={handleLogin}>
              <label>
                <span>Work Email</span>
                <input type="email" placeholder="team@firm.com" required />
              </label>
              <label>
                <span>Password</span>
                <input type="password" placeholder="••••••••" required />
              </label>
              <motion.button
                type="submit"
                className="login-submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                Enter Dashboard
              </motion.button>
            </form>

            <div className="login-card-foot">
              Built for clause-heavy diligence, negotiation, and final verification
              before signing.
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
