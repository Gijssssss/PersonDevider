/* ── State ── */
let people = [];
let groups = [];
let currentMode = 'count';

/* ── DOM refs ── */
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const fileName    = document.getElementById('fileName');
const uploadError = document.getElementById('uploadError');
const browseBtn   = document.getElementById('browseBtnNew');

const insightsCount  = document.getElementById('insightsCount');
const insightsDetail = document.getElementById('insightsDetail');

const changeStrategyBtn = document.getElementById('changeStrategyBtn');
const strategyOptions   = document.getElementById('section-options');
const strategyName      = document.getElementById('strategyName');
const modeRadios        = document.querySelectorAll('input[name="mode"]');
const optCards          = document.querySelectorAll('.option-card');
const valueRow          = document.getElementById('valueRow');
const valueLabel        = document.getElementById('valueLabel');
const groupValue        = document.getElementById('groupValue');
const generateError     = document.getElementById('generateError');

const sectionPreview = document.getElementById('section-preview');
const previewBody    = document.getElementById('previewBody');
const previewSearch  = document.getElementById('previewSearch');
const exportDraftBtn = document.getElementById('exportDraftBtn');
const cleanDataBtn   = document.getElementById('cleanDataBtn');

const ctaSection = document.getElementById('ctaSection');
const ctaDesc    = document.getElementById('ctaDesc');
const generateBtn = document.getElementById('generateBtn');

const sectionResults = document.getElementById('section-results');
const resultsSummary = document.getElementById('resultsSummary');
const groupsGrid     = document.getElementById('groupsGrid');
const reshuffleBtn   = document.getElementById('reshuffleBtn');
const exportBtn      = document.getElementById('exportBtn');
const exportError    = document.getElementById('exportError');

const fabBtn = document.getElementById('fabBtn');

/* ── Strategy toggle ── */
changeStrategyBtn.addEventListener('click', (e) => {
  e.preventDefault();
  const isOpen = !strategyOptions.classList.contains('hidden');
  strategyOptions.classList.toggle('hidden', isOpen);
  changeStrategyBtn.textContent = isOpen ? 'Change Strategy →' : 'Hide Options ↑';
});

/* ── FAB scrolls to top ── */
fabBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── Browse button ── */
browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

/* ══════════════════════════════════════════
   FILE UPLOAD
══════════════════════════════════════════ */

dropZone.addEventListener('click', (e) => {
  if (e.target.closest('.browse-btn')) return;
  fileInput.click();
});
dropZone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

async function processFile(file) {
  setError(uploadError, '');
  fileName.textContent = file.name;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setError(uploadError, data.error || 'Upload failed.');
      return;
    }

    people = data.people;
    showPreview();
  } catch (err) {
    setError(uploadError, 'Network error – could not reach the server.');
  }
}

function showPreview() {
  const total   = people.reduce((s, p) => s + p.count, 0);
  const entries = people.length;

  insightsCount.textContent  = total;
  insightsDetail.textContent = `${entries} unique entr${entries === 1 ? 'y' : 'ies'} found in current buffer.`;
  ctaDesc.textContent = `The divider will process ${total} people into balanced segments based on your current settings.`;

  renderPreviewRows(people);

  show(sectionPreview);
  show(ctaSection);
  updateValueRow();
}

function renderPreviewRows(rows) {
  previewBody.innerHTML = '';
  rows.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="table-index">${String(i + 1).padStart(2, '0')}</td>
      <td class="table-name">${escHtml(p.name)}</td>
      <td>
        <span class="group-size-chip">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          ${p.count}
        </span>
      </td>
      <td class="table-actions">
        <button class="table-action-btn delete-person-btn" title="Remove entry" aria-label="Remove ${escHtml(p.name)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </td>`;

    tr.querySelector('.delete-person-btn').addEventListener('click', () => {
      people = people.filter((_, idx) => idx !== i);
      showPreview();
    });

    previewBody.appendChild(tr);
  });
}

/* ── Preview search filter ── */
previewSearch.addEventListener('input', () => {
  const q = previewSearch.value.trim().toLowerCase();
  if (!q) { renderPreviewRows(people); return; }
  const filtered = people.filter((p) => p.name.toLowerCase().includes(q));
  renderPreviewRows(filtered);
});

/* ── Export Draft: downloads current people list as CSV ── */
exportDraftBtn.addEventListener('click', () => {
  if (people.length === 0) return;
  const lines = ['Name,Group Size', ...people.map((p) => `"${p.name.replace(/"/g, '""')}",${p.count}`)];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'draft.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* ── Clean Data: resets to upload state ── */
cleanDataBtn.addEventListener('click', () => {
  if (!confirm('Clear all imported data?')) return;
  people = [];
  groups = [];
  fileName.textContent = '';
  fileInput.value      = '';
  insightsCount.textContent  = '0';
  insightsDetail.textContent = 'Upload a file to begin.';
  hide(sectionPreview);
  hide(ctaSection);
  hide(sectionResults);
});

/* ══════════════════════════════════════════
   GROUPING OPTIONS
══════════════════════════════════════════ */

const strategyLabels = { count: 'Balanced Count', size: 'People per Group', auto: 'Auto-Balance' };

modeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    currentMode = radio.value;
    optCards.forEach((card) => card.classList.remove('selected'));
    radio.closest('.option-card').classList.add('selected');
    strategyName.textContent = strategyLabels[currentMode] || 'Balanced Count';
    updateValueRow();
  });
});

optCards.forEach((card) => {
  card.addEventListener('click', () => {
    const radio = card.querySelector('input[type=radio]');
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  });
});

function updateValueRow() {
  if (currentMode === 'auto') {
    valueRow.classList.add('hidden');
  } else {
    valueRow.classList.remove('hidden');
    valueLabel.textContent = currentMode === 'count' ? 'Number of groups:' : 'People per group:';
    groupValue.value = currentMode === 'count' ? '4' : '8';
    groupValue.min   = 1;
  }
}

generateBtn.addEventListener('click', generateGroups);

function generateGroups() {
  setError(generateError, '');

  if (people.length === 0) {
    setError(generateError, 'Please upload a file first.');
    return;
  }

  const total = people.reduce((s, p) => s + p.count, 0);
  let numGroups;

  if (currentMode === 'count') {
    numGroups = Math.max(1, parseInt(groupValue.value) || 1);
    if (numGroups > people.length) {
      setError(generateError, `Cannot create ${numGroups} groups – only ${people.length} entries available.`);
      return;
    }
  } else if (currentMode === 'size') {
    const size = Math.max(1, parseInt(groupValue.value) || 1);
    numGroups  = Math.max(1, Math.ceil(total / size));
  } else {
    // Auto: aim for groups of ~7 people
    numGroups = Math.max(1, Math.round(total / 7));
  }

  groups = buildGroups(people, numGroups);
  renderGroups();
}

/**
 * Greedy First-Fit Decreasing bin-packing.
 * Sorts entries by count DESC, then assigns each to the group with the
 * smallest current total – this produces well-balanced groups.
 */
function buildGroups(entries, numGroups) {
  const grps = Array.from({ length: numGroups }, (_, i) => ({
    id: i + 1,
    members: [],
    totalPeople: 0,
  }));

  const sorted = [...entries].sort((a, b) => b.count - a.count);

  for (const person of sorted) {
    const target = grps.reduce((min, g) => (g.totalPeople < min.totalPeople ? g : min));
    target.members.push(person);
    target.totalPeople += person.count;
  }

  return grps;
}

/* ══════════════════════════════════════════
   RENDER GROUPS
══════════════════════════════════════════ */

function renderGroups() {
  const total   = people.reduce((s, p) => s + p.count, 0);
  const sizes   = groups.map((g) => g.totalPeople);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);

  resultsSummary.innerHTML =
    `${groups.length} group${groups.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ` +
    `${total} people total &nbsp;·&nbsp; ` +
    `sizes: <strong>${minSize}–${maxSize}</strong>`;

  groupsGrid.innerHTML = '';
  groups.forEach((group) => {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-card-header">
        <span class="group-card-title">Group ${group.id}</span>
        <span class="group-card-badge">👥 ${group.totalPeople}</span>
      </div>
      <div class="group-card-body">
        ${group.members.map((m) => `
          <div class="group-member">
            <span class="group-member-name">${escHtml(m.name)}</span>
            <span class="group-member-count">${m.count}</span>
          </div>`).join('')}
      </div>
      <div class="group-card-footer">
        <button class="group-action-btn danger icon-btn-delete" title="Delete group" aria-label="Delete group ${group.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>`;

    card.querySelector('.icon-btn-delete').addEventListener('click', () => {
      groups = groups.filter((g) => g.id !== group.id);
      if (groups.length === 0) {
        hide(sectionResults);
      } else {
        renderGroups();
      }
    });

    groupsGrid.appendChild(card);
  });

  show(sectionResults);
  sectionResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── Reshuffle ── */
reshuffleBtn.addEventListener('click', () => {
  // Fisher-Yates shuffle for unbiased randomization
  const shuffled = [...people];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const total = shuffled.reduce((s, p) => s + p.count, 0);
  let numGroups = groups.length;

  if (currentMode === 'count') {
    numGroups = Math.max(1, parseInt(groupValue.value) || groups.length);
  } else if (currentMode === 'size') {
    const size = Math.max(1, parseInt(groupValue.value) || 1);
    numGroups  = Math.max(1, Math.ceil(total / size));
  }

  groups = buildGroups(shuffled, numGroups);
  renderGroups();
});

/* ── Export ── */
exportBtn.addEventListener('click', exportToExcel);

async function exportToExcel() {
  setError(exportError, '');
  const origText = exportBtn.textContent;
  exportBtn.disabled  = true;
  exportBtn.textContent = '⏳ Exporting…';

  try {
    const res = await fetch('/api/export', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ groups }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(exportError, err.error || 'Export failed.');
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'groups.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError(exportError, 'Network error – could not reach the server.');
  } finally {
    exportBtn.disabled  = false;
    exportBtn.textContent = origText;
  }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function setError(el, msg) {
  if (msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
