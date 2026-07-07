const APP_VERSION = 'v0.1.3';

const state = {
  teams: 0,
  inscription: 0,
  dotation: 0,
  envelope: 0,
  rounds: [],
  customGains: [],
  mode: 'auto',
  style: 'equilibre',
  lockedIndices: [],
};

const elements = {
  teams: document.getElementById('teams'),
  inscription: document.getElementById('inscription'),
  dotation: document.getElementById('dotation'),
  distributionStyle: document.getElementById('distributionStyle'),
  calculateBtn: document.getElementById('calculateBtn'),
  printBtn: document.getElementById('printBtn'),
  shareBtn: document.getElementById('shareBtn'),
  resetAutoBtn: document.getElementById('resetAutoBtn'),
  envelopeValue: document.getElementById('envelopeValue'),
  winnerGainValue: document.getElementById('winnerGainValue'),
  statusBox: document.getElementById('statusBox'),
  customSection: document.getElementById('customSection'),
  customInputs: document.getElementById('customInputs'),
  resultsBody: document.getElementById('resultsBody'),
  resultsCards: document.getElementById('resultsCards'),
  announcementList: document.getElementById('announcementList'),
  appVersion: document.getElementById('appVersion'),
  appVersionFooter: document.getElementById('appVersionFooter'),
};

function parseInputs() {
  state.teams = Number(elements.teams.value) || 0;
  state.inscription = Number(elements.inscription.value) || 0;
  state.dotation = Number(elements.dotation.value) || 0;
  state.envelope = state.teams * state.inscription + state.dotation;
  state.style = elements.distributionStyle.value;
  state.mode = state.style === 'custom' ? 'custom' : 'auto';
}

function buildRounds() {
  const rounds = [];
  let remaining = state.teams;
  let currentRound = 1;

  while (remaining > 1) {
    const offices = remaining % 2 === 0 ? 0 : 1;
    const matchesPlayed = Math.floor(remaining / 2);
    const qualifiedNext = matchesPlayed + offices;

    rounds.push({
      round: currentRound,
      teamsStart: remaining,
      offices,
      matchesPlayed,
      winnersPaid: matchesPlayed,
    });

    remaining = qualifiedNext;
    currentRound += 1;
  }

  return rounds;
}

function buildBaseGains(rounds, style) {
  const minGain = Math.max(1, Math.round(state.inscription));
  const minGap = 5;
  const profile = {
    equilibre: { steps: [5, 5, 5, 6, 8], finalBoost: 10, weights: [1, 2, 3, 5, 8, 10], maxGap: [8, 8, 10, 12, 15, 20] },
    finale: { steps: [5, 6, 7, 8, 10], finalBoost: 15, weights: [1, 2, 3, 5, 8, 10], maxGap: [8, 10, 12, 14, 16, 22] },
    large: { steps: [4, 4, 4, 5, 5], finalBoost: 8, weights: [6, 5, 4, 3, 2, 1], maxGap: [6, 7, 8, 9, 10, 14] },
  };
  const selectedProfile = profile[style] || profile.equilibre;
  const gains = [minGain];

  for (let index = 1; index < rounds.length; index += 1) {
    const stepIndex = Math.min(index - 1, selectedProfile.steps.length - 1);
    const nextGain = gains[index - 1] + selectedProfile.steps[stepIndex];
    gains.push(index === rounds.length - 1 ? nextGain + selectedProfile.finalBoost : nextGain);
  }

  for (let index = 1; index < gains.length; index += 1) {
    gains[index] = Math.max(gains[index], gains[index - 1] + minGap);
  }

  return { gains, profile: selectedProfile };
}

function buildStyleProfile(style) {
  return {
    equilibre: { steps: [5, 5, 5, 6, 8], finalBoost: 10, weights: [1, 2, 3, 5, 8, 10], maxGap: [15, 18, 22, 25, 28, 35] },
    finale: { steps: [5, 6, 7, 8, 10], finalBoost: 15, weights: [1, 2, 3, 5, 8, 10], maxGap: [18, 20, 25, 28, 30, 40] },
    large: { steps: [3, 3, 3, 4, 4], finalBoost: 6, weights: [6, 5, 4, 3, 2, 1], maxGap: [15, 18, 20, 22, 24, 28] },
  }[style] || {
    steps: [5, 5, 5, 6, 8],
    finalBoost: 10,
    weights: [1, 2, 3, 5, 8, 10],
    maxGap: [15, 18, 22, 25, 28, 35],
  };
}

function solveExactGains(rounds, style, targetTotal, anchorGains = [], lockedIndices = []) {
  const minGain = Math.max(1, Math.round(state.inscription));
  const profile = buildStyleProfile(style);
  const preferredGains = Array.isArray(anchorGains) && anchorGains.length === rounds.length
    ? anchorGains.map((gain, index) => Math.max(minGain, Math.round(gain)))
    : buildBaseGains(rounds, style).gains;
  const matchCounts = rounds.map((round) => round.matchesPlayed);

  function search(index, remainingBudget, previousGain, builtGains) {
    if (index >= rounds.length) {
      return remainingBudget === 0 ? builtGains : null;
    }

    const minimumGain = previousGain + 1;
    const maximumGain = Math.min(1000, Math.floor(remainingBudget / Math.max(1, matchCounts[index])));
    if (minimumGain > maximumGain) {
      return null;
    }

    const preferredGain = preferredGains[index] || minimumGain;
    const candidateValues = [];
    const startValue = Math.max(minimumGain, Math.min(maximumGain, preferredGain));

    for (let candidateGain = startValue; candidateGain <= maximumGain; candidateGain += 1) {
      candidateValues.push(candidateGain);
    }
    for (let candidateGain = startValue - 1; candidateGain >= minimumGain; candidateGain -= 1) {
      candidateValues.push(candidateGain);
    }

    for (const candidateGain of candidateValues) {
      const nextRemaining = remainingBudget - candidateGain * matchCounts[index];
      if (nextRemaining < 0) {
        continue;
      }

      const nextGains = [...builtGains, candidateGain];
      const result = search(index + 1, nextRemaining, candidateGain, nextGains);
      if (result) {
        return result;
      }
    }

    return null;
  }

  const solution = search(0, targetTotal, minGain - 1, []);
  if (solution) {
    return solution;
  }

  const fallbackGains = [...preferredGains];
  for (let index = 1; index < fallbackGains.length; index += 1) {
    fallbackGains[index] = Math.max(fallbackGains[index], fallbackGains[index - 1] + 1);
  }
  return fallbackGains.slice(0, rounds.length);
}

function distributeRemainingBalance(rounds, gains, profile, targetTotal, lockedIndices = []) {
  return solveExactGains(rounds, state.style, targetTotal, gains, lockedIndices);
}

function buildAutoProposal() {
  const rounds = buildRounds();
  if (!rounds.length) {
    return { rounds: [], gainsByVictory: [], proposal: [] };
  }

  const { gains, profile } = buildBaseGains(rounds, state.style);
  const balancedGains = distributeRemainingBalance(rounds, [...gains], profile, Math.round(state.envelope));

  const proposal = rounds.map((round, index) => {
    const gainPerVictory = balancedGains[index];
    return {
      ...round,
      gainPerVictory,
      totalRound: gainPerVictory * round.matchesPlayed,
    };
  });

  return {
    rounds,
    gainsByVictory: balancedGains,
    proposal,
  };
}

function rebalanceCustomGains() {
  const rounds = state.rounds;
  const minGain = Math.max(1, Math.round(state.inscription));

  if (!rounds.length) {
    return;
  }

  const currentGains = rounds.map((round, index) => {
    const currentGain = Number.isFinite(state.customGains[index]) ? state.customGains[index] : round.gainPerVictory;
    return Math.max(minGain, currentGain);
  });

  state.customGains = currentGains;
  state.rounds = rounds.map((round, index) => ({
    ...round,
    gainPerVictory: currentGains[index],
    totalRound: currentGains[index] * round.matchesPlayed,
  }));
  renderTable();
  renderAnnouncement();
  updateSummary();
  updateStatus();
  renderCustomInputs();
}

function renderTable() {
  elements.resultsBody.innerHTML = '';
  elements.resultsCards.innerHTML = '';

  state.rounds.forEach((row) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.round}</td>
      <td>${row.teamsStart}</td>
      <td>${row.offices}</td>
      <td>${row.matchesPlayed}</td>
      <td>${row.winnersPaid}</td>
      <td>${formatCurrency(row.gainPerVictory)}</td>
      <td>${formatCurrency(row.totalRound)}</td>
    `;
    elements.resultsBody.appendChild(tr);

    const card = document.createElement('article');
    card.className = 'results-card';
    card.innerHTML = `
      <div class="results-card-head">
        <span>Tour ${row.round}</span>
        <span>${row.teamsStart} équipes</span>
      </div>
      <dl>
        <div><dt>Offices</dt><dd>${row.offices}</dd></div>
        <div><dt>Parties jouées</dt><dd>${row.matchesPlayed}</dd></div>
        <div><dt>Gagnants payés</dt><dd>${row.winnersPaid}</dd></div>
        <div><dt>Gain par victoire</dt><dd>${formatCurrency(row.gainPerVictory)}</dd></div>
        <div><dt>Total du tour</dt><dd>${formatCurrency(row.totalRound)}</dd></div>
      </dl>
    `;
    elements.resultsCards.appendChild(card);
  });
}

function renderAnnouncement() {
  elements.announcementList.innerHTML = '';
  state.rounds.forEach((round, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}re partie gagnée : ${formatCurrency(round.gainPerVictory)}`;
    elements.announcementList.appendChild(li);
  });
}

function updateSummary() {
  elements.envelopeValue.textContent = formatCurrency(state.envelope);
  const winnerGain = state.rounds.reduce((sum, round) => sum + round.gainPerVictory, 0);
  elements.winnerGainValue.textContent = formatCurrency(winnerGain);
}

function formatCurrency(value) {
  return `${Number(value).toFixed(0)} €`;
}

function updateStatus() {
  const distributed = state.rounds.reduce((sum, round) => sum + round.totalRound, 0);
  const difference = Math.round(state.envelope - distributed);
  const lastRound = state.rounds[state.rounds.length - 1];
  const previousRound = state.rounds[state.rounds.length - 2];
  const isFinalValid = !lastRound || !previousRound || lastRound.gainPerVictory > previousRound.gainPerVictory;

  if (difference === 0 && isFinalValid) {
    elements.statusBox.className = 'status status-success';
    elements.statusBox.textContent = 'Répartition cohérente : la somme distribuée correspond exactement à l’enveloppe.';
  } else if (!isFinalValid) {
    elements.statusBox.className = 'status status-danger';
    elements.statusBox.textContent = 'Répartition impossible : la finale devient inférieure à l’avant-dernière partie.';
  } else if (difference > 0) {
    elements.statusBox.className = 'status status-warning';
    elements.statusBox.textContent = `Écart : il reste ${formatCurrency(difference)} à répartir.`;
  } else {
    elements.statusBox.className = 'status status-danger';
    elements.statusBox.textContent = `Écart : le total dépasse l’enveloppe de ${formatCurrency(Math.abs(difference))}.`;
  }
}

function renderCustomInputs() {
  elements.customInputs.innerHTML = '';
  if (!state.rounds.length) {
    return;
  }

  state.rounds.forEach((round, index) => {
    const label = document.createElement('label');
    label.className = 'custom-input';

    const span = document.createElement('span');
    span.textContent = `${index + 1}re partie gagnée`;
    label.appendChild(span);

    const isFinal = index === state.rounds.length - 1;

    const inputWrap = document.createElement('div');
    inputWrap.className = isFinal ? 'custom-input-row custom-input-row--final' : 'custom-input-row';

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = String(round.gainPerVictory);
    input.dataset.index = String(index);
    input.readOnly = isFinal;
    input.addEventListener('change', handleCustomInput);
    input.addEventListener('blur', handleCustomInput);
    input.addEventListener('keydown', handleCustomInputKeydown);

    if (!isFinal) {
      const decrementBtn = document.createElement('button');
      decrementBtn.type = 'button';
      decrementBtn.className = 'custom-step-btn';
      decrementBtn.textContent = '–';
      decrementBtn.dataset.index = String(index);
      decrementBtn.dataset.step = '-5';
      decrementBtn.addEventListener('click', handleCustomStep);

      const incrementBtn = document.createElement('button');
      incrementBtn.type = 'button';
      incrementBtn.className = 'custom-step-btn';
      incrementBtn.textContent = '+';
      incrementBtn.dataset.index = String(index);
      incrementBtn.dataset.step = '5';
      incrementBtn.addEventListener('click', handleCustomStep);

      inputWrap.appendChild(decrementBtn);
      inputWrap.appendChild(input);
      inputWrap.appendChild(incrementBtn);
    } else {
      inputWrap.appendChild(input);
      const note = document.createElement('small');
      note.textContent = 'Calculé automatiquement';
      note.className = 'custom-input-note';
      inputWrap.appendChild(note);
    }

    label.appendChild(inputWrap);
    elements.customInputs.appendChild(label);
  });
}

function normalizeCustomGain(rawValue) {
  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.max(0, Math.round(numericValue));
}

function applyCustomGains() {
  const rounds = state.rounds;
  if (!rounds.length) {
    return;
  }

  const editableRounds = rounds.slice(0, -1);
  const lockedGains = editableRounds.map((round, index) => {
    const currentInput = elements.customInputs.querySelector(`input[data-index="${index}"]`);
    const value = currentInput ? normalizeCustomGain(currentInput.value) : round.gainPerVictory;
    return Math.max(0, value);
  });

  const totalFixed = editableRounds.reduce((sum, round, index) => sum + lockedGains[index] * round.matchesPlayed, 0);
  const totalRemaining = Math.round(state.envelope) - totalFixed;
  const lastRound = rounds[rounds.length - 1];
  const finalGain = Math.max(0, Math.round(totalRemaining / lastRound.matchesPlayed));

  const computedGains = [...lockedGains, finalGain];
  state.customGains = computedGains;
  state.lockedIndices = editableRounds.map((_, index) => true).concat([false]);

  state.rounds = rounds.map((round, index) => ({
    ...round,
    gainPerVictory: computedGains[index],
    totalRound: computedGains[index] * round.matchesPlayed,
  }));

  renderTable();
  renderAnnouncement();
  updateSummary();
  updateStatus();

  const finalIndex = state.rounds.length - 1;
  const finalInput = elements.customInputs.querySelector(`input[data-index="${finalIndex}"]`);
  if (finalInput) {
    finalInput.value = String(state.rounds[finalIndex].gainPerVictory);
  }
}

function commitCustomGain(input) {
  const index = Number(input.dataset.index);
  if (index === state.rounds.length - 1) {
    return;
  }

  const safeValue = normalizeCustomGain(input.value);
  input.value = String(safeValue);
  applyCustomGains();
}

function handleCustomInput(event) {
  const target = event.target;
  if (!target || target.tagName !== 'INPUT' || target.dataset.index === undefined) {
    return;
  }

  commitCustomGain(target);
}

function handleCustomInputKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    event.target.blur();
  }
}

function handleCustomStep(event) {
  const button = event.currentTarget;
  const index = Number(button.dataset.index);
  const step = Number(button.dataset.step) || 0;
  const input = elements.customInputs.querySelector(`input[data-index="${index}"]`);

  if (!input) {
    return;
  }

  const currentValue = normalizeCustomGain(input.value);
  const nextValue = Math.max(0, currentValue + step);
  input.value = String(nextValue);
  commitCustomGain(input);
}

function calculate() {
  parseInputs();
  const proposal = buildAutoProposal();
  state.rounds = proposal.proposal;
  state.customGains = proposal.gainsByVictory;
  state.lockedIndices = [];
  renderTable();
  renderAnnouncement();
  updateSummary();
  elements.customSection.classList.toggle('hidden', state.mode !== 'custom');

  if (state.mode === 'custom') {
    renderCustomInputs();
    updateStatus();
    return;
  }

  updateStatus();
}

function resetToAuto() {
  elements.distributionStyle.value = 'equilibre';
  state.mode = 'auto';
  calculate();
}

function rebalanceAutoFromCurrent() {
  if (!state.rounds.length) {
    calculate();
    return;
  }
  rebalanceCustomGains();
}

function printPage() {
  window.print();
}

function sharePage() {
  if (navigator.share) {
    navigator.share({
      title: 'Répartition des gains de pétanque',
      text: 'Voici une répartition de gains préparée automatiquement.',
      url: window.location.href,
    });
  } else {
    alert('La fonction de partage n’est pas disponible sur ce navigateur.');
  }
}

elements.calculateBtn.addEventListener('click', calculate);
elements.printBtn.addEventListener('click', printPage);
elements.shareBtn.addEventListener('click', sharePage);
if (elements.resetAutoBtn) {
  elements.resetAutoBtn.addEventListener('click', resetToAuto);
}
elements.distributionStyle.addEventListener('change', () => {
  state.mode = elements.distributionStyle.value === 'custom' ? 'custom' : 'auto';
  elements.customSection.classList.toggle('hidden', state.mode !== 'custom');
  calculate();
});

window.addEventListener('DOMContentLoaded', calculate);

// Display app version
if (elements.appVersion) {
  elements.appVersion.textContent = APP_VERSION;
}
if (elements.appVersionFooter) {
  elements.appVersionFooter.textContent = APP_VERSION;
}
