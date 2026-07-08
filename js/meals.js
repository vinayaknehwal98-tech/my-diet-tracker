function isMealMissed(meal) {

  if (isMealDone(meal.id))
    return false;

  const now = new Date();

  const [hour, minute] =
    meal.timeVal.split(':').map(Number);

  const mealTime = new Date();

  mealTime.setHours(hour);
  mealTime.setMinutes(minute);
  mealTime.setSeconds(0);

  return now > mealTime;
}

function ensureMissedMealReason(meal) {

  const key =
    `${todayKey()}_${meal.id}`;

  if (
    !isMealMissed(meal) ||
    state.missedMeals[key] ||
    isMealDone(meal.id)
  ) return;

  const [hour, minute] =
    meal.timeVal.split(':').map(Number);

  const deadline = new Date();

  deadline.setHours(hour);
  deadline.setMinutes(minute + 30);
  deadline.setSeconds(0);

  if (new Date() > deadline) {

    state.missedMeals[key] =
      'CAUSE YOU ARE A BITCH!';

    saveState();
  }
}

function saveMissReason(mealId, value) {

  const key =
    `${todayKey()}_${mealId}`;

  if (!value.trim()) {
    delete state.missedMeals[key];
  } else {
    state.missedMeals[key] = value.trim();
  }

  saveState();
}

function toggleMealDone(mealId) {

  const k =
    `${todayKey()}_${mealId}`;

  state.checked[k] =
    !state.checked[k];

  if (state.checked[k]) {
    delete state.missedMeals[k];
  }

  saveState();
  renderAll();
}

function completedCount() {
  return state.meals.filter(m => isMealDone(m.id)).length;
}
function getCurrentStreak() {
  const dates = new Set();

  Object.keys(state.checked).forEach(key => {
    const date = key.split('_')[0];
    dates.add(date);
  });

  let streak = 0;
  let d = new Date();

  while (true) {
    const dateStr = d.toISOString().split('T')[0];

    const completedMeals = state.meals.filter(meal =>
      state.checked[`${dateStr}_${meal.id}`]
    ).length;

    if (completedMeals === state.meals.length) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}



// --- RESET ---
function resetDay() {
  const key = todayKey();
  state.meals.forEach(m => {
    delete state.checked[`${key}_${m.id}`];
  });
  saveState();
  renderAll();
  showToast('Day reset ✓');
}



// --- MODAL ---
let editingIdx = null;

function openModal(idx) {
  editingIdx = idx;
  const meal = state.meals[idx];
  document.getElementById('modalTitle').textContent = `Edit: ${meal.name}`;
  document.getElementById('editName').value = meal.name.replace(/^[\u{1F300}-\u{1FAFF}\s]+/u, '').trim();
  document.getElementById('editTime').value = meal.timeVal;
  document.getElementById('editTimeLabel').value = meal.timeLabel;
  document.getElementById('editCarbs').value = meal.carbs || '';
  document.getElementById('editFat').value = meal.fat || '';
  // Foods
  const container = document.getElementById('foodRowsContainer');
  container.innerHTML = '';
  meal.foods.forEach((f, i) => addFoodRow(f));
  document.getElementById('editModal').classList.add('open');
}

function addFoodRow(food) {
  const container = document.getElementById('foodRowsContainer');
  const div = document.createElement('div');
  div.className = 'food-row';
  div.innerHTML = `
    <input type="text" placeholder="Food name" value="${food ? food.name : ''}">
    <input type="text" placeholder="Qty" value="${food ? food.qty : ''}">
    <input type="number" placeholder="Cal" value="${food ? food.cal : ''}">
    <input type="number" placeholder="Pro" value="${food ? food.pro : ''}">
    <button class="del-item" onclick="this.parentElement.remove()">×</button>
  `;
  container.appendChild(div);
}

function saveModal() {
  const meal = state.meals[editingIdx];
  const emoji = meal.emoji;

  const name =
    document.getElementById('editName').value.trim() ||
    meal.name.replace(/^[\u{1F300}-\u{1FAFF}\s]+/u, '').trim();

  const timeVal =
    document.getElementById('editTime').value || meal.timeVal;

  const carbs = Number(document.getElementById('editCarbs').value) || 0;
  const fat   = Number(document.getElementById('editFat').value) || 0;

  const foods = [];

  document.querySelectorAll('#foodRowsContainer .food-row').forEach(row => {
    const inputs = row.querySelectorAll('input');

    const foodName = inputs[0].value.trim();
    const qty      = inputs[1].value.trim();
    const cal      = Number(inputs[2].value) || 0;
    const pro      = Number(inputs[3].value) || 0;

    if (foodName) {
      foods.push({
        name: foodName,
        qty,
        cal,
        pro
      });
    }
  });

  const totalCal = foods.reduce((sum, f) => sum + f.cal, 0);
  const totalPro = foods.reduce((sum, f) => sum + f.pro, 0);

  state.meals[editingIdx] = {
    ...meal,
    name: `${emoji} ${name}`,
    timeVal,
    timeLabel: fmt12(timeVal),
    foods,
    kcal: totalCal,
    protein: totalPro,
    carbs,
    fat
  };

  saveState();
  syncScheduleToCloudflare();
  closeModal();
  showToast('✅ Meal updated!');
  renderAll();
}
function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  editingIdx = null;
}

// Close modal on bg click
document.getElementById('editModal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});
