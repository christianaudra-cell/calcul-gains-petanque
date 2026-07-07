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
  const minGap = 5;
  const profile = buildStyleProfile(style);
  const preferredGains = Array.isArray(anchorGains) && anchorGains.length === rounds.length
    ? anchorGains.map((gain, index) => Math.max(minGain, Math.round(gain)))
    : buildBaseGains(rounds, style).gains;
  const matchCounts = rounds.map((round) => round.matchesPlayed);
  const memo = new Map();

  function minimumPossibleTotal(index, prevGain) {
    if (index >= rounds.length) {
      return 0;
    }
    const nextGain = prevGain + minGap;
    return nextGain * matchCounts[index] + minimumPossibleTotal(index + 1, nextGain);
  }

  function maximumPossibleTotal(index, prevGain) {
    if (index >= rounds.length) {
      return 0;
    }
    const maxGap = index === rounds.length - 1
      ? profile.maxGap[Math.min(index, profile.maxGap.length - 1)] + profile.finalBoost
      : profile.maxGap[Math.min(index, profile.maxGap.length - 1)];
    const nextGain = prevGain + maxGap;
    return nextGain * matchCounts[index] + maximumPossibleTotal(index + 1, nextGain);
  }

  function search(index, remainingBudget, prevGain) {
    const key = `${index}:${remainingBudget}:${prevGain}`;
    if (memo.has(key)) {
      return memo.get(key);
    }
    if (index >= rounds.length) {
      return remainingBudget === 0 ? [] : null;
    }

    const lowerBound = index === 0 ? minGain : Math.max(minGain, prevGain - minGap);
    const maxGap = index === rounds.length - 1
      ? profile.maxGap[Math.min(index, profile.maxGap.length - 1)] + profile.finalBoost
      : profile.maxGap[Math.min(index, profile.maxGap.length - 1)];
    const upperBound = Math.min(1000, prevGain + maxGap, Math.floor(remainingBudget / Math.max(1, matchCounts[index])));
    if (lowerBound > upperBound) {
      memo.set(key, null);
      return null;
    }

    const minimumFuture = minimumPossibleTotal(index + 1, lowerBound);
    const maximumFuture = maximumPossibleTotal(index + 1, upperBound);
    if (remainingBudget < minimumFuture || remainingBudget > maximumFuture + upperBound * matchCounts[index]) {
      memo.set(key, null);
      return null;
    }

    const lockedValue = lockedIndices[index] ? Math.max(minGain, Math.round(preferredGains[index])) : null;
    const candidateValues = lockedValue === null
      ? Array.from({ length: upperBound - lowerBound + 1 }, (_, offset) => lowerBound + offset)
      : [Math.max(lowerBound, Math.min(upperBound, lockedValue))];

    const orderedCandidates = candidateValues
      .map((candidateGain) => ({ candidateGain, distance: Math.abs(candidateGain - (preferredGains[index] || candidateGain)) }))
      .sort((left, right) => left.distance - right.distance);

    for (const { candidateGain } of orderedCandidates) {
      const nextRemaining = remainingBudget - candidateGain * matchCounts[index];
      if (nextRemaining < 0) {
        continue;
      }

      const rest = search(index + 1, nextRemaining, candidateGain);
      if (!rest) {
        continue;
      }

      memo.set(key, [candidateGain, ...rest]);
      return memo.get(key);
    }

    memo.set(key, null);
    return null;
  }

  return search(0, targetTotal, 0) || preferredGains.slice(0, rounds.length);
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

  if (difference === 0) {
    elements.statusBox.className = 'status status-success';
    elements.statusBox.textContent = 'Répartition cohérente : la somme distribuée correspond exactement à l’enveloppe.';
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
    label.innerHTML = `
      <span>${index + 1}re partie gagnée</span>
      <input type="number" min="0" step="1" inputmode="numeric" value="${round.gainPerVictory}" data-index="${index}" />
    `;
    elements.customInputs.appendChild(label);
  });
}

function handleCustomInput(event) {
  const target = event.target;
  if (target.tagName !== 'INPUT' || target.dataset.index === undefined) {
    return;
  }

  const index = Number(target.dataset.index);
  const roundedValue = Number.isFinite(Number(target.value)) ? Math.round(Number(target.value)) : 0;
  const safeValue = Math.max(0, roundedValue);

  target.value = String(safeValue);
  state.customGains[index] = safeValue;
  state.lockedIndices[index] = true;

  state.rounds = state.rounds.map((round, roundIndex) => {
    const gainPerVictory = roundIndex === index ? safeValue : round.gainPerVictory;
    return {
      ...round,
      gainPerVictory,
      totalRound: gainPerVictory * round.matchesPlayed,
    };
  });

  renderTable();
  renderAnnouncement();
  updateSummary();
  updateStatus();
  renderCustomInputs();
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
elements.customInputs.addEventListener('input', handleCustomInput);
elements.distributionStyle.addEventListener('change', () => {
  state.mode = elements.distributionStyle.value === 'custom' ? 'custom' : 'auto';
  elements.customSection.classList.toggle('hidden', state.mode !== 'custom');
  calculate();
});

window.addEventListener('DOMContentLoaded', calculate);
