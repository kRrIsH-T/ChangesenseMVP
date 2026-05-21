import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './ComparisonTool.css';

const API_BASE = "/api";

export default function ComparisonTool({ mode }) {
  const navigate = useNavigate();
  const { docName } = useParams();
  const isSavedMode = mode === 'saved' && docName;

  const [versions, setVersions] = useState([]);
  const [selectedA, setSelectedA] = useState(null);
  const [selectedB, setSelectedB] = useState(null);
  const [diffData, setDiffData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState(null);
  const uploadInputRef = useRef(null);

  const filters = ['All', 'Added', 'Deleted', 'Modified', 'High Risk', 'Obligations', 'Numeric', 'Dates'];

  function fetchVersions(autoSelect = true) {
    fetch(`${API_BASE}/documents/${encodeURIComponent(docName)}/versions`)
      .then(r => r.json())
      .then(data => {
        setVersions(data.versions || []);
        if (autoSelect && data.versions && data.versions.length >= 2) {
          setSelectedA(data.versions[0].filename);
          setSelectedB(data.versions[data.versions.length - 1].filename);
        }
      })
      .catch(err => setError(`Failed to load versions: ${err.message}`));
  }

  // Fetch versions when in saved mode
  useEffect(() => {
    if (!isSavedMode) return;
    fetchVersions(true);
  }, [docName, isSavedMode]);

  async function handleUploadVersion() {
    if (!uploadFile || !docName) return;
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const resp = await fetch(`${API_BASE}/documents/${encodeURIComponent(docName)}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Upload failed');
      }
      const data = await resp.json();
      setUploadMsg(`✓ ${data.filename} added`);
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      // Refresh versions without resetting selection
      fetchVersions(false);
    } catch (err) {
      setUploadMsg(`⚠ ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  // Auto-compare when both versions are selected
  useEffect(() => {
    if (!isSavedMode || !selectedA || !selectedB || selectedA === selectedB) return;
    runSavedComparison();
  }, [selectedA, selectedB]);

  function runSavedComparison() {
    setLoading(true);
    setError(null);
    setDiffData(null);
    const url = `${API_BASE}/compare/saved?doc=${encodeURIComponent(docName)}&v1=${encodeURIComponent(selectedA)}&v2=${encodeURIComponent(selectedB)}`;
    fetch(url)
      .then(r => {
        if (!r.ok) return r.json().then(e => { throw new Error(e.detail || 'Comparison failed'); });
        return r.json();
      })
      .then(data => {
        setDiffData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }

  function handleVersionToggle(filename) {
    if (selectedA === filename) {
      setSelectedA(null);
    } else if (selectedB === filename) {
      setSelectedB(null);
    } else if (!selectedA) {
      setSelectedA(filename);
    } else if (!selectedB) {
      setSelectedB(filename);
    } else {
      // Both selected — replace B
      setSelectedB(filename);
    }
  }

  // Filter changes
  function getFilteredChanges() {
    if (!diffData) return [];
    const changes = diffData.changes || [];
    if (activeFilter === 'All') return changes;
    if (activeFilter === 'Added') return changes.filter(c => c.change_type === 'added');
    if (activeFilter === 'Deleted') return changes.filter(c => c.change_type === 'deleted');
    if (activeFilter === 'Modified') return changes.filter(c => c.change_type === 'modified');
    if (activeFilter === 'High Risk') {
      const matIds = new Set((diffData.materiality || []).map(m => m.clause_id));
      return changes.filter(c => matIds.has(c.clause_id));
    }
    if (activeFilter === 'Obligations') {
      const matIds = new Set((diffData.materiality || []).filter(m => m.category && m.category.toLowerCase().includes('obligation')).map(m => m.clause_id));
      return changes.filter(c => matIds.has(c.clause_id));
    }
    if (activeFilter === 'Numeric') {
      const numIds = new Set((diffData.numeric_deltas || []).map(n => n.clause_id));
      return changes.filter(c => numIds.has(c.clause_id));
    }
    if (activeFilter === 'Dates') {
      const matIds = new Set((diffData.materiality || []).filter(m => m.category && m.category.toLowerCase().includes('date')).map(m => m.clause_id));
      return changes.filter(c => matIds.has(c.clause_id));
    }
    return changes;
  }

  // Build materiality lookup
  function getMaterialityForClause(clauseId) {
    if (!diffData) return [];
    return (diffData.materiality || []).filter(m => m.clause_id === clauseId);
  }

  const filteredChanges = getFilteredChanges();
  const changeStats = diffData ? {
    total: (diffData.changes || []).length,
    added: (diffData.changes || []).filter(c => c.change_type === 'added').length,
    deleted: (diffData.changes || []).filter(c => c.change_type === 'deleted').length,
    modified: (diffData.changes || []).filter(c => c.change_type === 'modified').length,
    highRisk: (diffData.materiality || []).length,
  } : null;

  const displayName = docName ? docName.replace(/_/g, ' ') : 'Document Comparison';

  return (
    <div className="split-page">
      {/* NAV */}
      <nav className="ct-nav">
        <div className="ct-brand">ChangeSense</div>
        <div className="ct-links">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/dashboard'); }}>Dashboard</a>
          <a href="#" className="active">Documents</a>
          <a href="#">Archives</a>
          <a href="#">Team</a>
        </div>
        <div className="ct-actions">
          <button className="ct-btn-nav" onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
        </div>
      </nav>

      {/* HEADER */}
      <div className="ct-header-block">
        <div className="ct-title-row">
          <div className="ct-title">
            <h1>{displayName}</h1>
            {selectedA && selectedB && (
              <div className="ct-mode">
                COMPARISON MODE: <span className="ct-mode-tag">{selectedA}</span> ⇄ <span className="ct-mode-tag">{selectedB}</span>
              </div>
            )}
          </div>
          <div className="ct-controls">
            <button className="ct-btn-export">📄 Export Report</button>
            <button className="ct-btn-approve">✓ Approve Changes</button>
          </div>
        </div>

        <div className="ct-filters">
          {filters.map(f => (
            <button
              key={f}
              className={`ct-pill ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* WORKSPACE */}
      <div className="ct-workspace">
        {/* VERSION TREE SIDEBAR */}
        <div className="ct-sidebar">
          <div className="sidebar-section">
            <h3 className="sidebar-title">Version Tree</h3>
            <p className="sidebar-hint">Select two versions to compare</p>
            <div className="version-list">
              {versions.map((v, i) => {
                const isA = selectedA === v.filename;
                const isB = selectedB === v.filename;
                const isSelected = isA || isB;
                return (
                  <div
                    key={v.filename}
                    className={`version-item ${isSelected ? 'selected' : ''} ${isA ? 'is-a' : ''} ${isB ? 'is-b' : ''}`}
                    onClick={() => handleVersionToggle(v.filename)}
                  >
                    <div className="version-dot-line">
                      <div className={`version-dot ${isSelected ? 'active' : ''}`}>
                        {isA ? 'A' : isB ? 'B' : ''}
                      </div>
                      {i < versions.length - 1 && <div className="version-connector"></div>}
                    </div>
                    <div className="version-info">
                      <span className="version-name">{v.filename}</span>
                      <span className="version-meta">{v.modified} · {(v.size_bytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ADD NEW VERSION */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Add New Version</h3>
            <div className="upload-version">
              <div className={`upload-dropzone-mini ${uploadFile ? 'has-file' : ''}`}>
                <span>{uploadFile ? `📄 ${uploadFile.name}` : 'Choose file…'}</span>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept=".txt,.docx,.pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
              <button
                className="upload-btn"
                disabled={!uploadFile || uploading}
                onClick={handleUploadVersion}
              >
                {uploading ? 'Uploading…' : '↑ Upload'}
              </button>
              {uploadMsg && <div className={`upload-msg ${uploadMsg.startsWith('✓') ? 'success' : 'error'}`}>{uploadMsg}</div>}
            </div>
          </div>

          {/* CHANGE LOG */}
          {diffData && (
            <div className="sidebar-section">
              <h3 className="sidebar-title">Change Log ({filteredChanges.length})</h3>
              <div className="changelog-list">
                {filteredChanges.map((change, idx) => (
                  <div key={idx} className={`changelog-item type-${change.change_type}`}>
                    <span className={`cl-badge ${change.change_type}`}>{change.change_type}</span>
                    <span className="cl-label">{change.heading || change.clause_id}</span>
                    {getMaterialityForClause(change.clause_id).length > 0 && (
                      <span className="cl-risk">⚠</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DOCUMENT PANES */}
        <div className="ct-panes">
          {loading && (
            <div className="ct-state-msg">
              <div className="ct-spinner"></div>
              <p>Running comparison engine…</p>
            </div>
          )}

          {error && (
            <div className="ct-state-msg error">
              <p>⚠ {error}</p>
              {error.includes('empty') && <p className="ct-hint">This version file has no content. Try a different document with actual text.</p>}
            </div>
          )}

          {!loading && !error && !diffData && (
            <div className="ct-state-msg">
              <p>Select two versions from the sidebar to begin comparison.</p>
            </div>
          )}

          {!loading && !error && diffData && (
            <>
              {/* LEFT PANE */}
              <div className="ct-pane pane-left">
                <div className="pane-header">
                  <span>PREVIOUS: {selectedA}</span>
                  <span style={{color: '#94a3b8'}}>Base Version</span>
                </div>
                <div className="pane-content">
                  {filteredChanges.map((change, idx) => (
                    <div key={idx} className="clause-block">
                      {change.heading && <h4 className="clause-heading">{change.heading}</h4>}
                      {change.change_type === 'added' ? (
                        <p className="clause-placeholder">— Section not present in this version —</p>
                      ) : (
                        <p>
                          {change.deletions && change.deletions.length > 0 ? (
                            renderBeforeWithDeletions(change.before_text, change.deletions)
                          ) : (
                            change.before_text
                          )}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT PANE */}
              <div className="ct-pane pane-right">
                <div className="pane-header">
                  <span>CURRENT: {selectedB}</span>
                  <span>Active Changes: {filteredChanges.length}</span>
                </div>
                <div className="pane-content">
                  {filteredChanges.map((change, idx) => {
                    const matFindings = getMaterialityForClause(change.clause_id);
                    return (
                      <div key={idx} className="clause-block">
                        {change.heading && <h4 className="clause-heading">{change.heading}</h4>}
                        {change.change_type === 'deleted' ? (
                          <p className="clause-placeholder deleted">— Section removed in this version —</p>
                        ) : (
                          <>
                            <p>
                              {change.insertions && change.insertions.length > 0 ? (
                                renderAfterWithInsertions(change.after_text, change.insertions)
                              ) : (
                                change.after_text
                              )}
                            </p>
                            {matFindings.map((mat, mi) => (
                              <div key={mi} className="risk-warning">
                                <span className="risk-warning-title">
                                  {mat.severity?.toUpperCase()} RISK: {mat.category}
                                </span>
                                {mat.rationale}
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SUMMARY FLOAT */}
              {changeStats && (
                <div className="summary-float">
                  <h4>Comparison Summary</h4>
                  <div className="sum-row">
                    <div><span className="sum-dot add"></span>Additions</div>
                    <span className="sum-val">{String(changeStats.added).padStart(2, '0')}</span>
                  </div>
                  <div className="sum-row">
                    <div><span className="sum-dot del"></span>Deletions</div>
                    <span className="sum-val">{String(changeStats.deleted).padStart(2, '0')}</span>
                  </div>
                  <div className="sum-row">
                    <div><span className="sum-dot mod"></span>Modified</div>
                    <span className="sum-val">{String(changeStats.modified).padStart(2, '0')}</span>
                  </div>
                  <div className="sum-row">
                    <div><span className="sum-dot risk"></span>High Risk</div>
                    <span className="sum-val">{String(changeStats.highRisk).padStart(2, '0')}</span>
                  </div>
                  <div className="sum-bar">
                    <div className="sum-bar-fill" style={{ width: `${changeStats.total > 0 ? 100 : 0}%` }}></div>
                  </div>
                  <div className="sum-foot">
                    Total Changes: {changeStats.total}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Render helpers */
function renderBeforeWithDeletions(text, deletions) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;

  // Sort deletions by their position in the before text
  const sorted = deletions
    .filter(d => d.before && text.includes(d.before))
    .sort((a, b) => text.indexOf(a.before) - text.indexOf(b.before));

  for (const del of sorted) {
    const idx = text.indexOf(del.before, lastIdx);
    if (idx === -1) continue;
    // Text before the deletion
    if (idx > lastIdx) parts.push(<span key={`pre-${idx}`}>{text.slice(lastIdx, idx)}</span>);
    // The deleted span
    parts.push(<span key={`del-${idx}`} className="diff-del">{del.before}</span>);
    lastIdx = idx + del.before.length;
  }
  // Remaining text
  if (lastIdx < text.length) parts.push(<span key="tail">{text.slice(lastIdx)}</span>);
  return parts.length > 0 ? parts : text;
}

function renderAfterWithInsertions(text, insertions) {
  if (!text) return null;
  const parts = [];
  let lastIdx = 0;

  const sorted = insertions
    .filter(ins => ins.after && text.includes(ins.after))
    .sort((a, b) => text.indexOf(a.after) - text.indexOf(b.after));

  for (const ins of sorted) {
    const idx = text.indexOf(ins.after, lastIdx);
    if (idx === -1) continue;
    if (idx > lastIdx) parts.push(<span key={`pre-${idx}`}>{text.slice(lastIdx, idx)}</span>);
    parts.push(<span key={`ins-${idx}`} className="diff-add">{ins.after}</span>);
    lastIdx = idx + ins.after.length;
  }
  if (lastIdx < text.length) parts.push(<span key="tail">{text.slice(lastIdx)}</span>);
  return parts.length > 0 ? parts : text;
}
