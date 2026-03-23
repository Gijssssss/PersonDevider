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

/* ══════════════════════════════════════════
   FILE UPLOAD
══════════════════════════════════════════ */

dropZone.addEventListener('click', () => fileInput.click());
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

  previewBody.innerHTML = '';
  people.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${escHtml(p.name)}</td><td>${p.count}</td>`;
    previewBody.appendChild(tr);
  });

  show(sectionPreview);
  show(sectionOptions);
  updateValueRow();
}

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
    valueRow.classList.add('hidden');
  } else {
    valueRow.classList.remove('hidden');
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
    const card = document.createElement('div');
    card.className = 'group-card';
    card.innerHTML = `
      <div class="group-card-header">
        <h3>Group ${group.id}</h3>
        <span class="group-total-badge">👥 ${group.totalPeople}</span>
      </div>
      <div class="group-card-body">
        ${group.members
          .map(
            (m) => `
          <div class="member-row">
            <span class="member-name">${escHtml(m.name)}</span>
            <span class="member-count">${m.count}</span>
          </div>`
          )
          .join('')}
      </div>`;
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

function show(el) { el.classList.remove('hidden'); }

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
