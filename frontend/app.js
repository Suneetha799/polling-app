/* ==========================================================
   Pollhaus — Frontend logic
   Handles: poll creation, voting, results, deletion.
   Uses localStorage to remember which polls this browser
   has already voted on (supplements server-side IP check).
   ========================================================== */

// API base — same origin since Flask serves the frontend
const API = '';

// Track which polls this browser has voted on (client-side)
const VOTED_KEY = 'pollhaus_voted_polls';
function getVotedPolls() {
  try {
    return JSON.parse(localStorage.getItem(VOTED_KEY) || '{}');
  } catch { return {}; }
}
function markVoted(pollId, optionIndex) {
  const voted = getVotedPolls();
  voted[pollId] = optionIndex;
  localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
}
function hasVoted(pollId) {
  return pollId in getVotedPolls();
}
function getVotedOption(pollId) {
  return getVotedPolls()[pollId];
}
function clearVoted(pollId) {
  const voted = getVotedPolls();
  delete voted[pollId];
  localStorage.setItem(VOTED_KEY, JSON.stringify(voted));
}

// DOM refs
const $form         = document.getElementById('poll-form');
const $question     = document.getElementById('question-input');
const $optionsBox   = document.getElementById('options-container');
const $addOptionBtn = document.getElementById('add-option-btn');
const $formError    = document.getElementById('form-error');
const $pollsBox     = document.getElementById('polls-container');
const $emptyState   = document.getElementById('empty-state');
const $toast        = document.getElementById('toast');

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 4;

// ----------------------------------------------------------
// Toast
// ----------------------------------------------------------
let toastTimer;
function toast(message, kind = 'default') {
  $toast.textContent = message;
  $toast.className = 'toast show' + (kind !== 'default' ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $toast.className = 'toast';
  }, 3000);
}

// ----------------------------------------------------------
// Option input rendering
// ----------------------------------------------------------
function renderOptionInputs(count = MIN_OPTIONS) {
  $optionsBox.innerHTML = '';
  for (let i = 0; i < count; i++) addOptionInput('', false);
  updateOptionButtons();
}

function addOptionInput(value = '', focus = true) {
  const idx = $optionsBox.children.length;
  if (idx >= MAX_OPTIONS) return;

  const row = document.createElement('div');
  row.className = 'option-row';
  row.innerHTML = `
    <span class="option-badge">${String.fromCharCode(65 + idx)}</span>
    <input
      type="text"
      class="option-input"
      placeholder="Option ${idx + 1}"
      maxlength="100"
      autocomplete="off"
      value=""
    />
    <button type="button" class="remove-option-btn" aria-label="Remove option">×</button>
  `;
  const input = row.querySelector('.option-input');
  input.value = value;

  row.querySelector('.remove-option-btn').addEventListener('click', () => {
    if ($optionsBox.children.length <= MIN_OPTIONS) return;
    row.remove();
    relabelOptions();
    updateOptionButtons();
  });

  $optionsBox.appendChild(row);
  if (focus) input.focus();
  updateOptionButtons();
}

function relabelOptions() {
  [...$optionsBox.children].forEach((row, i) => {
    row.querySelector('.option-badge').textContent = String.fromCharCode(65 + i);
    row.querySelector('.option-input').placeholder = `Option ${i + 1}`;
  });
}

function updateOptionButtons() {
  const count = $optionsBox.children.length;
  $addOptionBtn.disabled = count >= MAX_OPTIONS;
  $addOptionBtn.textContent = count >= MAX_OPTIONS
    ? '✓ Maximum 4 options'
    : '+ Add option';
  [...$optionsBox.querySelectorAll('.remove-option-btn')].forEach(btn => {
    btn.disabled = count <= MIN_OPTIONS;
  });
}

$addOptionBtn.addEventListener('click', () => addOptionInput());

// ----------------------------------------------------------
// Form submission — create poll
// ----------------------------------------------------------
$form.addEventListener('submit', async (e) => {
  e.preventDefault();
  $formError.textContent = '';

  const question = $question.value.trim();
  const options = [...$optionsBox.querySelectorAll('.option-input')]
    .map(i => i.value.trim());
  const filled = options.filter(Boolean);

  // Client-side validation
  if (!question) {
    $formError.textContent = 'Please write a question.';
    $question.focus();
    return;
  }
  if (filled.length < MIN_OPTIONS) {
    $formError.textContent = `Please provide at least ${MIN_OPTIONS} options.`;
    return;
  }
  if (new Set(filled.map(o => o.toLowerCase())).size !== filled.length) {
    $formError.textContent = 'Options must be unique.';
    return;
  }

  try {
    const res = await fetch(`${API}/polls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, options: filled }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create poll');

    // Reset form
    $form.reset();
    renderOptionInputs(MIN_OPTIONS);
    toast('Poll published', 'success');
    loadPolls();
  } catch (err) {
    $formError.textContent = err.message;
    toast(err.message, 'error');
  }
});

// ----------------------------------------------------------
// Load & render all polls
// ----------------------------------------------------------
async function loadPolls() {
  try {
    const res = await fetch(`${API}/polls`);
    const polls = await res.json();
    if (!res.ok) throw new Error(polls.error || 'Failed to load polls');
    renderPolls(polls);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderPolls(polls) {
  $pollsBox.innerHTML = '';
  if (!polls.length) {
    $emptyState.hidden = false;
    return;
  }
  $emptyState.hidden = true;
  polls.forEach(poll => $pollsBox.appendChild(buildPollCard(poll)));
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function buildPollCard(poll) {
  const card = document.createElement('article');
  card.className = 'poll-card';
  card.dataset.pollId = poll.id;

  const voted = hasVoted(poll.id);
  const votedOption = getVotedOption(poll.id);

  card.innerHTML = `
    <header class="poll-card-header">
      <div class="poll-meta">
        <span>${formatDate(poll.createdAt)}</span>
        <span>·</span>
        <span class="total-votes">${poll.totalVotes} vote${poll.totalVotes === 1 ? '' : 's'}</span>
      </div>
      <button class="delete-btn" data-action="delete">DELETE</button>
    </header>

    <h3 class="poll-question">${escapeHtml(poll.question)}</h3>

    <div class="poll-body"></div>
  `;

  const body = card.querySelector('.poll-body');

  if (voted) {
    body.appendChild(buildResults(poll, votedOption));
  } else {
    body.appendChild(buildVoteButtons(poll));
  }

  // Delete handler
  card.querySelector('[data-action="delete"]').addEventListener('click', () =>
    handleDelete(poll.id)
  );

  return card;
}

function buildVoteButtons(poll) {
  const wrap = document.createElement('div');
  wrap.className = 'vote-options';
  poll.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'vote-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => handleVote(poll.id, i));
    wrap.appendChild(btn);
  });
  return wrap;
}

function buildResults(poll, votedIndex) {
  const wrap = document.createElement('div');
  wrap.className = 'results-list';

  // Find the max votes to highlight winner (only if total > 0)
  const max = Math.max(...poll.options.map(o => o.votes));
  const winnerExists = poll.totalVotes > 0;

  poll.options.forEach((opt, i) => {
    const isWinning = winnerExists && opt.votes === max;
    const row = document.createElement('div');
    row.className = 'result-row';
    row.style.animationDelay = `${i * 80}ms`;
    row.innerHTML = `
      <div class="result-header">
        <span class="result-text ${isWinning ? 'winning' : ''}">
          ${escapeHtml(opt.text)}
        </span>
        <span class="result-numbers">
          <span class="percent">${opt.percentage}%</span>
          <span>· ${opt.votes} vote${opt.votes === 1 ? '' : 's'}</span>
        </span>
      </div>
      <div class="result-bar-track">
        <div class="result-bar-fill ${isWinning ? 'winning' : ''}" style="width: 0%"></div>
      </div>
    `;
    // Animate bar fill after paint
    requestAnimationFrame(() => {
      row.querySelector('.result-bar-fill').style.width = `${opt.percentage}%`;
    });
    wrap.appendChild(row);
  });

  if (typeof votedIndex === 'number') {
    const badge = document.createElement('div');
    badge.className = 'voted-badge';
    badge.textContent = `✓ You voted: ${poll.options[votedIndex]?.text || '—'}`;
    wrap.appendChild(badge);
  }

  return wrap;
}

// ----------------------------------------------------------
// Voting
// ----------------------------------------------------------
async function handleVote(pollId, optionIndex) {
  if (hasVoted(pollId)) {
    toast('You have already voted on this poll.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/polls/${pollId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionIndex }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Vote failed');

    markVoted(pollId, optionIndex);
    toast('Vote recorded', 'success');

    // Replace card in-place with results view
    const card = document.querySelector(`[data-poll-id="${pollId}"]`);
    if (card) card.replaceWith(buildPollCard(data));
  } catch (err) {
    // If server says already voted, sync local state
    if (/already voted/i.test(err.message)) {
      // Best-effort: refresh list so we render results view
      loadPolls();
    }
    toast(err.message, 'error');
  }
}

// ----------------------------------------------------------
// Deletion
// ----------------------------------------------------------
async function handleDelete(pollId) {
  if (!confirm('Delete this poll? This cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/polls/${pollId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');

    clearVoted(pollId);
    toast('Poll deleted', 'success');

    // Animate out + remove
    const card = document.querySelector(`[data-poll-id="${pollId}"]`);
    if (card) {
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'translateY(-8px)';
      setTimeout(loadPolls, 300);
    } else {
      loadPolls();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ----------------------------------------------------------
// Init
// ----------------------------------------------------------
renderOptionInputs(MIN_OPTIONS);
loadPolls();
