function getCurrentWeight() {

  if (!state.weightHistory.length)
    return 0;

  return Number(
    state.weightHistory[
      state.weightHistory.length - 1
    ].weight
  );
}
function getStartWeight() {
  return state.weightHistory[0].weight;
}

function getGoalWeight() {
 return state.contract.locked
  ? state.contract.goalWeight
  : state.goalWeight;
}

function showLoserModal() {
  document
    .getElementById('loserModal')
    .classList.add('open');
}

function closeLoserModal() {

  document
    .getElementById('loserModal')
    .classList.remove('open');

  state.contract.locked = false;

  saveState();
  renderAll();
}

function showMissionModal() {
  document
    .getElementById('missionModal')
    .classList.add('open');
}

function closeMissionModal() {
  document
    .getElementById('missionModal')
    .classList.remove('open');
}

function showQuitModal() {

  document.getElementById(
    'quitCurrentWeight'
  ).textContent =
    getCurrentWeight().toFixed(1) + ' kg';

  document.getElementById(
    'quitGoalWeight'
  ).textContent =
    getGoalWeight().toFixed(1) + ' kg';

  document
    .getElementById('quitModal')
    .classList.add('open');
}

function closeQuitModal() {
  document
    .getElementById('quitModal')
    .classList.remove('open');
}

function unlockContract() {

  if (
    getCurrentWeight() >=
    state.contract.goalWeight
  ) {
    state.contract.locked = false;

    saveState();
    renderAll();

    return;
  }

  showQuitModal();
}

function quitAnyway() {

  closeQuitModal();

  showLoserModal();
}

function lockContract() {

  if (!state.contract.startWeight) {
    alert("Set starting weight first");
    return;
  }

  if (!state.goalWeight) {
    alert("Set goal weight first");
    return;
  }

  state.contract = {
    locked: true,
    startWeight: state.contract.startWeight,
    goalWeight: state.goalWeight,
    lockDate: new Date().toISOString().split('T')[0]
  };

  saveState();
  renderAll();
}

function editCurrentWeight() {
  const weight = prompt(
    "Today's weight (kg)",
    getCurrentWeight()
  );

  if (!weight) return;

  state.weightHistory.push({
    date: new Date().toISOString().split('T')[0],
    weight: parseFloat(weight)
  });

  saveState();
  renderAll();
}

function editStartWeight() {

  const start = prompt(
    "Starting weight (kg)",
    state.contract.startWeight || 0
  );

  if (!start) return;

  state.contract.startWeight = parseFloat(start);

  saveState();
  renderAll();
}

function editGoalWeight() {
  const goal = prompt(
    "Goal weight (kg)",
    getGoalWeight()
  );

  if (!goal) return;

  state.goalWeight = parseFloat(goal);

  saveState();
  renderAll();
}

function addWeightEntry() {

  const weight = prompt(
    "Today's weight (kg)",
    getCurrentWeight()
  );

  if (!weight) return;

  const todayDate =
    new Date().toISOString().split('T')[0];

  const existingIndex =
    state.weightHistory.findIndex(
      w => w.date === todayDate
    );

  if (existingIndex >= 0) {

    state.weightHistory[existingIndex].weight =
      parseFloat(weight);

  } else {

    state.weightHistory.push({
      date: todayDate,
      weight: parseFloat(weight)
    });

  }

  saveState();

if (
  state.contract.locked &&
  getCurrentWeight() >= state.contract.goalWeight
) {
  showMissionModal();
}

renderAll();
}
