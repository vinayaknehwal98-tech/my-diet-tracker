// --- WORKOUT TRACKER ---
const WORKOUT_STORAGE_KEY = 'bulkWorkout_v1';

let pendingWorkoutImport = null;

function defaultWorkoutSplit() {
  return [
    workoutDay('Monday', 'Push A', 'Upper Chest + Triceps Long Head', [
      ['Incline DB Press', 4, '8-10'],
      ['Incline Barbell/Smith Press', 3, '6-8'],
      ['Low-to-High Cable Fly', 3, '12-15'],
      ['Machine Chest Press', 2, '10-12'],
      ['Overhead Rope Extension', 4, '10-12'],
      ['Cable Rope Pushdown', 3, '12-15'],
      ['Single-Arm Cable Pushdown', 2, '12-15'],
      ['Cable Crunch', 3, '12-15']
    ]),
    workoutDay('Tuesday', 'Pull A', 'Back Width + Biceps Stretch + Forearms', [
      ['Wide-Grip Lat Pulldown', 4, '8-10'],
      ['Close-Grip Neutral Pulldown', 3, '10-12'],
      ['Single-Arm Cable Lat Pulldown', 3, '10-12'],
      ['Straight-Arm Pulldown', 3, '12-15'],
      ['Seated Cable Row Light', 2, '12'],
      ['Incline DB Curl', 3, '10-12'],
      ['Cable Curl', 3, '12-15'],
      ['Wrist Curl + Reverse Wrist Curl', 2, '15-20']
    ]),
    workoutDay('Wednesday', 'Shoulders A + Legs A', 'Side/Front Delts + Quads', [
      ['DB Shoulder Press', 4, '8-10'],
      ['DB Lateral Raise', 4, '12-15'],
      ['Cable Lateral Raise', 3, '12-15'],
      ['Face Pulls', 2, '15-20'],
      ['Leg Press', 4, '10-12'],
      ['Leg Extension', 3, '12-15'],
      ['Walking Lunges', 2, '10 each leg'],
      ['Leg Curl', 2, '12-15'],
      ['Standing Calf Raise', 4, '12-20']
    ]),
    workoutDay('Thursday', 'Push B', 'Mid/Lower Chest + Triceps Heavy', [
      ['Flat Barbell Bench Press', 4, '6-8'],
      ['High-to-Low Cable Fly/Press', 3, '10-12'],
      ['Machine/Pec-Deck Fly', 3, '12-15'],
      ['Incline Machine Press', 2, '10-12'],
      ['Close-Grip Bench Press', 3, '8-10'],
      ['Reverse-Grip Pushdown', 3, '12-15'],
      ['Rope Pushdown', 2, '12-15'],
      ['Hanging Leg Raise', 3, '10-15']
    ]),
    workoutDay('Friday', 'Pull B', 'Back Thickness + Biceps Thickness + Forearms', [
      ['Chest-Supported Row / T-Bar Row', 4, '8-10'],
      ['One-Arm DB Row', 3, '10'],
      ['Seated Cable Row', 3, '10-12'],
      ['Lat Pulldown', 2, '10-12'],
      ['Preacher Curl', 3, '10-12'],
      ['Hammer Curl', 3, '10-12'],
      ['Reverse Curl', 3, '12-15'],
      ["Farmer's Carry", 2, 'rounds']
    ]),
    workoutDay('Saturday', 'Shoulders B + Legs B', 'Rear Delts + Hamstrings/Glutes', [
      ['Reverse Pec-Deck Fly', 4, '12-15'],
      ['Face Pulls', 3, '15-20'],
      ['Cable Lateral Raise', 3, '12-15'],
      ['Shrugs', 3, '10-12'],
      ['Romanian Deadlift', 4, '8-10'],
      ['Leg Curl', 4, '10-12'],
      ['Hip Thrust / Glute Bridge', 3, '10-12'],
      ['Leg Press Light', 2, '12'],
      ['Seated Calf Raise', 4, '15-20'],
      ['Plank / Russian Twists', 3, 'rounds']
    ]),
    {
      id: 'sunday_rest',
      day: 'Sunday',
      name: 'Rest',
      focus: 'Recovery',
      rest: true,
      recovery: ['Recovery', 'Eat enough', 'Sleep', 'Track weight', 'Prepare for next week'],
      exercises: []
    }
  ];
}

function workoutDay(day, name, focus, exercises) {
  return {
    id: workoutId(`${day}_${name}`),
    day,
    name,
    focus,
    rest: false,
    exercises: exercises.map(item => workoutExercise(item[0], item[1], item[2]))
  };
}

function workoutExercise(name, sets, repRange) {
  const target = `${sets} x ${repRange}`;
  return {
    id: workoutId(name),
    name,
    sets,
    repRange,
    targetText: target
  };
}

function getWorkoutState() {
  try {
    const raw = localStorage.getItem(WORKOUT_STORAGE_KEY);
    if (raw) return normalizeWorkoutState(JSON.parse(raw));
  } catch(e) {}
  return normalizeWorkoutState({});
}

function normalizeWorkoutState(value) {
  const oldSplit = value.workoutSplit;
  const oldLogs = value.workoutLogs;
  const normalized = {
    split: Array.isArray(value.split) && value.split.length
      ? normalizeImportedSplit(value.split)
      : Array.isArray(oldSplit) && oldSplit.length
        ? normalizeImportedSplit(oldSplit)
        : defaultWorkoutSplit(),
    logs: value.logs || migrateWorkoutLogs(oldLogs),
    exerciseHistory: value.exerciseHistory || {},
    settings: {
      units: value.settings?.units || 'kg',
      progressionMode: value.settings?.progressionMode || 'double_progression'
    }
  };
  normalized.exerciseHistory = buildExerciseHistory(normalized.logs);
  return normalized;
}

function migrateWorkoutLogs(oldLogs) {
  if (!oldLogs) return {};
  const logs = {};
  Object.entries(oldLogs).forEach(([date, day]) => {
    logs[date] = {
      workoutId: '',
      workoutName: '',
      dayName: '',
      exercises: {},
      completed: false,
      notes: ''
    };
    Object.values(day || {}).forEach(log => {
      const id = workoutId(log.exerciseName || log.exerciseId);
      logs[date].exercises[id] = {
        weight: Number(log.weight) || 0,
        reps: Array.isArray(log.reps) ? log.reps.map(Number).filter(Number.isFinite) : [],
        rir: log.rir ?? null,
        notes: log.notes || '',
        completed: !!log.completed,
        timestamp: log.timestamp || date
      };
    });
  });
  return logs;
}

function saveWorkoutState(workoutState) {
  const stateToSave = normalizeWorkoutState(workoutState || {});
  localStorage.setItem(WORKOUT_STORAGE_KEY, JSON.stringify(stateToSave));
}

function getTodayWorkout() {
  const workoutState = getWorkoutState();
  const todaysLog = workoutState.logs[todayKey()];
  if (todaysLog?.workoutId) {
    const selected = workoutState.split.find(workout => workout.id === todaysLog.workoutId);
    if (selected) return selected;
  }
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  return workoutState.split.find(workout => workout.day === dayName) || workoutState.split[0] || defaultWorkoutSplit()[0];
}

function getWorkoutLog(dateKey = todayKey()) {
  const workoutState = getWorkoutState();
  const workout = getTodayWorkout();
  return workoutState.logs[dateKey] || createEmptyWorkoutLog(workout);
}

function createEmptyWorkoutLog(workout) {
  return {
    workoutId: workout.id,
    workoutName: workout.name,
    dayName: workout.day,
    exercises: {},
    completed: false,
    notes: ''
  };
}

function renderWorkout() {
  const workout = getTodayWorkout();
  const status = getTodayWorkoutStatus();
  const review = getWorkoutWeeklyReview();

  if (workout.rest || !workout.exercises.length) {
    return `
      <section class="workout-hero rest">
        <div>
          <div class="workout-kicker">${escapeWorkoutHtml(workout.day)}</div>
          <h2>Rest Day</h2>
          <p>Recovery, food, sleep, weight tracking, and getting ready for the next push.</p>
        </div>
        <div class="workout-hero-actions">
          <button class="import-btn" onclick="openWorkoutImportModal()">Import Workout</button>
          <button class="import-btn" onclick="restoreDefaultWorkoutSplit()">Restore Default Split</button>
        </div>
      </section>
      <div class="workout-rest-card">
        ${workout.recovery.map(item => `<span>${escapeWorkoutHtml(item)}</span>`).join('')}
      </div>`;
  }

  return `
    <section class="workout-hero">
      <div>
        <div class="workout-kicker">Today: ${escapeWorkoutHtml(workout.day)}</div>
        <h2>${escapeWorkoutHtml(workout.name)} - ${escapeWorkoutHtml(workout.focus)}</h2>
        <p>${status.completed}/${status.total} exercises logged. X says: ${escapeWorkoutHtml(getWorkoutStatusLine())}</p>
      </div>
      <div class="workout-hero-actions">
        <button class="import-btn" onclick="openWorkoutImportModal()">Import Workout</button>
        <button class="import-btn danger" onclick="resetTodayWorkout()">Reset Today</button>
        <button class="import-btn" onclick="restoreDefaultWorkoutSplit()">Restore Default Split</button>
        <button class="import-btn" onclick="changeTodaysWorkout()">Change Today's Workout</button>
      </div>
    </section>

    <div class="workout-summary-row">
      <div><strong>${status.completionPercent}%</strong><span>complete</span></div>
      <div><strong>${status.completed}/${status.total}</strong><span>logged</span></div>
      <div><strong>${review.sessionsCompleted}/${review.trainingDays}</strong><span>sessions</span></div>
    </div>

    <div class="workout-insights">
      ${renderWorkoutInsightCards(status, review)}
    </div>

    <form class="workout-list" onsubmit="event.preventDefault(); saveWorkoutLog();">
      ${workout.exercises.map((exercise, index) => renderWorkoutExercise(exercise, index)).join('')}
      <button class="btn-save workout-save" type="submit">Save Workout</button>
    </form>`;
}

function renderWorkoutInsightCards(status, review) {
  const priority = getPriorityLift(status.workout);
  const stronger = status.volumeDelta > 0 ? 'Volume is up from last time.' : 'Beat last total volume to light this up.';
  const recovery = getWorkoutRecoveryWarning();
  return [
    ['Stronger Than Last Time', stronger],
    ['Priority Lift', priority ? priority.name : 'No priority lift today.'],
    ['Recovery Warning', recovery],
    ['Consistency', `${review.sessionsCompleted}/${review.trainingDays} sessions completed this week.`]
  ].map(card => `
    <div class="workout-insight-card">
      <span>${escapeWorkoutHtml(card[0])}</span>
      <strong>${escapeWorkoutHtml(card[1])}</strong>
    </div>`).join('');
}

function renderWorkoutExercise(exercise, index) {
  const todayLog = getWorkoutLog().exercises[exercise.id] || {};
  const history = getExerciseHistory(exercise.id);
  const last = getLastExercisePerformance(exercise.id);
  const suggestion = getProgressiveOverloadSuggestion(exercise, history);
  const pr = detectPersonalRecord(exercise, todayLog, history);
  const repsValue = Array.isArray(todayLog.reps) ? todayLog.reps.join(',') : '';
  return `
    <article class="workout-card ${todayLog.completed ? 'complete' : ''}">
      <div class="workout-card-head">
        <div>
          <div class="workout-ex-num">${index + 1}</div>
          <h3>${escapeWorkoutHtml(exercise.name)}</h3>
          <p>${escapeWorkoutHtml(exercise.targetText)}</p>
        </div>
        <label class="workout-done">
          <input type="checkbox" id="wo_done_${exercise.id}" ${todayLog.completed ? 'checked' : ''} onchange="saveWorkoutLog(true)">
          <span>Done</span>
        </label>
      </div>
      <div class="workout-meta-row">
        <span>Last: ${last ? escapeWorkoutHtml(formatWorkoutPerformance(last)) : 'No history yet'}</span>
        <span class="workout-progression">${escapeWorkoutHtml(suggestion)}</span>
      </div>
      <div class="workout-badges">
        ${pr.map(label => `<span class="pr-badge">${escapeWorkoutHtml(label)}</span>`).join('') || '<span class="progression-badge">Baseline</span>'}
      </div>
      <div class="workout-input-grid">
        <label>Weight (${getWorkoutState().settings.units})<input type="number" inputmode="decimal" step="0.5" id="wo_weight_${exercise.id}" value="${todayLog.weight ?? ''}" placeholder="0" oninput="saveWorkoutLog(true)"></label>
        <label>Reps per set<input type="text" id="wo_reps_${exercise.id}" value="${escapeWorkoutHtml(repsValue)}" placeholder="${placeholderForExercise(exercise)}" oninput="saveWorkoutLog(true)"></label>
        <label>RIR<input type="number" inputmode="numeric" id="wo_rir_${exercise.id}" value="${todayLog.rir ?? ''}" placeholder="2" oninput="saveWorkoutLog(true)"></label>
      </div>
      <textarea class="workout-notes" id="wo_notes_${exercise.id}" placeholder="Notes, form cues, machine setting..." oninput="saveWorkoutLog(true)">${escapeWorkoutHtml(todayLog.notes || '')}</textarea>
    </article>`;
}

function placeholderForExercise(exercise) {
  const target = parseSetRepTarget(exercise.targetText || exercise.repRange);
  return Array.from({ length: target.sets || exercise.sets || 3 }, () => target.min || 8).join(',');
}

function saveWorkoutLog(silent = false) {
  const workoutState = getWorkoutState();
  const workout = getTodayWorkout();
  const date = todayKey();
  const dayLog = workoutState.logs[date] || createEmptyWorkoutLog(workout);
  dayLog.workoutId = workout.id;
  dayLog.workoutName = workout.name;
  dayLog.dayName = workout.day;
  dayLog.exercises = dayLog.exercises || {};

  workout.exercises.forEach(exercise => {
    const weightValue = document.getElementById(`wo_weight_${exercise.id}`)?.value;
    const repsValue = document.getElementById(`wo_reps_${exercise.id}`)?.value;
    const rirValue = document.getElementById(`wo_rir_${exercise.id}`)?.value;
    const notes = document.getElementById(`wo_notes_${exercise.id}`)?.value || '';
    const completed = !!document.getElementById(`wo_done_${exercise.id}`)?.checked;
    const reps = parseRepsInput(repsValue);
    dayLog.exercises[exercise.id] = {
      weight: weightValue === '' ? 0 : Number(weightValue),
      reps,
      rir: rirValue === '' ? null : Number(rirValue),
      notes,
      completed,
      timestamp: new Date().toISOString()
    };
  });

  dayLog.completed = workout.exercises.length > 0 && workout.exercises.every(exercise => dayLog.exercises[exercise.id]?.completed);
  workoutState.logs[date] = dayLog;
  workoutState.exerciseHistory = buildExerciseHistory(workoutState.logs);
  saveWorkoutState(workoutState);
  if (!silent) {
    showToast('Workout saved.');
    renderAll();
  }
}

function resetTodayWorkout() {
  if (!confirm("Reset today's workout log? Older workout history stays saved.")) return;
  const workoutState = getWorkoutState();
  delete workoutState.logs[todayKey()];
  workoutState.exerciseHistory = buildExerciseHistory(workoutState.logs);
  saveWorkoutState(workoutState);
  showToast("Today's workout reset.");
  renderAll();
}

function changeTodaysWorkout() {
  const workoutState = getWorkoutState();
  const options = workoutState.split.map((workout, index) => `${index + 1}. ${workout.day} - ${workout.name}`).join('\n');
  const answer = prompt(`Choose today's workout number:\n${options}`);
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || !workoutState.split[index]) return;
  const chosen = workoutState.split[index];
  workoutState.logs[todayKey()] = createEmptyWorkoutLog(chosen);
  saveWorkoutState(workoutState);
  showToast(`Today set to ${chosen.name}.`);
  renderAll();
}

function restoreDefaultWorkoutSplit() {
  const workoutState = getWorkoutState();
  workoutState.split = defaultWorkoutSplit();
  workoutState.exerciseHistory = buildExerciseHistory(workoutState.logs);
  saveWorkoutState(workoutState);
  pendingWorkoutImport = null;
  closeWorkoutImportModal();
  showToast('Default workout split restored.');
  renderAll();
}

function parseSetRepTarget(target) {
  const value = String(target || '');
  const setsMatch = value.match(/(\d+)\s*x/i);
  const rangeMatch = value.match(/x\s*([0-9]+)(?:\s*(?:-|\/|to)\s*([0-9]+))?/i) || value.match(/([0-9]+)(?:\s*(?:-|\/|to)\s*([0-9]+))?/);
  const sets = setsMatch ? Number(setsMatch[1]) : 0;
  const min = rangeMatch ? Number(rangeMatch[1]) : 0;
  const max = rangeMatch ? Number(rangeMatch[2] || rangeMatch[1]) : min;
  return { sets, min, max };
}

function parseRepsInput(value) {
  return String(value || '')
    .split(/[,\s]+/)
    .map(v => Number(v.trim()))
    .filter(Number.isFinite)
    .filter(v => v > 0);
}

function getExerciseHistory(exerciseId) {
  const history = getWorkoutState().exerciseHistory || {};
  return (history[workoutId(exerciseId)] || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function getLastExercisePerformance(exerciseId) {
  return getExerciseHistory(exerciseId).find(item => item.date !== todayKey()) || null;
}

function calculateVolume(weight, repsArray) {
  return (Number(weight) || 0) * (Array.isArray(repsArray) ? repsArray.reduce((sum, reps) => sum + (Number(reps) || 0), 0) : 0);
}

function isCompoundExercise(exerciseName) {
  return /(press|bench|row|deadlift|squat|leg press|pulldown|thrust|lunge|carry)/i.test(exerciseName || '');
}

function getProgressiveOverloadSuggestion(exercise, history) {
  const last = (history || []).find(item => item.date !== todayKey());
  if (!last || !last.reps.length) return 'Log today to create your baseline.';

  const target = parseSetRepTarget(exercise.targetText || exercise.repRange);
  const reps = last.reps.map(Number).filter(Number.isFinite);
  const allTop = target.max && reps.length >= (target.sets || exercise.sets) && reps.slice(0, target.sets || reps.length).every(rep => rep >= target.max);
  const belowMin = target.min && reps.some(rep => rep < target.min);
  const weight = Number(last.weight) || 0;

  if (allTop) {
    const jump = isCompoundExercise(exercise.name) ? '2.5kg to 5kg' : 'a small jump';
    const nextWeight = weight ? `${trimNumber(weight + (isCompoundExercise(exercise.name) ? 2.5 : 1))}kg` : 'slightly heavier';
    return `Top range hit. Next target: ${nextWeight} x ${exercise.repRange}. Add ${jump} only if form stays clean.`;
  }

  if (belowMin) {
    return `Weight is too heavy. Keep ${weight ? `${trimNumber(weight)}kg` : 'the same weight'} and aim for minimum reps, or reduce slightly.`;
  }

  const targetReps = reps.slice(0, target.sets || reps.length);
  const minRep = Math.min(...targetReps);
  const idx = targetReps.indexOf(minRep);
  if (idx >= 0) targetReps[idx] += 1;
  return `Target today: ${weight ? `${trimNumber(weight)}kg x ` : ''}${targetReps.join(',')}. Add 1 rep before adding weight.`;
}

function detectPersonalRecord(exercise, currentLog, history) {
  if (!currentLog || !currentLog.reps || !currentLog.reps.length) return [];
  const past = (history || []).filter(item => item.date !== todayKey());
  if (!past.length) return [];

  const currentWeight = Number(currentLog.weight) || 0;
  const currentVolume = calculateVolume(currentWeight, currentLog.reps);
  const currentReps = currentLog.reps.reduce((sum, reps) => sum + reps, 0);
  const maxWeight = Math.max(...past.map(item => Number(item.weight) || 0), 0);
  const maxVolume = Math.max(...past.map(item => calculateVolume(item.weight, item.reps)), 0);
  const sameWeightBestReps = Math.max(...past.filter(item => Number(item.weight) === currentWeight).map(item => item.reps.reduce((sum, reps) => sum + reps, 0)), 0);
  const badges = [];
  if (currentVolume > maxVolume) badges.push('Volume PR');
  if (currentWeight > maxWeight) badges.push('Weight PR');
  if (currentWeight && currentReps > sameWeightBestReps && sameWeightBestReps > 0) badges.push('Rep PR');
  return badges;
}

function buildExerciseHistory(logs) {
  const history = {};
  Object.entries(logs || {}).forEach(([date, dayLog]) => {
    Object.entries(dayLog.exercises || {}).forEach(([exerciseId, log]) => {
      if (!log || (!log.completed && !log.reps?.length && !log.weight)) return;
      const id = workoutId(exerciseId);
      if (!history[id]) history[id] = [];
      history[id].push({
        date,
        exerciseId: id,
        workoutName: dayLog.workoutName,
        weight: Number(log.weight) || 0,
        reps: Array.isArray(log.reps) ? log.reps.map(Number).filter(Number.isFinite) : [],
        rir: log.rir,
        notes: log.notes || '',
        completed: !!log.completed,
        timestamp: log.timestamp || date
      });
    });
  });
  Object.keys(history).forEach(id => history[id].sort((a, b) => String(b.date).localeCompare(String(a.date))));
  return history;
}

function getTodayWorkoutStatus() {
  const workout = getTodayWorkout();
  const log = getWorkoutLog();
  const completed = Object.values(log.exercises || {}).filter(item => item.completed).length;
  const total = workout.exercises.length;
  const currentVolume = Object.values(log.exercises || {}).reduce((sum, item) => sum + calculateVolume(item.weight, item.reps), 0);
  const lastWorkoutVolume = getPreviousWorkoutVolume(workout.id);
  return {
    workout,
    completed,
    total,
    completionPercent: total ? Math.round((completed / total) * 100) : 100,
    completedExercises: completed,
    pendingExercises: workout.exercises.filter(exercise => !log.exercises[exercise.id]?.completed),
    dayLog: log,
    completedWorkout: total > 0 && completed === total,
    currentVolume,
    lastWorkoutVolume,
    volumeDelta: currentVolume - lastWorkoutVolume,
    priorityLift: getPriorityLift(workout)
  };
}

function getPreviousWorkoutVolume(workoutId) {
  const entries = Object.entries(getWorkoutState().logs || {})
    .filter(([date, log]) => date !== todayKey() && log.workoutId === workoutId)
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  if (!entries.length) return 0;
  return Object.values(entries[0][1].exercises || {}).reduce((sum, item) => sum + calculateVolume(item.weight, item.reps), 0);
}

function getPriorityLift(workout = getTodayWorkout()) {
  return (workout.exercises || []).find(exercise => isCompoundExercise(exercise.name)) || (workout.exercises || [])[0] || null;
}

function getWorkoutStatusLine() {
  const status = getTodayWorkoutStatus();
  if (status.workout.rest) return 'Rest day. Eat enough and recover.';
  if (status.completedWorkout) return 'Workout logged. Now recover and hit protein.';
  const priority = status.priorityLift;
  if (!priority) return 'Log today to create your baseline.';
  const suggestion = getProgressiveOverloadSuggestion(priority, getExerciseHistory(priority.id));
  return suggestion.includes('baseline') ? `Start with ${priority.name}. Create your baseline.` : `Beat last week by 1 rep on ${priority.name}.`;
}

function getWorkoutRecoveryWarning() {
  if (typeof getCoachContext !== 'function') return 'Fuel decides performance.';
  const ctx = getCoachContext();
  if (ctx.remaining.kcal > 900 || ctx.remaining.protein > 35) return "Underfed. Don't expect PRs without fuel.";
  if (getTodayWorkoutStatus().completedWorkout && ctx.remaining.protein > 20) return 'Post-workout protein is still pending.';
  return 'Fuel is acceptable. Train with intent.';
}

function getWorkoutWeeklyReview() {
  const workoutState = getWorkoutState();
  const now = new Date();
  let trainingDays = 0;
  let sessionsCompleted = 0;
  let exercisesLogged = 0;
  const missedWorkoutDays = [];
  let strongestLiftImprovement = null;

  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const key = dateKeyFromDate(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const workout = workoutState.split.find(item => item.day === dayName);
    if (!workout || workout.rest || !workout.exercises.length) continue;
    trainingDays++;
    const log = workoutState.logs[key];
    const doneCount = Object.values(log?.exercises || {}).filter(item => item.completed).length;
    exercisesLogged += doneCount;
    if (doneCount === workout.exercises.length) sessionsCompleted++;
    else if (key < todayKey()) missedWorkoutDays.push(dayName);
  }

  Object.values(workoutState.exerciseHistory || {}).forEach(items => {
    const sorted = items.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (sorted.length < 2) return;
    const delta = calculateVolume(sorted[0].weight, sorted[0].reps) - calculateVolume(sorted[1].weight, sorted[1].reps);
    if (delta > 0 && (!strongestLiftImprovement || delta > strongestLiftImprovement.delta)) {
      strongestLiftImprovement = { exerciseId: sorted[0].exerciseId, delta };
    }
  });

  return {
    sessionsCompleted,
    trainingDays,
    exercisesLogged,
    strongestLiftImprovement: strongestLiftImprovement ? `${humanizeWorkoutId(strongestLiftImprovement.exerciseId)} +${trimNumber(strongestLiftImprovement.delta)}kg volume` : 'No lift PR yet',
    missedWorkoutDays,
    fixForNextWeek: missedWorkoutDays.length ? 'Move the missed session to the next available day. Do not double volume.' : 'Keep matching first, then add reps.',
    summary: `${sessionsCompleted}/${trainingDays} sessions, ${exercisesLogged} exercises logged. ${missedWorkoutDays.length ? `Missed: ${missedWorkoutDays.join(', ')}.` : 'No missed training days yet.'}`
  };
}

function getWorkoutCoachContext() {
  const status = getTodayWorkoutStatus();
  const workout = status.workout;
  const priority = status.priorityLift;
  return {
    todayWorkout: workout,
    focus: workout.focus,
    exercisesCompleted: `${status.completed}/${status.total}`,
    pendingExercises: status.pendingExercises.map(exercise => exercise.name),
    priorityLift: priority ? priority.name : 'none',
    lastPerformance: priority ? getLastExercisePerformance(priority.id) : null,
    progressiveOverloadSuggestions: (workout.exercises || []).slice(0, 5).map(exercise => ({
      exercise: exercise.name,
      suggestion: getProgressiveOverloadSuggestion(exercise, getExerciseHistory(exercise.id))
    })),
    weeklyWorkoutConsistency: getWorkoutWeeklyReview()
  };
}

function openWorkoutImportModal() {
  pendingWorkoutImport = null;
  const paste = document.getElementById('workoutImportPasteArea');
  if (paste) paste.value = '';
  setWorkoutImportStatus('', '');
  renderWorkoutImportPreview(null);
  setWorkoutImportApplyEnabled(false);
  document.getElementById('workoutImportModal').classList.add('open');
}

function closeWorkoutImportModal() {
  document.getElementById('workoutImportModal').classList.remove('open');
  pendingWorkoutImport = null;
}

function handleWorkoutImportDrop(event) {
  event.preventDefault();
  document.getElementById('workoutImportDropZone').classList.remove('drag-over');
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) readWorkoutImportFile(file);
}

function handleWorkoutImportFile(input) {
  const file = input.files && input.files[0];
  if (file) readWorkoutImportFile(file);
  input.value = '';
}

function readWorkoutImportFile(file) {
  if (file.type.startsWith('image/')) {
    setWorkoutImportStatus('Image import needs AI/OCR. Paste text here if parsing fails; local parser still works.', 'loading');
    estimateWorkoutImportWithAI('');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const paste = document.getElementById('workoutImportPasteArea');
    paste.value = String(reader.result || '');
    onWorkoutPasteInput(paste);
  };
  reader.readAsText(file);
}

function onWorkoutPasteInput(textarea) {
  const split = parseWorkoutTextLocally(textarea.value);
  pendingWorkoutImport = split;
  renderWorkoutImportPreview(split);
  setWorkoutImportApplyEnabled(split.length > 0);
  setWorkoutImportStatus(split.length ? `Parsed ${split.length} workout day(s). Applying this will replace your current workout split.` : 'Paste workout text to preview it.', split.length ? 'success' : '');
}

function parseWorkoutTextLocally(text) {
  const value = String(text || '').replace(/\r/g, '').trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const source = Array.isArray(parsed) ? parsed : parsed.split || parsed.workoutSplit || [];
    return normalizeImportedSplit(source);
  } catch(e) {}

  const days = [];
  let current = null;
  value.split('\n').map(line => line.trim()).filter(Boolean).forEach(line => {
    const normalized = line.replace(/[–—]/g, '-');
    const dayMatch = normalized.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*(?:-|:)?\s*(.*)$/i);
    if (dayMatch) {
      current = {
        day: titleCase(dayMatch[1]),
        name: cleanImportName(dayMatch[2]) || (titleCase(dayMatch[1]) === 'Sunday' ? 'Rest' : 'Workout'),
        focus: '',
        rest: titleCase(dayMatch[1]) === 'Sunday',
        exercises: []
      };
      days.push(current);
      return;
    }

    if (!current) {
      current = { day: 'Monday', name: 'Imported Workout', focus: '', exercises: [] };
      days.push(current);
    }

    const focusMatch = normalized.match(/^focus\s*:\s*(.+)$/i);
    if (focusMatch) {
      current.focus = focusMatch[1].trim();
      return;
    }

    const exerciseMatch = normalized
      .replace(/^[0-9]+[.)]\s*/, '')
      .match(/^(.+?)\s*(?:-|:)\s*(\d+)\s*x\s*([0-9]+(?:\s*-\s*[0-9]+)?(?:\s*each leg)?|rounds?)$/i);
    if (exerciseMatch) {
      current.exercises.push(workoutExercise(cleanImportName(exerciseMatch[1]), Number(exerciseMatch[2]), exerciseMatch[3].replace(/\s+/g, ' ')));
      current.rest = false;
    }
  });
  return normalizeImportedSplit(days).filter(day => day.rest || day.exercises.length);
}

function estimateWorkoutImportWithAI(textOrImage) {
  const split = parseWorkoutTextLocally(textOrImage || '');
  pendingWorkoutImport = split;
  renderWorkoutImportPreview(split);
  setWorkoutImportApplyEnabled(split.length > 0);
  if (!split.length) setWorkoutImportStatus('AI import unavailable locally. Paste workout text and the local parser will convert it.', 'error');
  return Promise.resolve(split);
}

function applyWorkoutImport() {
  if (!pendingWorkoutImport || !pendingWorkoutImport.length) return;
  if (!confirm('Applying this will replace your current workout split. Existing logs stay saved.')) return;
  const workoutState = getWorkoutState();
  workoutState.split = pendingWorkoutImport;
  workoutState.exerciseHistory = buildExerciseHistory(workoutState.logs);
  saveWorkoutState(workoutState);
  closeWorkoutImportModal();
  showToast('Workout split imported.');
  renderAll();
}

function renderWorkoutImportPreview(split) {
  const el = document.getElementById('workoutImportPreview');
  if (!el) return;
  if (!split || !split.length) {
    el.className = 'import-preview';
    el.innerHTML = '';
    return;
  }
  const exerciseCount = split.reduce((sum, day) => sum + day.exercises.length, 0);
  el.className = 'import-preview visible';
  el.innerHTML = `
    <div class="workout-import-warning">Applying this will replace your current workout split.</div>
    <div class="workout-import-totals">${split.length} day(s) detected - ${exerciseCount} exercises</div>
    ${split.map(day => `
      <div class="preview-meal">
        <div>
          <div class="preview-meal-name">${escapeWorkoutHtml(day.day)} - ${escapeWorkoutHtml(day.name)}</div>
          <div class="preview-meal-macros">${day.exercises.length} exercises${day.focus ? ' | ' + escapeWorkoutHtml(day.focus) : ''}</div>
        </div>
      </div>`).join('')}`;
}

function setWorkoutImportStatus(message, type) {
  const el = document.getElementById('workoutImportStatus');
  if (!el) return;
  el.textContent = message || '';
  el.className = 'import-status' + (type ? ' visible ' + type : '');
}

function setWorkoutImportApplyEnabled(enabled) {
  const btn = document.getElementById('workoutImportApplyBtn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.4';
  btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
}

function normalizeImportedSplit(split) {
  return (split || []).map((day, index) => {
    const dayName = titleCase(day.day || ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][index] || 'Monday');
    const name = day.name || day.title || (dayName === 'Sunday' ? 'Rest' : 'Workout');
    const exercises = (day.exercises || []).map(exercise => {
      if (Array.isArray(exercise)) return workoutExercise(exercise[0], Number(exercise[1]) || 3, String(exercise[2] || '8-12'));
      return workoutExercise(exercise.name || exercise.exercise || 'Exercise', Number(exercise.sets) || parseSetRepTarget(exercise.targetText).sets || 3, String(exercise.repRange || exercise.reps || parseSetRepTarget(exercise.targetText).min || '8-12'));
    });
    return {
      id: workoutId(`${dayName}_${name}`),
      day: dayName,
      name,
      focus: day.focus || '',
      rest: !!day.rest || (dayName === 'Sunday' && !exercises.length),
      recovery: day.recovery || ['Recovery', 'Eat enough', 'Sleep', 'Track weight', 'Prepare for next week'],
      exercises
    };
  });
}

function formatWorkoutPerformance(log) {
  const weight = Number(log.weight) ? `${trimNumber(Number(log.weight))}kg x ` : '';
  return `${weight}${(log.reps || []).join(',')}${log.rir != null ? ` | RIR ${log.rir}` : ''}`;
}

function workoutId(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70) || 'exercise';
}

function humanizeWorkoutId(id) {
  return String(id || '').replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function trimNumber(value) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(1)));
}

function titleCase(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1).toLowerCase();
}

function cleanImportName(value) {
  return String(value || '').replace(/^[-:]+/, '').trim();
}

function escapeWorkoutHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
