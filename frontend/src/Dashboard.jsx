import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import DocumentViewer from "./DocumentViewer";
import "./Dashboard.css";

const API_BASE = "/api";

const FILTER_GROUPS = [
  {
    id: "structural",
    title: "Structural Changes",
    filters: [
      { id: "all_structural", label: "All Structural" },
      { id: "added", label: "Added" },
      { id: "deleted", label: "Deleted" },
      { id: "modified", label: "Modified" },
    ],
  },
  {
    id: "material",
    title: "Material Risks",
    filters: [
      { id: "all_material", label: "All Material" },
      { id: "high_risk", label: "High Risk" },
      { id: "obligation", label: "Obligation" },
      { id: "numeric", label: "Numeric" },
      { id: "timing", label: "Timing" },
      { id: "definition", label: "Definition" },
      { id: "cross_reference", label: "Cross-ref" },
      { id: "integrity", label: "Integrity" },
    ],
  },
];

const STRUCTURAL_FILTERS = FILTER_GROUPS.find((g) => g.id === "structural").filters;
const MATERIAL_FILTERS = FILTER_GROUPS.find((g) => g.id === "material").filters;

function formatDocName(name) {
  return String(name || "").replace(/_/g, " ");
}

function formatRiskLabel(risk) {
  return String(risk || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeSimilarity(change) {
  const before = change.before_text || "";
  const after = change.after_text || "";
  if (!before || !after) return 0;

  const beforeWords = before.trim().split(/\s+/).filter(Boolean).length;
  const afterWords = after.trim().split(/\s+/).filter(Boolean).length;
  const insertions = (change.insertions || []).reduce(
    (sum, item) => sum + (item.after?.trim().split(/\s+/).filter(Boolean).length || 0),
    0
  );
  const deletions = (change.deletions || []).reduce(
    (sum, item) => sum + (item.before?.trim().split(/\s+/).filter(Boolean).length || 0),
    0
  );
  const substitutions = (change.substitutions || []).reduce((sum, item) => {
    const bc = item.before?.trim().split(/\s+/).filter(Boolean).length || 0;
    const ac = item.after?.trim().split(/\s+/).filter(Boolean).length || 0;
    return sum + Math.max(bc, ac);
  }, 0);
  const total = Math.max(beforeWords, afterWords, 1);
  const changed = Math.min(total, insertions + deletions + substitutions);
  return Math.max(0, Math.min(1, 1 - changed / total));
}

function extractSectionRefs(text) {
  return (text || "").match(/section\s+[\d\.\(\)a-zA-Z]+/gi) || [];
}

function severityFromChange(change) {
  if (change.riskKinds.includes("integrity") || change.riskKinds.includes("obligation")) return "critical";
  if (change.riskKinds.includes("numeric") || change.riskKinds.includes("timing")) return "critical";
  if (change.riskKinds.length > 0) return "elevated";
  return "routine";
}

function severityLabel(severity) {
  if (severity === "critical") return "Critical";
  if (severity === "elevated") return "Elevated";
  return "Routine";
}

function matchesFilter(change, group, filterId) {
  if (group === "structural") {
    if (filterId === "all_structural") return true;
    return change.change_type === filterId;
  }
  if (filterId === "all_material") return change.riskKinds.length > 0;
  if (filterId === "high_risk") return change.severity === "critical";
  return change.riskKinds.includes(filterId);
}

function countForFilter(changes, group, filterId) {
  return changes.filter((c) => matchesFilter(c, group, filterId)).length;
}

function matchesActiveSelections(change, structuralFilterId, materialFilterId) {
  const sm = structuralFilterId === "all_structural" || matchesFilter(change, "structural", structuralFilterId);
  const mm = materialFilterId === "all_material" || matchesFilter(change, "material", materialFilterId);
  return sm && mm;
}

function renderBeforeWithDeletions(text, deletions) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  const sorted = (deletions || [])
    .filter((item) => item.before && text.includes(item.before))
    .sort((a, b) => text.indexOf(a.before) - text.indexOf(b.before));

  for (const del of sorted) {
    const idx = text.indexOf(del.before, lastIdx);
    if (idx === -1) continue;
    if (idx > lastIdx) parts.push(<span key={`pre-${idx}`}>{text.slice(lastIdx, idx)}</span>);
    parts.push(
      <span key={`del-${idx}`} className="detail-diff-remove">{del.before}</span>
    );
    lastIdx = idx + del.before.length;
  }
  if (lastIdx < text.length) parts.push(<span key="tail">{text.slice(lastIdx)}</span>);
  return parts.length > 0 ? parts : text;
}

function renderAfterWithInsertions(text, insertions) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;
  const sorted = (insertions || [])
    .filter((item) => item.after && text.includes(item.after))
    .sort((a, b) => text.indexOf(a.after) - text.indexOf(b.after));

  for (const ins of sorted) {
    const idx = text.indexOf(ins.after, lastIdx);
    if (idx === -1) continue;
    if (idx > lastIdx) parts.push(<span key={`pre-${idx}`}>{text.slice(lastIdx, idx)}</span>);
    parts.push(
      <span key={`ins-${idx}`} className="detail-diff-add">{ins.after}</span>
    );
    lastIdx = idx + ins.after.length;
  }
  if (lastIdx < text.length) parts.push(<span key="tail">{text.slice(lastIdx)}</span>);
  return parts.length > 0 ? parts : text;
}

/* ============================================================
   MOTION VARIANTS
   ============================================================ */

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      delay: i * 0.06,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const detailVariants = {
  hidden: { opacity: 0, x: 8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
};

/* ============================================================
   DASHBOARD COMPONENT
   ============================================================ */

export default function Dashboard() {
  const navigate = useNavigate();
  const { docName } = useParams();
  const uploadInputRef = useRef(null);

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docSearch, setDocSearch] = useState("");

  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");

  const [diffData, setDiffData] = useState(null);
  const [runId, setRunId] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeStructuralFilter, setActiveStructuralFilter] = useState("all_structural");
  const [activeMaterialFilter, setActiveMaterialFilter] = useState("all_material");
  const [selectedChangeId, setSelectedChangeId] = useState(null);
  const [viewerChange, setViewerChange] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState(null);

  const [newName, setNewName] = useState("");
  const [newVersionA, setNewVersionA] = useState(null);
  const [newVersionB, setNewVersionB] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => { fetchDocuments(); }, []);

  useEffect(() => {
    if (!docName) {
      setVersions([]);
      setSelectedA("");
      setSelectedB("");
      setDiffData(null);
      setRunId(null);
      setAiSummary(null);
      setError(null);
      return;
    }
    setVersions([]);
    setSelectedA("");
    setSelectedB("");
    setDiffData(null);
    setRunId(null);
    setAiSummary(null);
    setError(null);
    fetchVersions(docName);
  }, [docName]);

  useEffect(() => {
    if (!docName || !selectedA || !selectedB || selectedA === selectedB) return;
    runSavedComparison(docName, selectedA, selectedB);
  }, [docName, selectedA, selectedB]);

  async function fetchDocuments() {
    setDocsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/documents`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setDocsLoading(false);
    }
  }

  async function fetchVersions(name) {
    setVersionsLoading(true);
    setUploadMessage(null);
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(name)}/versions`);
      const data = await res.json();
      const nextVersions = data.versions || [];
      setVersions(nextVersions);

      if (nextVersions.length >= 2) {
        const filenames = nextVersions.map((v) => v.filename);
        const nextA = filenames.includes(selectedA) ? selectedA : nextVersions[0].filename;
        const fallbackB = nextVersions[nextVersions.length - 1].filename;
        const nextB = filenames.includes(selectedB) && selectedB !== nextA ? selectedB : fallbackB;
        setSelectedA(nextA);
        setSelectedB(nextB === nextA && nextVersions.length > 1 ? nextVersions[1].filename : nextB);
      } else if (nextVersions.length === 1) {
        setSelectedA(nextVersions[0].filename);
        setSelectedB("");
      } else {
        setSelectedA("");
        setSelectedB("");
      }
    } catch (err) {
      setError(`Failed to load versions: ${err.message}`);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function runSavedComparison(name, versionA, versionB) {
    setLoading(true);
    setError(null);
    setDiffData(null);
    setRunId(null);
    setAiSummary(null);
    try {
      const res = await fetch(
        `${API_BASE}/compare/saved?doc=${encodeURIComponent(name)}&v1=${encodeURIComponent(versionA)}&v2=${encodeURIComponent(versionB)}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Comparison failed");
      }
      const data = await res.json();
      setDiffData(data);
      setRunId(data.run?.run_id || null);
      if (data.run?.run_id) fetchAiInsights(data.run.run_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchAiInsights(nextRunId) {
    setAiLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/ai/insights?run_id=${encodeURIComponent(nextRunId)}&ai_enabled=true`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("AI summary unavailable");
      const data = await res.json();
      setAiSummary(data);
    } catch (err) {
      console.error(err);
      setAiSummary(null);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleUploadVersion() {
    if (!docName || !uploadFile) return;
    setUploading(true);
    setUploadMessage(null);
    const formData = new FormData();
    formData.append("file", uploadFile);
    try {
      const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(docName)}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }
      const data = await res.json();
      setUploadMessage(`${data.filename} uploaded`);
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
      fetchVersions(docName);
      fetchDocuments();
    } catch (err) {
      setUploadMessage(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateWorkspace() {
    if (!newName.trim() || !newVersionA || !newVersionB) return;
    setCreating(true);
    setCreateError(null);
    const formData = new FormData();
    formData.append("folder_name", newName.trim());
    formData.append("version_a", newVersionA);
    formData.append("version_b", newVersionB);
    try {
      const res = await fetch(`${API_BASE}/documents/create?folder_name=${encodeURIComponent(newName.trim())}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Workspace creation failed");
      }
      const data = await res.json();
      setNewName("");
      setNewVersionA(null);
      setNewVersionB(null);
      fetchDocuments();
      navigate(`/doc/${data.folder_name}`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const selectedDocument = useMemo(
    () => documents.find((d) => d.name === docName) || null,
    [documents, docName]
  );

  const filteredDocuments = useMemo(() => {
    if (!docSearch.trim()) return documents;
    const q = docSearch.toLowerCase();
    return documents.filter((d) => formatDocName(d.name).toLowerCase().includes(q));
  }, [docSearch, documents]);

  const changeCatalog = useMemo(() => {
    if (!diffData) {
      return { changes: [], counts: {}, structuralCount: 0, materialCount: 0, integrityCount: 0 };
    }

    const materialityByClause = new Map();
    for (const finding of diffData.materiality || []) {
      const existing = materialityByClause.get(finding.clause_id) || [];
      existing.push(finding);
      materialityByClause.set(finding.clause_id, existing);
    }

    const numericClauseIds = new Set((diffData.numeric_deltas || []).map((item) => item.clause_id));
    const integrityByClause = new Map();
    for (const alert of diffData.integrity_alerts || []) {
      const existing = integrityByClause.get(alert.clause_id) || [];
      existing.push(alert);
      integrityByClause.set(alert.clause_id, existing);
    }

    const seenSignatures = new Set();
    const changes = (diffData.changes || [])
      .filter((c) => c.clause_id !== "table-changes")
      .map((change, index) => {
        const sig = JSON.stringify([
          change.change_type,
          change.clause_id,
          change.heading || "",
          change.before_text || "",
          change.after_text || "",
        ]);
        if (seenSignatures.has(sig)) return null;
        seenSignatures.add(sig);

        const findings = materialityByClause.get(change.clause_id) || [];
        const integrityAlerts = integrityByClause.get(change.clause_id) || [];
        const categoryText = findings.map((f) => `${f.category} ${f.rationale}`.toLowerCase()).join(" ");
        const beforeRefs = extractSectionRefs(change.before_text);
        const afterRefs = extractSectionRefs(change.after_text);
        const crossReferenceChanged =
          beforeRefs.join("|").toLowerCase() !== afterRefs.join("|").toLowerCase() &&
          (beforeRefs.length > 0 || afterRefs.length > 0);
        const definitionChanged =
          findings.some((f) => String(f.category || "").toLowerCase().includes("definition")) ||
          /^definitions?/i.test(change.heading || "") ||
          /"[^"]+"\s+means/i.test(`${change.before_text || ""} ${change.after_text || ""}`);

        const riskKinds = [];
        if (findings.some((f) => String(f.category || "").toLowerCase().includes("obligation"))) riskKinds.push("obligation");
        if (numericClauseIds.has(change.clause_id) || categoryText.includes("numeric threshold")) riskKinds.push("numeric");
        if (categoryText.includes("time period") || categoryText.includes("date changed") || categoryText.includes("duration")) riskKinds.push("timing");
        if (definitionChanged) riskKinds.push("definition");
        if (crossReferenceChanged) riskKinds.push("cross_reference");
        if (integrityAlerts.length > 0) riskKinds.push("integrity");

        return {
          ...change,
          uiKey: `${change.change_type}-${change.clause_id}-${index}`,
          before: change.before_text || "",
          after: change.after_text || "",
          findings,
          integrityAlerts,
          riskKinds,
          severity: severityFromChange({ riskKinds }),
          similarity: computeSimilarity(change),
        };
      })
      .filter(Boolean);

    return {
      changes,
      counts: {
        all_structural: changes.length,
        added: countForFilter(changes, "structural", "added"),
        deleted: countForFilter(changes, "structural", "deleted"),
        modified: countForFilter(changes, "structural", "modified"),
        all_material: countForFilter(changes, "material", "all_material"),
        obligation: countForFilter(changes, "material", "obligation"),
        numeric: countForFilter(changes, "material", "numeric"),
        timing: countForFilter(changes, "material", "timing"),
        definition: countForFilter(changes, "material", "definition"),
        cross_reference: countForFilter(changes, "material", "cross_reference"),
        integrity: countForFilter(changes, "material", "integrity"),
        high_risk: countForFilter(changes, "material", "high_risk"),
      },
      structuralCount: changes.length,
      materialCount: changes.filter((c) => c.riskKinds.length > 0).length,
      integrityCount: changes.filter((c) => c.riskKinds.includes("integrity")).length,
    };
  }, [diffData]);

  const filteredChanges = useMemo(
    () => changeCatalog.changes.filter((c) => matchesActiveSelections(c, activeStructuralFilter, activeMaterialFilter)),
    [changeCatalog.changes, activeStructuralFilter, activeMaterialFilter]
  );

  useEffect(() => {
    if (filteredChanges.length === 0) {
      setSelectedChangeId(null);
      return;
    }
    if (!filteredChanges.some((c) => c.uiKey === selectedChangeId)) {
      setSelectedChangeId(filteredChanges[0].uiKey);
    }
  }, [filteredChanges, selectedChangeId]);

  const selectedChange = useMemo(
    () => filteredChanges.find((c) => c.uiKey === selectedChangeId) || null,
    [filteredChanges, selectedChangeId]
  );

  const selectedAiInsight = useMemo(() => {
    if (!selectedChange || !aiSummary?.insights) return null;
    return aiSummary.insights.find((i) => i.change_id === selectedChange.clause_id) || null;
  }, [selectedChange, aiSummary]);

  const selectedAiImpacts = useMemo(() => {
    if (!selectedChange || !aiSummary?.impacts) return [];
    return aiSummary.impacts.filter((i) => i.trigger_change_id === selectedChange.clause_id);
  }, [selectedChange, aiSummary]);

  function handleSelectDocument(name) {
    navigate(`/doc/${encodeURIComponent(name)}`);
  }

  function handleClearDocument() {
    navigate("/dashboard");
  }

  function openViewer(change) {
    setViewerChange({
      ...change,
      id: change.clause_id,
      type: change.change_type,
      risk_tags: change.riskKinds,
    });
  }

  /* Intelligent metric cards */
  const highRisk = changeCatalog.counts.high_risk || 0;

  const summaryCards = [
    {
      label: "Structural Changes",
      value: changeCatalog.structuralCount,
      helper: changeCatalog.structuralCount === 0
        ? "No clause-level modifications detected"
        : `${changeCatalog.structuralCount} clause${changeCatalog.structuralCount === 1 ? "" : "s"} with recorded changes`,
      tone: "calm",
    },
    {
      label: "High-Risk Changes",
      value: highRisk,
      helper: highRisk === 0
        ? "No material obligation shifts detected"
        : `${highRisk} critical finding${highRisk === 1 ? "" : "s"} requiring immediate review`,
      tone: "warn",
    },
    {
      label: "Integrity Alerts",
      value: changeCatalog.integrityCount,
      helper: changeCatalog.integrityCount === 0
        ? "Document integrity verified — no ghost edits"
        : `${changeCatalog.integrityCount} potential ghost edit${changeCatalog.integrityCount === 1 ? "" : "s"} flagged`,
      tone: "alert",
    },
    {
      label: "Active Versions",
      value: versions.length,
      helper: selectedA && selectedB
        ? `${selectedA} → ${selectedB}`
        : "Select two versions to begin comparison",
      tone: "calm",
    },
  ];

  return (
    <div className="dashboard-shell">
      <header className="workspace-topbar">
        <div>
          <div className="workspace-brand">ChangeSense</div>
          <div className="workspace-subtitle">Clause-level verification workspace</div>
        </div>
        <button className="workspace-logout" onClick={() => navigate("/")}>
          Log out
        </button>
      </header>

      <main className="workspace-body">
        {/* ── SIDEBAR ── */}
        <aside className="workspace-sidebar">
          <section className="sidebar-card">
            <div className="sidebar-card-head">
              <div>
                <div className="sidebar-kicker">Document Workspaces</div>
                <h2>Matter library</h2>
              </div>
              <div className="sidebar-stat">{documents.length}</div>
            </div>

            <label className="sidebar-search">
              <span>Search</span>
              <input
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
                placeholder="NDA, APA, MSA..."
              />
            </label>

            <div className="document-list">
              {docsLoading && <div className="sidebar-empty">Loading workspaces…</div>}
              {!docsLoading && filteredDocuments.length === 0 && (
                <div className="sidebar-empty">No documents match that query.</div>
              )}
              {!docsLoading &&
                filteredDocuments.map((doc) => (
                  <motion.button
                    key={doc.id}
                    className={`document-row ${docName === doc.name ? "active" : ""}`}
                    onClick={() => handleSelectDocument(doc.name)}
                    whileHover={{ x: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="document-row-main">
                      <div className="document-row-title">{formatDocName(doc.name)}</div>
                      <div className="document-row-meta">
                        <span>{doc.project}</span>
                        <span>{doc.versions} version{doc.versions !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <span className={`document-status ${String(doc.icon || "").toLowerCase()}`}>
                      {doc.status}
                    </span>
                  </motion.button>
                ))}
            </div>
          </section>

          <section className="sidebar-card">
            <div className="sidebar-card-head compact">
              <div>
                <div className="sidebar-kicker">New Comparison</div>
                <h2>Create workspace</h2>
              </div>
            </div>

            <div className="create-form">
              <label>
                <span>Document name</span>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Stock purchase agreement"
                />
              </label>
              <label>
                <span>Version A</span>
                <input
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={(e) => setNewVersionA(e.target.files?.[0] || null)}
                />
              </label>
              <label>
                <span>Version B</span>
                <input
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={(e) => setNewVersionB(e.target.files?.[0] || null)}
                />
              </label>

              {createError && <div className="inline-error">{createError}</div>}

              <button
                className="primary-action"
                disabled={!newName.trim() || !newVersionA || !newVersionB || creating}
                onClick={handleCreateWorkspace}
              >
                {creating ? "Creating…" : "Create and compare"}
              </button>
            </div>
          </section>
        </aside>

        {/* ── WORKSPACE MAIN ── */}
        <section className="workspace-main">
          {!selectedDocument ? (
            <motion.div
              className="workspace-empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="workspace-empty-icon">◈</div>
              <div className="sidebar-kicker">Verification Workspace</div>
              <h1>Select a document to begin clause-level review.</h1>
              <p>
                The workspace stays intentionally compact: documents on the left,
                version comparison and filters on the right, with no extra chrome
                competing for attention.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Hero */}
              <section className="workspace-hero">
                <div className="workspace-hero-copy">
                  <div className="sidebar-kicker">Verification Workspace</div>
                  <h1>{formatDocName(selectedDocument.name)}</h1>
                  <p>
                    Compare saved versions, apply structural and material-risk lenses,
                    and open clause proof only when you need it.
                  </p>
                </div>

                <div className="workspace-header-right">
                  <div className="summary-board">
                    {summaryCards.map((card, i) => (
                      <motion.article
                        key={card.label}
                        className={`summary-board-card ${card.tone}`}
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <span>{card.label}</span>
                        <strong>{card.value}</strong>
                        <p>{card.helper}</p>
                      </motion.article>
                    ))}
                  </div>

                  <div className="workspace-hero-actions">
                    <button className="secondary-action" onClick={handleClearDocument}>
                      All documents
                    </button>
                    <button
                      className="secondary-action"
                      disabled={!runId}
                      onClick={() =>
                        runId && window.open(`${API_BASE}/report?run_id=${encodeURIComponent(runId)}`, "_blank")
                      }
                    >
                      Export report
                    </button>
                  </div>
                </div>
              </section>

              {/* Version Studio */}
              <section className="version-studio">
                <div className="version-studio-head">
                  <div>
                    <div className="sidebar-kicker">Version Control</div>
                    <h2>Compare two saved versions</h2>
                  </div>
                  <div className="version-studio-caption">
                    <span>{versions.length} version{versions.length !== 1 ? "s" : ""} available</span>
                  </div>
                </div>

                <div className="version-toolbar">
                  <label className="version-select-field">
                    <span>Base version</span>
                    <select
                      value={selectedA}
                      onChange={(e) => setSelectedA(e.target.value)}
                      disabled={versionsLoading || versions.length === 0}
                    >
                      <option value="">Select version</option>
                      {versions.map((v) => (
                        <option key={`base-${v.filename}`} value={v.filename}>{v.filename}</option>
                      ))}
                    </select>
                  </label>

                  <div className="version-compare-chip">
                    <span className="version-marker base">A</span>
                    <span className="version-studio-divider">vs</span>
                    <span className="version-marker revised">B</span>
                  </div>

                  <label className="version-select-field">
                    <span>Revised version</span>
                    <select
                      value={selectedB}
                      onChange={(e) => setSelectedB(e.target.value)}
                      disabled={versionsLoading || versions.length === 0}
                    >
                      <option value="">Select version</option>
                      {versions.map((v) => (
                        <option key={`revised-${v.filename}`} value={v.filename}>{v.filename}</option>
                      ))}
                    </select>
                  </label>

                  <div className="version-toolbar-meta">
                    <div className="version-meta-card">
                      <span>Base</span>
                      <strong>{selectedA || "Not selected"}</strong>
                    </div>
                    <div className="version-meta-card">
                      <span>Revised</span>
                      <strong>{selectedB || "Not selected"}</strong>
                    </div>
                  </div>

                  <div className="upload-inline">
                    <label className="upload-version-input">
                      <span>Add version</span>
                      <input
                        ref={uploadInputRef}
                        type="file"
                        accept=".txt,.docx,.pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    <button
                      className="secondary-action"
                      disabled={!uploadFile || uploading}
                      onClick={handleUploadVersion}
                    >
                      {uploading ? "Uploading…" : "Add version"}
                    </button>
                  </div>
                </div>
              </section>

              {uploadMessage && <div className="inline-message">{uploadMessage}</div>}
              {selectedA && selectedB && selectedA === selectedB && (
                <div className="inline-error">Select two different versions to compare.</div>
              )}
              {error && <div className="inline-error">{error}</div>}

              {/* Filter Groups */}
              <section className="filter-groups">
                <article className="filter-card">
                  <div className="filter-card-head static">
                    <div>
                      <div className="sidebar-kicker">Structural Lens</div>
                      <h3>Structural Changes</h3>
                    </div>
                    <span className="filter-card-count">{changeCatalog.structuralCount}</span>
                  </div>

                  <div className="filter-chip-row">
                    {STRUCTURAL_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        className={`filter-chip ${activeStructuralFilter === filter.id ? "active" : ""}`}
                        onClick={() => setActiveStructuralFilter(filter.id)}
                      >
                        <span>{filter.label}</span>
                        <strong>{changeCatalog.counts[filter.id] || 0}</strong>
                      </button>
                    ))}
                  </div>
                </article>

                <article className="filter-card">
                  <div className="filter-card-head static">
                    <div>
                      <div className="sidebar-kicker">Risk Lens</div>
                      <h3>Material Risks</h3>
                    </div>
                    <span className="filter-card-count">{changeCatalog.materialCount}</span>
                  </div>

                  <div className="filter-chip-row">
                    {MATERIAL_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        className={`filter-chip ${activeMaterialFilter === filter.id ? "active" : ""}`}
                        onClick={() => setActiveMaterialFilter(filter.id)}
                      >
                        <span>{filter.label}</span>
                        <strong>{changeCatalog.counts[filter.id] || 0}</strong>
                      </button>
                    ))}
                  </div>
                </article>
              </section>

              {/* Review Grid */}
              <section className="review-grid">
                {/* Change List */}
                <div className="change-list-panel">
                  <div className="panel-head">
                    <div>
                      <div className="sidebar-kicker">Filtered Results</div>
                      <h2>{filteredChanges.length} change{filteredChanges.length !== 1 ? "s" : ""}</h2>
                    </div>
                    {loading && <span className="panel-meta">Comparing…</span>}
                    {!loading && aiLoading && <span className="panel-meta">Loading semantic layer…</span>}
                  </div>

                  <div className="change-list">
                    {loading && <div className="panel-empty">Running deterministic comparison…</div>}
                    {!loading && filteredChanges.length === 0 && (
                      <div className="panel-empty">No changes match the active filter.</div>
                    )}

                    {!loading &&
                      filteredChanges.map((change, i) => (
                        <motion.button
                          key={change.uiKey}
                          className={`change-row change-row--${change.change_type} ${selectedChangeId === change.uiKey ? "active" : ""}`}
                          onClick={() => setSelectedChangeId(change.uiKey)}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                        >
                          <div className="change-row-top">
                            <span className={`change-type ${change.change_type}`}>{change.change_type}</span>
                            <span className={`severity-pill ${change.severity}`}>{severityLabel(change.severity)}</span>
                          </div>
                          <div className="change-row-title">{change.heading || change.clause_id}</div>
                          <div className="change-row-tags">
                            {change.riskKinds.length > 0 ? (
                              change.riskKinds.slice(0, 3).map((risk) => (
                                <span key={`${change.clause_id}-${risk}`} className="risk-chip">
                                  {formatRiskLabel(risk)}
                                </span>
                              ))
                            ) : (
                              <span className="risk-chip neutral">Structural only</span>
                            )}
                          </div>
                        </motion.button>
                      ))}
                  </div>
                </div>

                {/* Detail Panel */}
                <div className="detail-panel">
                  {!selectedChange ? (
                    <div className="panel-empty">Select a change to inspect its before/after evidence.</div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedChange.uiKey}
                        variants={detailVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ display: "grid", gap: "14px" }}
                      >
                        <div className="panel-head">
                          <div>
                            <div className="sidebar-kicker">Selected Clause</div>
                            <h2>{selectedChange.heading || selectedChange.clause_id}</h2>
                          </div>
                          <button className="secondary-action" onClick={() => openViewer(selectedChange)}>
                            Open proof
                          </button>
                        </div>

                        <div className="detail-meta">
                          <span className={`change-type ${selectedChange.change_type}`}>{selectedChange.change_type}</span>
                          <span className={`severity-pill ${selectedChange.severity}`}>{severityLabel(selectedChange.severity)}</span>
                          {selectedChange.riskKinds.map((risk) => (
                            <span key={`detail-${risk}`} className="risk-chip">{formatRiskLabel(risk)}</span>
                          ))}
                        </div>

                        <div className="detail-grid">
                          <section className="detail-pane">
                            <header>Version A — Base</header>
                            <div className="detail-copy">
                              {selectedChange.change_type === "added" ? (
                                <div className="panel-empty">Clause not present in base version.</div>
                              ) : (
                                <p>{renderBeforeWithDeletions(selectedChange.before_text, selectedChange.deletions)}</p>
                              )}
                            </div>
                          </section>

                          <section className="detail-pane">
                            <header>Version B — Revised</header>
                            <div className="detail-copy">
                              {selectedChange.change_type === "deleted" ? (
                                <div className="panel-empty">Clause removed from revised version.</div>
                              ) : (
                                <p>{renderAfterWithInsertions(selectedChange.after_text, selectedChange.insertions)}</p>
                              )}
                            </div>
                          </section>
                        </div>

                        {selectedChange.findings.length > 0 && (
                          <div className="detail-section">
                            <div className="detail-section-title">Deterministic findings</div>
                            <div className="finding-list">
                              {selectedChange.findings.map((finding, idx) => (
                                <div key={`${selectedChange.clause_id}-f-${idx}`} className="finding-row">
                                  <strong>{finding.category}</strong>
                                  <span>{finding.rationale}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedChange.integrityAlerts.length > 0 && (
                          <div className="detail-section">
                            <div className="detail-section-title">Integrity alerts</div>
                            <div className="finding-list">
                              {selectedChange.integrityAlerts.map((alert, idx) => (
                                <div key={`${selectedChange.clause_id}-a-${idx}`} className="finding-row warning">
                                  <strong>{formatRiskLabel(alert.alert_type)}</strong>
                                  <span>{alert.rationale}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(selectedAiInsight || selectedAiImpacts.length > 0) && (
                          <div className="detail-section">
                            <div className="detail-section-title">Semantic appendix</div>
                            {selectedAiInsight && (
                              <div className="ai-panel">{selectedAiInsight.explanation}</div>
                            )}
                            {selectedAiImpacts.map((impact, idx) => (
                              <div key={`${impact.impacted_clause_id}-${idx}`} className="ai-panel secondary">
                                {impact.impact_summary}
                              </div>
                            ))}
                          </div>
                        )}

                        {aiSummary?.summaries?.length > 0 && (
                          <div className="detail-section">
                            <div className="detail-section-title">Run summary</div>
                            <div className="summary-bullets">
                              {aiSummary.summaries.slice(0, 2).map((summary) =>
                                (summary.bullets || []).slice(0, 2).map((bullet, idx) => (
                                  <div key={`${summary.type}-${idx}`} className="summary-bullet">{bullet}</div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      </main>

      {viewerChange && (
        <DocumentViewer
          change={viewerChange}
          aiSummary={aiSummary}
          onClose={() => setViewerChange(null)}
          canPrev={false}
          canNext={false}
        />
      )}
    </div>
  );
}
