// --- X COACH ASSISTANT ---
let aiHistory = [];
let startupCoachBriefShown = false;

const COACH_NAME = 'X';
const X_COACH_GREETING = "I'm X. I’ll track your calories, protein, water, and missed meals. No fake bulk.";
const coachProfile = {
  name: 'Vinayak',
  goal: 'bulk / visible transformation',
  calorieTarget: 3320,
  proteinTarget: 149,
  carbsTarget: 415,
  fatTarget: 72,
  dietStyle: 'vegetarian + eggs',
  gymTime: '8 PM',
  preferredFoods: ['eggs', 'roti', 'banana', 'oats', 'peanut butter', 'whey', 'dal', 'rice'],
  avoidDaily: ['soya chunks'],
  wheyLimit: '1 scoop/day'
};

function openAI() {
  document.getElementById('aiDrawer').classList.add('open');
  const messages = document.getElementById('aiMessages');
  const oldMessageCached = /screw\s+up/i.test(messages.textContent);

  if (oldMessageCached) {
    messages.innerHTML = '';
    aiHistory = [];
  }

  if (!messages.hasChildNodes() || oldMessageCached) {
    addCoachMessage(X_COACH_GREETING);
  }

  setTimeout(() => document.getElementById('aiInput').focus(), 300);
}

function closeAI() {
  document.getElementById('aiDrawer').classList.remove('open');
}

document.getElementById('aiDrawer').addEventListener('click', function(e) {
  if (e.target === this) closeAI();
});

function addAIMsg(role, text) {
  const el = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.textContent = text;
  div.style.whiteSpace = 'pre-line';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function addCoachMessage(text) {
  const msg = addAIMsg('assistant', text);
  aiHistory.push({ role: 'assistant', content: text });
  if (aiHistory.length > 20) aiHistory = aiHistory.slice(-16);
  return msg;
}

function getTodayExtras() {
  return (state.extraMeals || []).filter(e => e.date === todayKey());
}

function getCoachTargets() {
  return {
    kcal: state.meals.reduce((a, m) => a + m.kcal, 0) || coachProfile.calorieTarget,
    protein: state.meals.reduce((a, m) => a + m.protein, 0) || coachProfile.proteinTarget,
    carbs: state.meals.reduce((a, m) => a + (m.carbs || 0), 0) || coachProfile.carbsTarget,
    fat: state.meals.reduce((a, m) => a + (m.fat || 0), 0) || coachProfile.fatTarget
  };
}

function getCoachContext() {
  const doneMeals = state.meals.filter(m => isMealDone(m.id));
  const extras = getTodayExtras();
  const totals = getCoachTargets();
  const consumed = {
    kcal: doneMeals.reduce((a, m) => a + m.kcal, 0) + extras.reduce((a, e) => a + (e.kcal || 0), 0),
    protein: doneMeals.reduce((a, m) => a + m.protein, 0) + extras.reduce((a, e) => a + (e.protein || 0), 0),
    carbs: doneMeals.reduce((a, m) => a + (m.carbs || 0), 0) + extras.reduce((a, e) => a + (e.carbs || 0), 0),
    fat: doneMeals.reduce((a, m) => a + (m.fat || 0), 0) + extras.reduce((a, e) => a + (e.fat || 0), 0)
  };
  const missedMeals = getCoachMissedMeals();
  const pendingMeals = state.meals.filter(m => !isMealDone(m.id));
  const currentMinutes = getCurrentMinutes();
  const dayPhase = getDayPhase();
  const firstMeal = getFirstMeal();
  const lastMeal = getLastMeal();
  const nextMeal = getNextPendingMeal();
  console.log('X day phase', { currentMinutes, dayPhase, firstMeal, lastMeal, nextMeal, missedMeals });
  return {
    doneMeals,
    extras,
    totals,
    consumed,
    remaining: {
      kcal: Math.max(0, totals.kcal - consumed.kcal),
      protein: Math.max(0, totals.protein - consumed.protein),
      carbs: Math.max(0, totals.carbs - consumed.carbs),
      fat: Math.max(0, totals.fat - consumed.fat)
    },
    missedMeals,
    pendingMeals,
    dayPhase,
    firstMeal,
    lastMeal,
    nextMeal,
    water: getWaterCount(),
    waterGoal: getRemindersState().waterGoalGlasses || 8
  };
}

function getRemainingMacros() {
  return getCoachContext().remaining;
}

function getMealConsistency() {
  const done = state.meals.filter(m => isMealDone(m.id)).length;
  const total = state.meals.length || 1;
  return { done, total, percent: Math.round((done / total) * 100) };
}

function getCoachDailyReport() {
  const ctx = getCoachContext();
  const consistency = getMealConsistency();
  const kcalScore = Math.min(40, Math.round((ctx.consumed.kcal / ctx.totals.kcal) * 40));
  const proteinScore = Math.min(30, Math.round((ctx.consumed.protein / ctx.totals.protein) * 30));
  const mealScore = Math.min(20, Math.round((consistency.done / consistency.total) * 20));
  const waterScore = Math.min(10, Math.round((ctx.water / ctx.waterGoal) * 10));
  const score = Math.min(100, kcalScore + proteinScore + mealScore + waterScore);
  const mainProblem = ctx.missedMeals.length
    ? `missed ${ctx.missedMeals.map(m => cleanMealName(m.name)).join(', ')}`
    : ctx.remaining.protein > 25
      ? 'protein is behind'
      : ctx.remaining.kcal > 700
        ? 'calories are behind'
        : ctx.water < ctx.waterGoal
          ? 'water is behind'
          : 'stay on schedule';
  return {
    score,
    calories: macroStatus(ctx.consumed.kcal, ctx.totals.kcal),
    protein: macroStatus(ctx.consumed.protein, ctx.totals.protein),
    water: ctx.water >= ctx.waterGoal ? 'good' : ctx.water >= Math.ceil(ctx.waterGoal / 2) ? 'decent' : 'poor',
    mainProblem,
    nextAction: getNextMealSuggestion(false),
    context: ctx
  };
}

function macroStatus(value, target) {
  const pct = target ? value / target : 0;
  if (pct >= 0.95) return 'good';
  if (pct >= 0.7) return 'decent';
  return 'low';
}

function cleanMealName(name) {
  return String(name || '').replace(/^[^\w\s]*\s*/, '').trim();
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function mealTimeToMinutes(meal) {
  const val = String(meal?.timeVal || '').trim();
  let match = val.match(/^(\d{1,2}):(\d{2})$/);
  if (match) return (Number(match[1]) * 60) + Number(match[2]);

  const label = String(meal?.timeLabel || '').trim();
  match = label.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return (hour * 60) + minute;
}

function getSortedMealsByTime() {
  return [...(state.meals || [])]
    .map(meal => ({ meal, minutes: mealTimeToMinutes(meal) }))
    .filter(item => item.minutes !== null && Number.isFinite(item.minutes))
    .sort((a, b) => a.minutes - b.minutes)
    .map(item => item.meal);
}

function getFirstMeal() {
  return getSortedMealsByTime()[0] || null;
}

function getLastMeal() {
  const meals = getSortedMealsByTime();
  return meals[meals.length - 1] || null;
}

function getDayPhase() {
  const currentMinutes = getCurrentMinutes();
  const firstMeal = getFirstMeal();
  const lastMeal = getLastMeal();
  const firstMealMinutes = mealTimeToMinutes(firstMeal);
  const lastMealMinutes = mealTimeToMinutes(lastMeal);

  if (firstMealMinutes !== null && currentMinutes < firstMealMinutes) return 'before_first_meal';
  if (lastMealMinutes !== null && (currentMinutes > lastMealMinutes || currentMinutes >= (21 * 60 + 30))) return 'late_day';
  return 'active_day';
}

function getNextPendingMeal() {
  const currentMinutes = getCurrentMinutes();
  return getSortedMealsByTime()
    .filter(m => !isMealDone(m.id))
    .filter(m => {
      const minutes = mealTimeToMinutes(m);
      return minutes !== null && minutes >= currentMinutes;
    })[0] || null;
}

function getLastMealMinutes() {
  const lastMealMinutes = mealTimeToMinutes(getLastMeal());
  return lastMealMinutes === null ? 0 : lastMealMinutes;
}

function isLateDay() {
  return getDayPhase() === 'late_day';
}

function getCoachMissedMeals() {
  const dayPhase = getDayPhase();
  if (dayPhase === 'before_first_meal') return [];
  const currentMinutes = getCurrentMinutes();
  return (state.meals || []).filter(meal => {
    const mealMinutes = mealTimeToMinutes(meal);
    return mealMinutes !== null
      && currentMinutes > mealMinutes + 30
      && !isMealDone(meal.id);
  });
}

function getMealFoodItems(meal) {
  if (Array.isArray(meal?.items)) return meal.items;
  if (Array.isArray(meal?.foods)) return meal.foods;
  if (Array.isArray(meal?.foodItems)) return meal.foodItems;
  return [];
}

function formatMealFoodsForCoach(meal) {
  const foods = getMealFoodItems(meal);
  const formatted = foods
    .map(food => {
      const name = String(food?.name || food?.food || '').trim();
      const qty = String(food?.qty || food?.quantity || food?.amount || '').trim();
      return name ? `${name}${qty ? ` ${qty}` : ''}` : '';
    })
    .filter(Boolean);

  const result = formatted.length ? formatted.join(', ') : 'Food details missing.';
  console.log('X meal food details:', meal?.name, result);
  return result;
}

function mealHasFoodDetails(meal) {
  return getMealFoodItems(meal).some(food => String(food?.name || food?.food || '').trim());
}

function getMealPlanSuggestion(meal) {
  const name = cleanMealName(meal?.name) || 'meal';
  const total = `Total: ${Number(meal?.kcal) || 0} kcal, ${Number(meal?.protein) || 0}g protein.`;
  if (mealHasFoodDetails(meal)) {
    return `Complete ${name}: ${formatMealFoodsForCoach(meal)}. ${total}`;
  }
  return `Complete ${name} from your meal card. Food details are missing, so I won't invent them. ${total}`;
}

function getAlternativeRecoverySuggestion(reason = '') {
  const detail = String(reason || '').toLowerCase();
  if (detail.includes('full')) {
    return 'Alternative recovery: banana + peanut butter shake + curd or milk.';
  }
  if (detail.includes('eggs and roti')) {
    return 'Alternative recovery: 2 eggs + 2 roti + curd or milk.';
  }
  return 'Alternative recovery: 2 eggs + 2 roti + banana shake.';
}

function getNightRescuePlan(prefix = true) {
  const start = prefix ? `${COACH_NAME}: ` : '';
  return `${start}Day is almost over. Night Rescue:\n1. Banana + peanut butter shake\n2. 2 eggs\n3. Small dal/rice or 1-2 roti if hungry\nMinimum goal: reduce the damage, not force 3000 kcal at midnight.`;
}

function getFirstMealLine() {
  const firstMeal = getFirstMeal();
  if (!firstMeal) return 'First target: your first saved meal.';
  return `First target: ${cleanMealName(firstMeal.name)} at ${fmt12(firstMeal.timeVal)}.`;
}

function getFirstMealIsLine() {
  const firstMeal = getFirstMeal();
  if (!firstMeal) return 'First meal is your first saved meal.';
  return `First meal is ${cleanMealName(firstMeal.name)} at ${fmt12(firstMeal.timeVal)}.`;
}

function parseTimeTextToMinutes(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = String(match[3] || '').toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  return (hour * 60) + minute;
}

function getGymMinutes() {
  return parseTimeTextToMinutes(coachProfile.gymTime);
}

function isHungerModeText(text) {
  const t = String(text || '').toLowerCase().trim();
  const hasHungerWord = /\b(hungry|bhook|bhukh)\b|bhook lagi hai|bhukh lagi hai/.test(t);
  const wantsExtraFood = /\b(i am hungry|im hungry|i'm hungry|i want to eat|i want to eat now|can i eat|can i eat now|kuch khana hai)\b/.test(t);
  return hasHungerWord || wantsExtraFood;
}

function isGymAfterText(text) {
  return /\b(after gym|post workout|post-workout|gym done|workout done)\b/i.test(text);
}

function getBridgeSnack(ctx) {
  if (ctx.remaining.kcal > 700) return 'banana + peanut butter';
  if (ctx.remaining.protein > 25) return '2 eggs or curd';
  return 'banana, curd, 1 roti, or 2 eggs';
}

function getExtraMealByMacros(ctx) {
  const proteinLow = ctx.remaining.protein > 25;
  const caloriesLow = ctx.remaining.kcal > 700;
  if (proteinLow && caloriesLow) return '2 eggs + 2 roti + banana';
  if (proteinLow) return '2 eggs, dal, curd, or whey if unused';
  if (caloriesLow) return 'banana + peanut butter, roti, or rice';
  return 'banana + curd, 2 eggs, or 1 roti';
}

function getHungerSuggestion(text = '') {
  const ctx = getCoachContext();
  const currentMinutes = getCurrentMinutes();
  const gymMinutes = getGymMinutes();
  const nextMealMinutes = mealTimeToMinutes(ctx.nextMeal);
  const minutesUntilNext = nextMealMinutes === null ? null : nextMealMinutes - currentMinutes;
  const badlyBehind = ctx.remaining.kcal > 900 || ctx.remaining.protein > 35 || ctx.missedMeals.length >= 2;

  if (isGymAfterText(text) || (gymMinutes !== null && currentMinutes >= gymMinutes && currentMinutes <= gymMinutes + 120)) {
    return `${COACH_NAME}: Post-workout meal: whey if unused, eggs/roti, dal/rice, or curd/milk. Protein first, calories second. Log it as Extra unless it is already your planned meal.`;
  }

  if (gymMinutes !== null && currentMinutes < gymMinutes && gymMinutes - currentMinutes <= 90) {
    return `${COACH_NAME}: Pre-workout snack: banana + peanut butter, oats, or roti + light protein. Log it as Extra unless it is your planned Pre-Workout meal.`;
  }

  if (ctx.dayPhase === 'before_first_meal') {
    const label = currentMinutes < (5 * 60) ? 'Optional late-night mini meal' : 'Optional pre-breakfast mini meal';
    return `${COACH_NAME}: You can eat, but don't mark ${cleanMealName(getFirstMeal()?.name) || 'Breakfast'} done. ${label}: 1 banana + peanut butter, or 2 eggs, or 2 eggs + 1 roti if very hungry. Log it as Extra. ${cleanMealName(getFirstMeal()?.name) || 'Breakfast'} still stays at ${fmt12(getFirstMeal()?.timeVal) || 'the scheduled time'}.`;
  }

  if (ctx.dayPhase === 'late_day') {
    if (badlyBehind) return getNightRescuePlan(true);
    return `${COACH_NAME}: Optional late-night mini meal: banana + curd or 2 eggs. Log it as Extra. This does not replace any planned meal.`;
  }

  if (ctx.dayPhase === 'active_day' && minutesUntilNext !== null && minutesUntilNext >= 0 && minutesUntilNext <= 60) {
    return `${COACH_NAME}: Your planned meal is close. Eat that soon. If you can't wait, take a small bridge snack and log it as Extra. Bridge snack: ${getBridgeSnack(ctx)}.`;
  }

  return `${COACH_NAME}: Take an optional extra meal. This does not replace your planned meal. Log it as Extra. Option: ${getExtraMealByMacros(ctx)}.`;
}

function getFoodCombo(remaining, mode = '') {
  const parts = [];
  if (remaining.protein > 35) parts.push('1 scoop whey', '2 eggs', 'dal');
  else if (remaining.protein > 20) parts.push('2 eggs', 'dal');
  else parts.push('2 eggs');

  if (remaining.kcal > 900) parts.push('2 roti', 'banana + peanut butter shake');
  else if (remaining.kcal > 500) parts.push('2 roti', 'banana shake');
  else parts.push('banana');

  if (mode.includes('eggs and roti')) return '2 eggs + 3 roti. Add curd or milk if available.';
  if (mode.includes('full')) return 'banana + peanut butter shake, then 2 eggs later. Liquid calories first.';
  return [...new Set(parts)].join(' + ');
}

function getNextMealSuggestion(includePrefix = true, mode = '') {
  const ctx = getCoachContext();
  const dayPhase = getDayPhase();
  const nextMeal = getNextPendingMeal();
  const prefix = includePrefix ? `${COACH_NAME}: ` : '';

  if (dayPhase === 'before_first_meal') {
    return `${prefix}New day. ${getFirstMealIsLine()} If you're awake and hungry, keep it light or prep ${cleanMealName(getFirstMeal()?.name) || 'the first meal'}. No rescue needed yet.`;
  }

  if (dayPhase === 'late_day' || !nextMeal) {
    return getNightRescuePlan(includePrefix);
  }

  return `${prefix}${getMealPlanSuggestion(nextMeal)} Remaining today: ${ctx.remaining.kcal} kcal and ${ctx.remaining.protein}g protein.`;
}

function getMissedMealRecovery(detail = '') {
  const ctx = getCoachContext();
  const dayPhase = getDayPhase();
  if (dayPhase === 'before_first_meal') {
    return `${COACH_NAME}: New day. No meals missed yet. ${getFirstMealLine()} No rescue needed yet.`;
  }

  if (dayPhase === 'late_day') {
    const original = ctx.missedMeals[0]
      ? `Original missed meal: ${cleanMealName(ctx.missedMeals[0].name)} - ${formatMealFoodsForCoach(ctx.missedMeals[0])}.\n`
      : '';
    return `${COACH_NAME}: ${original}${getNightRescuePlan(false)}`;
  }

  if (ctx.missedMeals.length) {
    const original = ctx.missedMeals
      .map(m => `Original missed meal: ${cleanMealName(m.name)} - ${formatMealFoodsForCoach(m)}.`)
      .join('\n');
    return `${COACH_NAME}: ${original}\n${getAlternativeRecoverySuggestion(detail)} Drink 500ml water now. Log it when done.`;
  }

  return `${COACH_NAME}: No meal is confirmed missed yet. ${getNextMealSuggestion(false, detail)}`;
}

function getEndOfDayReport() {
  const report = getCoachDailyReport();
  const dayPhase = getDayPhase();
  if (dayPhase === 'before_first_meal') {
    return `${COACH_NAME}: Too early to judge the day. New day just started. Score is pending. ${getFirstMealLine()}`;
  }
  const missed = report.context.missedMeals.map(m => cleanMealName(m.name)).join(', ') || 'none';
  const verdict = report.score >= 85 ? 'bulk-worthy' : report.score >= 70 ? 'not bad, but not locked in' : 'not good enough for visible transformation';
  const label = dayPhase === 'active_day' ? 'Current score' : 'Day result';
  return `${COACH_NAME}: ${label}: ${report.score}/100${dayPhase === 'active_day' ? ' so far' : ''}. ${verdict}. Calories: ${report.calories}. Protein: ${report.protein}. Missed meals: ${missed}. ${dayPhase === 'late_day' ? 'Tomorrow starts with the first planned meal.' : 'Keep the next planned meal on time.'}`;
}

function getWeeklyCoachReview() {
  const mealIds = state.meals.map(m => m.id);
  const counts = {};
  let done = 0;
  let possible = 0;
  DAYS.forEach((day, idx) => {
    const dateKey = weekDayDateKey(idx);
    mealIds.forEach(id => {
      possible++;
      if (state.checked[`${dateKey}_${id}`]) done++;
      else counts[id] = (counts[id] || 0) + 1;
    });
  });
  const consistency = possible ? Math.round((done / possible) * 100) : 0;
  const worstId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const worstMeal = state.meals.find(m => m.id === worstId);
  return `${COACH_NAME}: Weekly review: ${done}/${possible} meals completed. Consistency: ${consistency}%. Main leak: ${worstMeal ? cleanMealName(worstMeal.name) : 'none yet'}. Weekly fix: make that meal smaller if needed, but zero skipping.`;
}

function getBulkRescuePlan(detail = '') {
  const ctx = getCoachContext();
  if (getDayPhase() === 'before_first_meal') {
    return `${COACH_NAME}: New day. ${getFirstMealLine()} No rescue needed yet.`;
  }
  if (ctx.remaining.kcal <= 700 && ctx.remaining.protein <= 25) {
    return `${COACH_NAME}: No rescue needed yet. Stay on schedule and finish the next meal.`;
  }
  const full = detail.toLowerCase().includes('full');
  if (isLateDay()) {
    return getNightRescuePlan(true);
  }
  const plan = full
    ? ['banana + peanut butter shake', '2 eggs later', 'curd or milk before sleep']
    : ['2 banana + peanut butter shake', '2 eggs', '1 roti with dal'];
  if (ctx.remaining.protein > 25) plan.push('keep whey to 1 scoop max');
  return `${COACH_NAME}: Bulk Rescue Mode. You're ${ctx.remaining.kcal} kcal and ${ctx.remaining.protein}g protein short. Do this:\n1. ${plan[0]}\n2. ${plan[1]}\n3. ${plan[2]}\nThis is the minimum rescue. Don't sleep under target.`;
}

function hasWorkoutCoach() {
  return typeof getWorkoutCoachContext === 'function'
    && typeof getTodayWorkoutStatus === 'function'
    && typeof getWorkoutWeeklyReview === 'function';
}

function getWorkoutStartupLine() {
  if (!hasWorkoutCoach()) return '';
  const status = getTodayWorkoutStatus();
  const workout = status.workout;
  if (workout.rest) return 'Rest day. Eat properly and recover.';
  if (status.completedWorkout) return 'Workout logged. Now recover and hit protein.';
  return `Workout pending: ${cleanMealName(workout.name)}.`;
}

function getWorkoutTodayResponse() {
  if (!hasWorkoutCoach()) return `${COACH_NAME}: Workout tracker is not loaded yet.`;
  const status = getTodayWorkoutStatus();
  const workout = status.workout;
  if (workout.rest) return `${COACH_NAME}: Rest day. Recovery, food, sleep, weight tracking. No punishment volume.`;
  const priority = status.priorityLift;
  const focus = workout.focus ? ` - ${workout.focus}` : '';
  const firstGoal = priority ? ` Priority lift: ${priority.name}. First goal: match last session, then add 1 rep.` : '';
  return `${COACH_NAME}: Today is ${workout.name}${focus}.${firstGoal}`;
}

function getWorkoutProgressiveOverloadResponse(text = '') {
  if (!hasWorkoutCoach()) return `${COACH_NAME}: Workout tracker is not loaded yet.`;
  const status = getTodayWorkoutStatus();
  const workout = status.workout;
  if (workout.rest) return `${COACH_NAME}: Rest day. No overload chase today. Recover so the next session moves.`;
  const query = String(text || '').toLowerCase();
  const exercise = workout.exercises.find(ex => query.includes(ex.name.toLowerCase())) || status.priorityLift || workout.exercises[0];
  const last = getLastExercisePerformance(exercise.id);
  const suggestion = getProgressiveOverloadSuggestion(exercise, getExerciseHistory(exercise.id));
  return `${COACH_NAME}: Start with ${exercise.name}. ${last ? `Last time: ${formatWorkoutPerformance(last)}. ` : ''}${suggestion.status}: ${suggestion.reason} Target: ${suggestion.nextTarget}${suggestion.warning ? ` Warning: ${suggestion.warning}` : ''}`;
}

function getDidIGetStrongerResponse() {
  if (!hasWorkoutCoach()) return `${COACH_NAME}: Workout tracker is not loaded yet.`;
  const memory = typeof inferUserPatterns === 'function' ? inferUserPatterns() : null;
  const status = getTodayWorkoutStatus();
  if (status.workout.rest) return `${COACH_NAME}: Rest day. Getting stronger today means recovering properly.`;
  if (!status.currentVolume) return `${COACH_NAME}: Not judged yet. Log weights and reps first, then I can compare volume, reps, and load.`;
  if (status.volumeDelta > 0) return `${COACH_NAME}: Yes. Volume is up by ${Math.round(status.volumeDelta)}. Strong trend: ${memory?.strongestExercises?.[0]?.name || "today's logged work"}. Now recover and hit protein.`;
  if (memory?.plateauExercises?.[0]?.count >= 3) return `${COACH_NAME}: Strength trend is mixed. ${memory.plateauExercises[0].name} is plateaued. Fix recovery/form before chasing load.`;
  return `${COACH_NAME}: Not yet. Match last session first, then add one rep or cleaner reps before adding weight.`;
}

function getWorkoutMissedResponse() {
  return `${COACH_NAME}: Don't double-volume tomorrow. Move the missed session to the next available day or continue the split. Consistency beats punishment.`;
}

function getDietWorkoutConnectionResponse() {
  const diet = getCoachContext();
  if (!hasWorkoutCoach()) return `${COACH_NAME}: Diet is loaded, workout tracker is not. Hit calories, protein, and water.`;
  const status = getTodayWorkoutStatus();
  if (status.workout.rest) return `${COACH_NAME}: Rest day. Eat properly and recover. Recovery is part of overload.`;
  if (!status.completedWorkout && (diet.remaining.kcal > 900 || diet.remaining.protein > 35)) {
    return `${COACH_NAME}: You're underfed today and workout is pending. Eat carbs + protein before training. Don't chase PRs empty.`;
  }
  if (status.completedWorkout && diet.remaining.protein > 20) {
    return `${COACH_NAME}: Workout logged, but post-workout protein is still pending. Finish the planned meal or log a protein extra.`;
  }
  if (diet.missedMeals.length) {
    return `${COACH_NAME}: You missed meals and want overload. Don't expect PRs while underfed. Fix food, then train.`;
  }
  return `${COACH_NAME}: Diet and workout are aligned enough. Train hard, log every set, then recover with protein.`;
}

function getStartupCoachBrief() {
  const ctx = getCoachContext();
  const dayPhase = getDayPhase();
  const missedNames = ctx.missedMeals.map(m => cleanMealName(m.name));
  const next = getNextPendingMeal();
  if (dayPhase === 'before_first_meal') {
    return `${COACH_NAME}: New day. No meals missed yet. ${getFirstMealLine()} Stay ready.${getWorkoutStartupLine() ? `\n${getWorkoutStartupLine()}` : ''}`;
  }
  if (dayPhase === 'late_day') {
    if (ctx.remaining.kcal > 500 || ctx.remaining.protein > 20 || missedNames.length) {
      return `${COACH_NAME}: Day is almost over. ${missedNames.length ? `You missed ${missedNames.join(', ')}. ` : ''}You're ${ctx.remaining.kcal} kcal / ${ctx.remaining.protein}g protein short.\n${getNightRescuePlan(false)}${getWorkoutStartupLine() ? `\n${getWorkoutStartupLine()}` : ''}`;
    }
  }
  if (missedNames.length || ctx.remaining.kcal > 500 || ctx.remaining.protein > 20) {
    return `${COACH_NAME}: ${missedNames.length ? `Missed so far: ${missedNames.join(', ')}. ` : ''}Progress: ${ctx.remaining.kcal} kcal / ${ctx.remaining.protein}g protein remaining.${next ? ` Next meal: ${cleanMealName(next.name)} at ${fmt12(next.timeVal)}. ${getMealPlanSuggestion(next)}` : ''}${getWorkoutStartupLine() ? `\n${getWorkoutStartupLine()}` : ''}`;
  }
  return next
    ? `${COACH_NAME}: Good start. Stay on schedule - next meal is ${cleanMealName(next.name)} at ${fmt12(next.timeVal)}.${getWorkoutStartupLine() ? `\n${getWorkoutStartupLine()}` : ''}`
    : `${COACH_NAME}: Good work. All meals are checked. Keep water on target.${getWorkoutStartupLine() ? `\n${getWorkoutStartupLine()}` : ''}`;
}

function showStartupCoachBrief() {
  if (startupCoachBriefShown || sessionStorage.getItem('xStartupBriefDismissed') === '1') return;
  startupCoachBriefShown = true;
  const existing = document.getElementById('coachStartupBrief');
  if (existing) existing.remove();
  const brief = document.createElement('div');
  brief.id = 'coachStartupBrief';
  brief.className = 'coach-startup-brief';
  brief.innerHTML = `
    <div class="coach-brief-title">X Check-in</div>
    <div class="coach-brief-message">${escapeCoachHtml(getStartupCoachBrief())}</div>
    <div class="coach-brief-actions">
      <button onclick="openCoachFromBrief()">Open X</button>
      <button onclick="dismissStartupCoachBrief()">Dismiss</button>
    </div>
  `;
  document.body.appendChild(brief);

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification('X Check-in', { body: getStartupCoachBrief() }); } catch(e) {}
  }
}

function dismissStartupCoachBrief() {
  sessionStorage.setItem('xStartupBriefDismissed', '1');
  const brief = document.getElementById('coachStartupBrief');
  if (brief) brief.remove();
}

function openCoachFromBrief() {
  dismissStartupCoachBrief();
  openAI();
}

function escapeCoachHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function getFoodScanCoachNote(meal) {
  const name = String(meal?.name || '').toLowerCase();
  const kcal = Number(meal?.kcal) || 0;
  const protein = Number(meal?.protein) || 0;
  if (name.includes('burger') || name.includes('fries') || kcal >= 700 && protein < 30) {
    return `${COACH_NAME}: Good for calories, weak for protein. Add 2 eggs later or the protein target suffers.`;
  }
  if (protein >= 25) return `${COACH_NAME}: Good. This actually helps the bulk.`;
  if (kcal < 250) return `${COACH_NAME}: Too small. This won't move your weight.`;
  return `${COACH_NAME}: Logged. Now balance the rest of the day around protein.`;
}

function handleCoachQuickAction(action, detail = '') {
  console.log('X quick action:', action);
  console.log('X local response used:', `quick_${action}`);
  const map = {
    eat_now: () => getNextMealSuggestion(true, detail),
    judge_day: () => getEndOfDayReport(),
    recover_missed: () => getMissedMealRecovery(detail),
    weekly_review: () => getWeeklyCoachReview(),
    bulk_rescue: () => getBulkRescuePlan(detail)
  };
  const text = map[action] ? map[action]() : getNextMealSuggestion(true, detail);
  addCoachMessage(text);
  return text;
}

function getLocalCoachResponse(text) {
  const t = text.toLowerCase();
  if (isHungerModeText(text)) {
    console.log('X local response used:', 'hunger_mode');
    return getHungerSuggestion(text);
  }
  if (/^(hi|hii|hello|hey|yo|good morning|good evening)[!.\s]*$/i.test(text.trim())) {
    console.log('X local response used:', 'greeting');
    const ctx = getCoachContext();
    if (ctx.dayPhase === 'before_first_meal') {
      return `${COACH_NAME}: I'm here. New day started. No meals missed yet. ${getFirstMealLine()}`;
    }
    if (ctx.dayPhase === 'late_day') {
      return getNightRescuePlan(true);
    }
    const next = ctx.nextMeal;
    return next
      ? `${COACH_NAME}: I'm here. Progress: ${ctx.consumed.kcal}/${ctx.totals.kcal} kcal, ${ctx.consumed.protein}/${ctx.totals.protein}g protein. Next meal: ${cleanMealName(next.name)} at ${fmt12(next.timeVal)}.`
      : `${COACH_NAME}: I'm here. No upcoming planned meals left today. Keep water on target.`;
  }
  const workoutAction = getLocalWorkoutCoachResponse(text);
  if (workoutAction) return workoutAction;
  const localActions = [
    { match: t.includes('what should i eat now'), reason: 'eat_now', response: () => getNextMealSuggestion() },
    { match: t.includes('judge my day'), reason: 'judge_day', response: () => getEndOfDayReport() },
    { match: t.includes('weekly review'), reason: 'weekly_review', response: () => getWeeklyCoachReview() },
    { match: t.includes('recover') || t.includes('i missed'), reason: 'recover_missed', response: () => getMissedMealRecovery(text) },
    { match: t.includes('feel full'), reason: 'bulk_rescue_full', response: () => getBulkRescuePlan('full') },
    { match: t.includes('only have eggs and roti'), reason: 'eggs_roti', response: () => getNextMealSuggestion(true, 'eggs and roti') },
    { match: t.includes('plan my remaining day'), reason: 'remaining_day', response: () => `${getNextMealSuggestion()}\n${getMissedMealRecovery(text)}` },
    { match: t.includes('before gym'), reason: 'before_gym', response: () => `${COACH_NAME}: Before gym at ${coachProfile.gymTime}: banana + peanut butter or oats, then water. Keep it digestible.` },
    { match: t.includes('after gym'), reason: 'after_gym', response: () => `${COACH_NAME}: After gym: whey if unused, then dal/rice or eggs/roti. Protein first, calories second.` },
    { match: t.includes('protein left'), reason: 'protein_left', response: () => `${COACH_NAME}: ${getRemainingMacros().protein}g protein left. Use saved meals first. Backup option: eggs, dal, curd, or one whey scoop.` },
    { match: t.includes('calories left'), reason: 'calories_left', response: () => `${COACH_NAME}: ${getRemainingMacros().kcal} kcal left. Use saved meals first. Backup option: banana, peanut butter, roti, rice, milk.` },
    { match: t.includes('bulk rescue'), reason: 'bulk_rescue', response: () => getBulkRescuePlan(text) }
  ];
  const action = localActions.find(item => item.match);
  if (action) {
    console.log('X local response used:', action.reason);
    return action.response();
  }
  return null;
}

function getLocalWorkoutCoachResponse(text) {
  const t = String(text || '').toLowerCase();
  const actions = [
    { match: t.includes('what workout today') || t.includes('what should i train today') || t.includes('workout today') || t.includes('should i train today'), reason: 'workout_today', response: () => getWorkoutTodayResponse() },
    { match: t.includes('progressive overload') || t.includes('next weight'), reason: 'progressive_overload', response: () => getWorkoutProgressiveOverloadResponse(text) },
    { match: t.includes('did i get stronger'), reason: 'did_i_get_stronger', response: () => getDidIGetStrongerResponse() },
    { match: t.includes('workout review'), reason: 'workout_review', response: () => {
      if (!hasWorkoutCoach()) return `${COACH_NAME}: Workout tracker is not loaded yet.`;
      const review = getWorkoutWeeklyReview();
      return `${COACH_NAME}: ${review.summary} Strongest improvement: ${review.strongestLiftImprovement}. Fix: ${review.fixForNextWeek}`;
    } },
    { match: t.includes('i missed workout'), reason: 'missed_workout', response: () => getWorkoutMissedResponse() },
    { match: t.includes('connect diet and workout'), reason: 'diet_workout_connection', response: () => getDietWorkoutConnectionResponse() }
    ,
    { match: t.includes('what have you learned about me'), reason: 'memory_summary', response: () => `${COACH_NAME}: ${typeof getUserLearningSummary === 'function' ? getUserLearningSummary() : 'I need 2-3 logged sessions before I can judge this properly.'}` },
    { match: t.includes('what are my weak points'), reason: 'weak_points', response: () => getWeakPointsResponse() },
    { match: t.includes('what should i focus on this week'), reason: 'weekly_focus', response: () => getWeeklyFocusResponse() },
    { match: t.includes('am i getting stronger'), reason: 'strength_trend', response: () => getDidIGetStrongerResponse() },
    { match: t.includes('why am i not progressing'), reason: 'not_progressing', response: () => getNotProgressingResponse() },
    { match: t.includes('clear your memory'), reason: 'clear_memory', response: () => { if (typeof clearXCoachMemory === 'function') clearXCoachMemory(); return `${COACH_NAME}: Memory cleared. I will rebuild only from new logs.`; } },
    { match: t.includes('update my memory'), reason: 'update_memory', response: () => { if (typeof refreshXCoachMemory === 'function') refreshXCoachMemory(); return `${COACH_NAME}: Memory updated from current diet and workout logs.`; } }
  ];
  const action = actions.find(item => item.match);
  if (!action) return null;
  console.log('X local response used:', action.reason);
  return action.response();
}

function getWeakPointsResponse() {
  if (typeof inferUserPatterns !== 'function') return `${COACH_NAME}: I need 2-3 logged sessions before I can judge this properly.`;
  const patterns = inferUserPatterns();
  const weak = [];
  if (patterns.missedMeals[0]?.count >= 2) weak.push(`${patterns.missedMeals[0].name} consistency`);
  if (patterns.missedWorkouts[0]?.count >= 2) weak.push(`${patterns.missedWorkouts[0].name} training consistency`);
  if (patterns.plateauExercises[0]?.count >= 2) weak.push(`${patterns.plateauExercises[0].name} plateau`);
  if (!weak.length) return `${COACH_NAME}: I need 2-3 logged sessions before I can judge this properly.`;
  return `${COACH_NAME}: Weak points: ${weak.join(', ')}. Fix one bottleneck first, not everything at once.`;
}

function getWeeklyFocusResponse() {
  if (!hasWorkoutCoach()) return `${COACH_NAME}: I need workout logs before setting a weekly focus.`;
  const review = getWorkoutWeeklyReview();
  return `${COACH_NAME}: This week focus: ${review.nextWeekFocus}. Bottleneck: ${review.mainBottleneck}. Rule: ${review.oneRule}`;
}

function getNotProgressingResponse() {
  const diet = getCoachContext();
  const review = hasWorkoutCoach() ? getWorkoutWeeklyReview() : null;
  const memory = typeof inferUserPatterns === 'function' ? inferUserPatterns() : null;
  if (!hasWorkoutCoach()) return `${COACH_NAME}: I need 2-3 logged sessions before I can judge this properly.`;
  if (diet.remaining.protein > 25 || diet.remaining.kcal > 900) return `${COACH_NAME}: Your lifts are not the only issue. Food is behind. Fix: eat before gym, keep same weight, add clean reps only after matching last session.`;
  if (memory?.plateauExercises?.[0]?.count >= 3) return `${COACH_NAME}: ${memory.plateauExercises[0].name} is stuck. ${review.nextWeekFocus}. Do not just add reps.`;
  return `${COACH_NAME}: I need 2-3 logged sessions before I can judge this properly. Log full sets, RIR, notes, and post-workout protein.`;
}

function getMealPlanFoodNames() {
  return (state.meals || [])
    .flatMap(getMealFoodItems)
    .map(food => String(food?.name || food?.food || '').toLowerCase())
    .filter(Boolean);
}

function lineIsLabeledAlternative(line) {
  return /alternative recovery|backup option/i.test(line);
}

function aiResponseNeedsSafetyFallback(text) {
  const response = String(text || '');
  const mealFoods = getMealPlanFoodNames();
  const blocked = ['egg whites', 'chicken', 'fish', 'beef', 'mutton', 'paneer'];
  return response.split(/\n+/).some(line => {
    if (lineIsLabeledAlternative(line)) return false;
    const lower = line.toLowerCase();
    return blocked.some(food => lower.includes(food) && !mealFoods.some(saved => saved.includes(food)));
  });
}

function getDeterministicCoachFallback(reason = 'ai_safety_filter') {
  console.log('X local response used:', reason);
  const ctx = getCoachContext();
  if (ctx.dayPhase === 'before_first_meal') {
    return `${COACH_NAME}: New day. No meals missed yet. ${getFirstMealLine()} Stay ready.`;
  }
  if (ctx.dayPhase === 'late_day') {
    return getNightRescuePlan(true);
  }
  if (ctx.nextMeal) {
    return `${COACH_NAME}: ${getMealPlanSuggestion(ctx.nextMeal)} ${ctx.missedMeals.length ? getAlternativeRecoverySuggestion('missed meal') : 'No alternative needed unless recovery is required.'}`;
  }
  return getMissedMealRecovery();
}

function getAppContext() {
  const ctx = getCoachContext();
  const workoutCtx = hasWorkoutCoach() ? getWorkoutCoachContext() : null;
  return `You are X, a strict but helpful bulking coach inside a diet tracker.

COACH MEMORY:
- User: ${coachProfile.name}
- Goal: ${coachProfile.goal}
- Targets: ${ctx.totals.kcal} kcal, ${ctx.totals.protein}g protein, ${ctx.totals.carbs}g carbs, ${ctx.totals.fat}g fat
- Diet style: ${coachProfile.dietStyle}
- Gym time: ${coachProfile.gymTime}
- Preferred foods: ${coachProfile.preferredFoods.join(', ')}
- Avoid daily: ${coachProfile.avoidDaily.join(', ')}
- Whey limit: ${coachProfile.wheyLimit}

CURRENT APP STATE:
- Today: ${new Date().toLocaleDateString('en-IN', {weekday:'long', day:'numeric', month:'long'})}
- Meals completed: ${ctx.doneMeals.length}/${state.meals.length}
- Calories consumed: ${ctx.consumed.kcal} / ${ctx.totals.kcal} kcal
- Protein consumed: ${ctx.consumed.protein}g / ${ctx.totals.protein}g
- Water: ${ctx.water}/${ctx.waterGoal} glasses
- Current weight: ${getCurrentWeight()} kg
- Goal weight: ${getGoalWeight()} kg
- Streak: ${getCurrentStreak()} days
- Day phase: ${ctx.dayPhase}
- Next upcoming meal: ${ctx.nextMeal ? `${cleanMealName(ctx.nextMeal.name)} at ${fmt12(ctx.nextMeal.timeVal)}` : 'none'}
- Missed meals: ${ctx.missedMeals.map(m => cleanMealName(m.name)).join(', ') || 'none'}

MEAL PLAN:
${state.meals.map(m => `- ${m.name} (${m.timeLabel || fmt12(m.timeVal)}): ${m.kcal} kcal, ${m.protein}g protein, ${m.carbs || 0}g carbs, ${m.fat || 0}g fat | Foods: ${formatMealFoodsForCoach(m)} | ${isMealDone(m.id) ? 'DONE' : 'pending'}`).join('\n')}

EXTRA MEALS TODAY:
${ctx.extras.length ? ctx.extras.map(e=>`- ${e.name}: ${e.kcal} kcal, ${e.protein || 0}g protein`).join('\n') : 'None'}

WORKOUT STATE:
${workoutCtx ? `- Today's workout: ${workoutCtx.todayWorkout.name} (${workoutCtx.todayWorkout.day})
- Focus: ${workoutCtx.focus || 'none'}
- Exercises completed: ${workoutCtx.exercisesCompleted}
- Pending exercises: ${workoutCtx.pendingExercises.join(', ') || 'none'}
- Priority lift: ${workoutCtx.priorityLift}
- Last priority performance: ${workoutCtx.lastPerformance ? formatWorkoutPerformance(workoutCtx.lastPerformance) : 'none'}
- Progressive overload suggestions: ${workoutCtx.progressiveOverloadSuggestions.map(item => `${item.exercise}: ${item.suggestion.status} - ${item.suggestion.nextTarget}${item.suggestion.warning ? ' / ' + item.suggestion.warning : ''}`).join(' | ')}
- Weekly workout consistency: ${workoutCtx.weeklyWorkoutConsistency.summary}` : 'Workout tracker unavailable.'}

X MEMORY:
${typeof getUserLearningSummary === 'function' ? getUserLearningSummary() : 'I need 2-3 logged sessions before I can judge this properly.'}

STYLE:
- Call yourself X only.
- Strict, direct, useful.
- Give exact next actions.
- Connect diet and workout when useful: warn if workout is pending and calories/protein are low, or if workout is complete and protein is still pending.
- Never use any previous coach name.
- Never present alternative foods as the saved meal. Saved meal foods must come only from MEAL PLAN. Alternatives are allowed only when clearly labeled as Alternative recovery or Backup option.
- Keep replies under 80 words unless asked for detail.`;
}

async function sendAI() {
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';

  addAIMsg('user', text);
  aiHistory.push({ role: 'user', content: text });

  const local = getLocalCoachResponse(text);
  if (local) {
    addCoachMessage(local);
    return;
  }

  const thinking = addAIMsg('thinking', 'Thinking...');

  try {
    const res = await fetch('https://blue-poetry-b2ac.vinayaknehwal98.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openrouter/free',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: getAppContext() },
          ...aiHistory
        ]
      })
    });

    const data = await res.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || 'I could not respond. Use the quick buttons and execute the plan.';

    thinking.remove();
    const actionMatch = raw.match(/```(?:action|json)\s*([\s\S]*?)```/);
    const displayText = raw.replace(/```(?:action|json)[\s\S]*?```/g, '').trim();

    if (actionMatch) {
      try { executeAIAction(JSON.parse(actionMatch[1].trim())); } catch(e) {}
    }

    const safeText = aiResponseNeedsSafetyFallback(displayText)
      ? getDeterministicCoachFallback('ai_safety_filter')
      : displayText;

    addCoachMessage(safeText || 'Action done. Stay locked in.');
  } catch(err) {
    thinking.remove();
    addCoachMessage('Worker failed. Local coach still works: hit calories, hit protein, drink water, complete the next meal.');
  }
}

function executeAIAction(actionData) {
  const { action, params = {} } = actionData;

  switch(action) {
    case 'check_meal':
      state.checked[`${todayKey()}_${params.mealId}`] = true;
      saveState(); renderAll();
      break;
    case 'uncheck_meal':
      delete state.checked[`${todayKey()}_${params.mealId}`];
      saveState(); renderAll();
      break;
    case 'check_all':
      state.meals.forEach(m => { state.checked[`${todayKey()}_${m.id}`] = true; });
      saveState(); renderAll();
      break;
    case 'uncheck_all':
      state.meals.forEach(m => { delete state.checked[`${todayKey()}_${m.id}`]; });
      saveState(); renderAll();
      break;
    case 'log_water':
      localStorage.setItem(todayWaterKey(), Math.min(12, Math.max(0, params.glasses)));
      updateWaterUI();
      break;
    case 'add_weight': {
      const todayDate = new Date().toISOString().split('T')[0];
      const idx = state.weightHistory.findIndex(w => w.date === todayDate);
      if (idx >= 0) state.weightHistory[idx].weight = params.weight;
      else state.weightHistory.push({ date: todayDate, weight: params.weight });
      saveState(); renderAll();
      break;
    }
    case 'log_extra':
      if (!state.extraMeals) state.extraMeals = [];
      state.extraMeals.push({
        id: 'extra_' + Date.now(),
        date: todayKey(),
        name: params.name,
        emoji: params.emoji || '???',
        kcal: params.kcal || 0,
        protein: params.protein || 0,
        carbs: params.carbs || 0,
        fat: params.fat || 0,
        time: new Date().toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}),
        swappedFor: null
      });
      saveState(); renderAll();
      break;
    case 'edit_meal': {
      const meal = state.meals.find(m => m.id === params.mealId);
      if (meal) {
        if (params.kcal) meal.kcal = params.kcal;
        if (params.protein) meal.protein = params.protein;
        if (params.carbs) meal.carbs = params.carbs;
        if (params.fat) meal.fat = params.fat;
        saveState(); renderAll();
      }
      break;
    }
    case 'reset_day':
      resetDay();
      break;
    case 'show_tab': {
      const tabBtns = document.querySelectorAll('.tab');
      const tabs = ['today','week','reminders','export'];
      const tabIdx = tabs.indexOf(params.tab);
      if (tabIdx >= 0) switchTab(params.tab, tabBtns[tabIdx]);
      break;
    }
  }
}
