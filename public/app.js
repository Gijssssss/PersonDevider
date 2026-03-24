/* ── State ── */
let people = [];  // [{ name, count }]
let groups = [];  // [{ id, members: [{ name, count }], totalPeople }]
let currentMode = 'count';

/* ── DOM refs ── */
const dropZone    = document.getElementById('dropZone');
const fileInput   = document.getElementById('fileInput');
const fileName    = document.getElementById('fileName');
const uploadError = document.getElementById('uploadError');

const sectionPreview  = document.getElementById('section-preview');
const previewBody     = document.getElementById('previewBody');
const totalSummary    = document.getElementById('totalSummary');
const previewSearch   = document.getElementById('previewSearch');

const sectionOptions  = document.getElementById('section-options');
const modeRadios      = document.querySelectorAll('input[name="mode"]');
const optCards        = document.querySelectorAll('.option-card');
const valueRow        = document.getElementById('valueRow');
const valueLabel      = document.getElementById('valueLabel');
const groupValue      = document.getElementById('groupValue');
const generateBtn     = document.getElementById('generateBtn');
const generateError   = document.getElementById('generateError');

const sectionResults  = document.getElementById('section-results');
const resultsSummary  = document.getElementById('resultsSummary');
const groupsGrid      = document.getElementById('groupsGrid');
const reshuffleBtn    = document.getElementById('reshuffleBtn');
const exportBtn       = document.getElementById('exportBtn');
const exportError     = document.getElementById('exportError');

/* ── Navigation ── */
const navHome    = document.getElementById('navHome');
const navSearch  = document.getElementById('navSearch');
const navProfile = document.getElementById('navProfile');

navHome.addEventListener('click', () => {
  setActiveNav(navHome);
  document.querySelector('.container').scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

navSearch.addEventListener('click', () => {
  setActiveNav(navSearch);
  if (!sectionPreview.classList.contains('d-none')) {
    sectionPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
    previewSearch.focus();
  }
});

navProfile.addEventListener('click', () => {
  setActiveNav(navProfile);
});

function setActiveNav(activeBtn) {
  [navHome, navSearch, navProfile].forEach((btn) => btn.classList.remove('active'));
  activeBtn.classList.add('active');
}

/* ══════════════════════════════════════════
   FILE UPLOAD
══════════════════════════════════════════ */

dropZone.addEventListener('click', (e) => {
  if (e.target.closest('label')) return;
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
  const total = people.reduce((s, p) => s + p.count, 0);
  totalSummary.innerHTML =
    `${people.length} entr${people.length === 1 ? 'y' : 'ies'} imported &nbsp;·&nbsp; <strong>${total} people</strong> in total`;

  renderPreviewRows(people);

  show(sectionPreview);
  show(sectionOptions);
  updateValueRow();
}

function renderPreviewRows(rows) {
  previewBody.innerHTML = '';
  rows.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${p.count}</td>`;
    previewBody.appendChild(tr);
  });
}

/* ── Preview search filter ── */
previewSearch.addEventListener('input', () => {
  const q = previewSearch.value.trim().toLowerCase();
  if (!q) {
    renderPreviewRows(people);
    return;
  }
  const filtered = people.filter((p) => p.name.toLowerCase().includes(q));
  renderPreviewRows(filtered);
});

/* ══════════════════════════════════════════
   GROUPING OPTIONS
══════════════════════════════════════════ */

modeRadios.forEach((radio) => {
  radio.addEventListener('change', () => {
    currentMode = radio.value;
    // Update visual selection on option cards
    optCards.forEach((card) => card.classList.remove('selected'));
    radio.closest('.option-card').classList.add('selected');
    updateValueRow();
  });
});

// Also handle clicks on the entire card label
optCards.forEach((card) => {
  card.addEventListener('click', () => {
    const radio = card.querySelector('input[type=radio]');
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
  });
});

function updateValueRow() {
  if (currentMode === 'auto') {
    valueRow.classList.add('d-none');
  } else {
    valueRow.classList.remove('d-none');
    valueLabel.textContent =
      currentMode === 'count' ? 'Number of groups:' : 'People per group:';
    groupValue.value = currentMode === 'count' ? '4' : '8';
    groupValue.min = 1;
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
    numGroups = Math.max(1, Math.ceil(total / size));
  } else {
    // Auto: aim for groups of 6–8 people
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
  const total = people.reduce((s, p) => s + p.count, 0);
  const sizes = groups.map((g) => g.totalPeople);
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);

  resultsSummary.innerHTML =
    `${groups.length} group${groups.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ` +
    `${total} people total &nbsp;·&nbsp; ` +
    `group sizes: <strong>${minSize}–${maxSize}</strong> people`;

  groupsGrid.innerHTML = '';
  groups.forEach((group) => {
    const col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-lg-4';
    col.innerHTML = `
      <div class="card h-100">
        <div class="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h3 class="h6 mb-0 fw-bold">Group ${group.id}</h3>
          <span class="badge bg-light text-primary">👥 ${group.totalPeople}</span>
        </div>
        <div class="card-body p-2">
          ${group.members
            .map(
              (m) => `
            <div class="d-flex justify-content-between align-items-center px-2 py-1 mb-1 rounded bg-light">
              <span class="fw-medium">${escHtml(m.name)}</span>
              <span class="badge bg-secondary">${m.count}</span>
            </div>`
            )
            .join('')}
        </div>
        <div class="card-footer d-flex justify-content-end gap-2 bg-light">
          <button class="btn btn-sm btn-primary icon-btn-edit" title="Edit group" aria-label="Edit group ${group.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
          </button>
          <button class="btn btn-sm btn-secondary icon-btn-link" title="Copy group" aria-label="Copy group ${group.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="btn btn-sm btn-warning icon-btn-block" title="Clear group" aria-label="Clear group ${group.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
          </button>
          <button class="btn btn-sm btn-danger icon-btn-delete" title="Delete group" aria-label="Delete group ${group.id}" data-group-id="${group.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;

    // Delete group handler
    col.querySelector('.icon-btn-delete').addEventListener('click', () => {
      groups = groups.filter((g) => g.id !== group.id);
      if (groups.length === 0) {
        sectionResults.classList.add('d-none');
      } else {
        renderGroups();
      }
    });

    groupsGrid.appendChild(col);
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

  // Re-derive numGroups from current mode/value in case user changed it
  if (currentMode === 'count') {
    numGroups = Math.max(1, parseInt(groupValue.value) || groups.length);
  } else if (currentMode === 'size') {
    const size = Math.max(1, parseInt(groupValue.value) || 1);
    numGroups = Math.max(1, Math.ceil(total / size));
  }

  groups = buildGroups(shuffled, numGroups);
  renderGroups();
});

/* ── Export ── */
exportBtn.addEventListener('click', exportToExcel);

async function exportToExcel() {
  setError(exportError, '');
  exportBtn.disabled = true;
  exportBtn.textContent = '⏳ Exporting…';

  try {
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(exportError, err.error || 'Export failed.');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'groups.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    setError(exportError, 'Network error – could not reach the server.');
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = '⬇ Export to Excel';
  }
}

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */

function show(el) { el.classList.remove('d-none'); }

function setError(el, msg) {
  if (msg) {
    el.textContent = msg;
    el.classList.remove('d-none');
  } else {
    el.textContent = '';
    el.classList.add('d-none');
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
