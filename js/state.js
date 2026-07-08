// --- STATE ---
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const today = new Date();
const todayIdx = today.getDay(); // 0=Sun



function loadState() {
  try {
    const raw = localStorage.getItem('bulkDiet_v2');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    meals: defaultMeals(),
    checked: {},   // { 'Mon_breakfast': true }
    weekChecked: {}
  };
}

let state = loadState();

if (!state.weightHistory) {
  state.weightHistory = [];
}

if (state.goalWeight == null) {
  state.goalWeight = 0;
}

if (!state.contract) {
  state.contract = {
    locked: false,
    startWeight:0,
    goalWeight:0,
    lockDate: null
  };
}

if (!state.missedMeals) {
  state.missedMeals = {};
}

const weekdayKeys = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const hasOldData = Object.keys(state.checked).some(k =>
  weekdayKeys.some(day => k.startsWith(day + '_'))
);

if (hasOldData) {
  const todayDate = new Date().toISOString().split('T')[0];

  Object.keys(state.checked).forEach(key => {
    const parts = key.split('_');

    if (weekdayKeys.includes(parts[0])) {
      const mealId = parts.slice(1).join('_');

      state.checked[`${todayDate}_${mealId}`] =
        state.checked[key];

      delete state.checked[key];
    }
  });

  saveState();
}

function saveState() {
  localStorage.setItem('bulkDiet_v2', JSON.stringify(state));
}



// --- DATE / CHECKED STATE HELPERS ---
function todayKey() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isMealDone(mealId) {
  return !!state.checked[
    `${todayKey()}_${mealId}`
  ];
}
