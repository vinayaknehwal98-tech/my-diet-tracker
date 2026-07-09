// --- IMPORT DIET ---
let importedMeals = null;

const IMPORT_DIET_EMPTY_MESSAGE = 'No valid meals found. Paste clearer diet text or try again.';
const IMPORT_DIET_IMAGE_EMPTY_MESSAGE = 'Import failed: no foods/macros detected.';

function importNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') return 0;
  const number = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function slugifyDietId(value, fallback = 'meal') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/^[^\w\s]+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || fallback;
}

function parseImportTime(value) {
  const text = String(value || '');
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return '';
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = (match[3] || '').toLowerCase();
  if (hour > 23 || minute > 59) return '';
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function mealEmojiForName(name) {
  const text = String(name || '').toLowerCase();
  if (/breakfast|morning/.test(text)) return 'ðŸŒ…';
  if (/lunch|noon/.test(text)) return 'ðŸ›';
  if (/snack|evening/.test(text)) return 'ðŸ¥¤';
  if (/pre.?workout/.test(text)) return 'ðŸ‹ï¸';
  if (/dinner|night/.test(text)) return 'ðŸ½ï¸';
  return 'ðŸ½ï¸';
}

function stripMealEmoji(name) {
  return String(name || '').replace(/^[^\w\s]+/g, '').trim();
}

function normalizeImportedFood(food = {}) {
  const name = String(food.name || food.food || food.item || '').trim();
  const qty = String(food.qty || food.quantity || food.amount || '').trim();
  const cal = importNumber(food.cal ?? food.kcal ?? food.calories ?? food.energy);
  const pro = importNumber(food.pro ?? food.protein ?? food.p);
  const carbs = importNumber(food.carbs ?? food.carb ?? food.c);
  const fat = importNumber(food.fat ?? food.f);
  return { name, qty, cal, pro, carbs, fat };
}

function isValidImportedFood(food = {}) {
  const normalized = normalizeImportedFood(food);
  return !!normalized.name && (normalized.cal > 0 || normalized.pro > 0);
}

function calculateMealTotalsFromFoods(meal = {}) {
  const foods = (Array.isArray(meal.foods) ? meal.foods : [])
    .map(normalizeImportedFood)
    .filter(isValidImportedFood);
  return {
    kcal: foods.reduce((sum, food) => sum + food.cal, 0),
    protein: foods.reduce((sum, food) => sum + food.pro, 0),
    carbs: foods.reduce((sum, food) => sum + food.carbs, 0),
    fat: foods.reduce((sum, food) => sum + food.fat, 0),
    foods
  };
}

function normalizeImportedMeal(meal = {}, index = 0) {
  const rawName = stripMealEmoji(meal.name || meal.title || meal.meal || `Meal ${index + 1}`);
  const emoji = meal.emoji || mealEmojiForName(rawName);
  const timeVal = parseImportTime(meal.timeVal || meal.time || meal.timeLabel || rawName) || meal.timeVal || '';
  const totals = calculateMealTotalsFromFoods(meal);
  return {
    id: slugifyDietId(meal.id || rawName, `meal_${index + 1}`),
    name: `${emoji} ${rawName || `Meal ${index + 1}`}`,
    emoji,
    timeLabel: timeVal ? fmt12(timeVal) : (meal.timeLabel || ''),
    timeVal: timeVal || '12:00',
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    foods: totals.foods
  };
}

function isValidImportedMeal(meal = {}) {
  const normalized = normalizeImportedMeal(meal);
  const hasFoods = normalized.foods.length > 0;
  const hasMacros = normalized.kcal > 0 || normalized.protein > 0 || normalized.carbs > 0 || normalized.fat > 0;
  return hasFoods && hasMacros && (normalized.kcal > 0 || normalized.protein > 0);
}

function validateImportedDietPlan(plan) {
  const meals = (Array.isArray(plan) ? plan : [])
    .map(normalizeImportedMeal)
    .filter(isValidImportedMeal)
    .map((meal, index) => ({ ...meal, id: meal.id || `meal_${index + 1}` }));
  return {
    valid: meals.length > 0,
    meals,
    error: meals.length ? '' : IMPORT_DIET_EMPTY_MESSAGE
  };
}

function setImportFailure(message) {
  importedMeals = null;
  setImportStatus('error', message);
  setImportPreview(null);
  setImportApplyBtn(false);
}

function acceptImportedMeals(rawMeals, options = {}) {
  const result = validateImportedDietPlan(rawMeals);
  if (!result.valid) {
    setImportFailure(options.image ? IMPORT_DIET_IMAGE_EMPTY_MESSAGE : result.error);
    if (options.dropTitle) {
      document.getElementById('dropTitle').textContent = options.dropTitle;
      document.getElementById('dropSub').textContent = 'Try clearer text or another image';
    }
    return false;
  }
  importedMeals = result.meals;
  const totalKcal = importedMeals.reduce((a, m) => a + m.kcal, 0);
  const totalPro = importedMeals.reduce((a, m) => a + m.protein, 0);
  setImportStatus('success', `Found ${result.meals.length} meals · ${totalKcal.toLocaleString()} kcal · ${totalPro}g protein`);
  setImportPreview(importedMeals);
  setImportApplyBtn(true);
  document.getElementById('dropIcon').textContent = 'OK';
  document.getElementById('dropTitle').textContent = options.title || `${result.meals.length} meals parsed`;
  document.getElementById('dropSub').textContent = 'Review below and tap Apply Diet';
  return true;
}

function isLikelyMealHeading(line) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (extractFoodMacros(text).hasMacros) return false;
  return /^(breakfast|lunch|dinner|snack|evening snack|morning snack|pre.?workout|post.?workout|meal\s*\d+)/i.test(text);
}

function cleanFoodNameFromLine(line) {
  return String(line || '')
    .replace(/[-–—|,()]+/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kcal|calories|cal)\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*g?\s*(?:protein|pro|carbs?|fat|[pcf])\b/gi, ' ')
    .replace(/\b(?:kcal|calories|cal|protein|pro|carbs?|fat)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFoodMacros(line) {
  const text = String(line || '').replace(/[–—]/g, '-');
  const calMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:kcal|calories|cal)\b/i);
  const proMatch = text.match(/(\d+(?:\.\d+)?)\s*g?\s*(?:protein|pro|p)\b/i);
  const carbsMatch = text.match(/(\d+(?:\.\d+)?)\s*g?\s*(?:carbs?|c)\b/i);
  const fatMatch = text.match(/(\d+(?:\.\d+)?)\s*g?\s*(?:fat|f)\b/i);
  const cal = calMatch ? importNumber(calMatch[1]) : 0;
  const pro = proMatch ? importNumber(proMatch[1]) : 0;
  const carbs = carbsMatch ? importNumber(carbsMatch[1]) : 0;
  const fat = fatMatch ? importNumber(fatMatch[1]) : 0;
  return {
    cal,
    pro,
    carbs,
    fat,
    hasMacros: cal > 0 || pro > 0 || carbs > 0 || fat > 0
  };
}

function parseFoodLine(line) {
  const macros = extractFoodMacros(line);
  if (!macros.hasMacros || (macros.cal <= 0 && macros.pro <= 0)) return null;
  const nameWithQty = cleanFoodNameFromLine(line);
  if (!nameWithQty) return null;
  const qtyMatch = nameWithQty.match(/\b(?:x\s*\d+|\d+(?:\.\d+)?\s*(?:g|kg|ml|l|pcs?|pieces?|servings?|scoops?|tbsp|tsp)|\d+)\b/i);
  const qty = qtyMatch ? qtyMatch[0].trim() : '';
  const name = nameWithQty.replace(qty, '').replace(/\s+/g, ' ').trim() || nameWithQty;
  return normalizeImportedFood({
    name,
    qty,
    cal: macros.cal,
    pro: macros.pro,
    carbs: macros.carbs,
    fat: macros.fat
  });
}

function createParsedMealFromHeading(heading, index) {
  const timeVal = parseImportTime(heading);
  const name = stripMealEmoji(String(heading || '').replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, '').trim()) || `Meal ${index + 1}`;
  return {
    id: slugifyDietId(name, `meal_${index + 1}`),
    name,
    emoji: mealEmojiForName(name),
    timeVal: timeVal || '12:00',
    timeLabel: timeVal ? fmt12(timeVal) : '',
    foods: []
  };
}

function parseDietTextLocally(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[-*•]\s*/, ''))
    .filter(Boolean);
  const meals = [];
  let current = null;

  lines.forEach(line => {
    if (isLikelyMealHeading(line)) {
      if (current) meals.push(current);
      current = createParsedMealFromHeading(line, meals.length);
      return;
    }

    const food = parseFoodLine(line);
    if (!food) return;
    if (!current) current = createParsedMealFromHeading('Meal 1', meals.length);
    current.foods.push(food);
  });

  if (current) meals.push(current);
  return validateImportedDietPlan(meals).meals;
}

function openImportModal() {
  importedMeals = null;
  document.getElementById('importPasteArea').value = '';
  setImportStatus('', '');
  setImportPreview(null);
  setImportApplyBtn(false);
  document.getElementById('dropIcon').textContent = '📄';
  document.getElementById('dropTitle').textContent = 'Tap to upload file';
  document.getElementById('dropSub').textContent = 'JSON diet file · plain text · diet description. Any format works — AI will convert it';
  document.getElementById('importModal').classList.add('open');
}

function closeImportModal() {
  document.getElementById('importModal').classList.remove('open');
  importedMeals = null;
}

document.getElementById('importModal').addEventListener('click', function(e) {
  if (e.target === this) closeImportModal();
});

function handleImportDrop(e) {
  e.preventDefault();
  document.getElementById('importDropZone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processImportFile(file);
}

function handleImportFile(input) {
  const file = input.files[0];
  if (file) processImportFile(file);
  input.value = '';
}

function processImportFile(file) {
  const name = file.name;
  const isImage = file.type.startsWith('image/');

  document.getElementById('dropIcon').textContent = isImage ? '🖼️' : '📎';
  document.getElementById('dropTitle').textContent = name;
  document.getElementById('dropSub').textContent = `${(file.size/1024).toFixed(1)} KB · parsing...`;

  if (isImage) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const b64 = e.target.result.split(',')[1];
      const mime = file.type || 'image/jpeg';
      await parseImageWithAI(b64, mime);
    };
    reader.readAsDataURL(file);
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const text = e.target.result;
    if (name.endsWith('.json')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          applyParsedMeals(parsed);
          return;
        }
      } catch(err) {}
    }
    parseDietTextOrAI(text);
  };
  reader.readAsText(file);
}

async function parseImageWithAI(b64, mime) {
  setImportStatus('loading', '🤖 Reading diet plan from image...');
  setImportPreview(null);
  setImportApplyBtn(false);

 const prompt = `This is a diet plan image. Extract ALL meals and return ONLY a JSON array with no explanation.

Each meal object must have accurate calorie and protein values for each food item:
{
  "id": "breakfast",
  "name": "🌅 Breakfast",
  "emoji": "🌅",
  "timeLabel": "9:00 AM",
  "timeVal": "09:00",
  "kcal": 950,
  "protein": 33,
  "carbs": 148,
  "fat": 22,
  "foods": [
    { "name": "Oats", "qty": "100g", "cal": 370, "pro": 13 },
    { "name": "Milk", "qty": "600ml", "cal": 390, "pro": 20 }
  ]
}

IMPORTANT:
- cal and pro fields must have real numeric values, never 0
- Estimate calories from standard nutritional data if not shown in image
- kcal = sum of all food cal values
- protein = sum of all food pro values
- Return ONLY the JSON array starting with [ and ending with ]`;

  try {
    const res = await fetch('https://blue-poetry-b2ac.vinayaknehwal98.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
       model: 'google/gemma-3-27b-it:free',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    if (!res.ok) throw new Error('API ' + res.status);
    const data = await res.json();
    const raw = data.content?.find(b => b.type === 'text')?.text || '';
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not find meal data in image');

    const meals = JSON.parse(match[0]);
    acceptImportedMeals(meals, { image: true, title: 'Meals parsed from image', dropTitle: 'Image import failed' });

  } catch(err) {
    setImportFailure(err.message && /json|api|read/i.test(err.message)
      ? 'Could not read image: ' + err.message
      : IMPORT_DIET_IMAGE_EMPTY_MESSAGE);
  }
}

let pasteDebounce = null;
function onPasteInput(el) {
  clearTimeout(pasteDebounce);
  const val = el.value.trim();
  if (!val) {
    setImportStatus('', '');
    setImportPreview(null);
    setImportApplyBtn(false);
    return;
  }
  pasteDebounce = setTimeout(() => parseDietTextOrAI(val), 500);
}

function setImportStatus(type, msg) {
  const el = document.getElementById('importStatus');
  el.className = 'import-status' + (type ? ' visible ' + type : '');
  el.textContent = msg;
}

function setImportPreview(meals) {
  const el = document.getElementById('importPreview');
  if (!meals || !meals.length) { el.className = 'import-preview'; el.innerHTML = ''; return; }
  el.className = 'import-preview visible';
  el.innerHTML = meals.map(m => `
    <div class="preview-meal">
      <div>
        <div class="preview-meal-name">${m.emoji || ''} ${stripMealEmoji(m.name)}</div>
        <div class="preview-meal-macros">${m.timeLabel || fmt12(m.timeVal)} · ${m.foods ? m.foods.length : 0} items</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--font);font-size:13px;font-weight:700;color:var(--accent);">${m.kcal} kcal</div>
        <div class="preview-meal-macros">${m.protein}g P · ${m.carbs||0}g C · ${m.fat||0}g F</div>
      </div>
    </div>`).join('');
}

function setImportApplyBtn(enabled) {
  const btn = document.getElementById('importApplyBtn');
  btn.disabled = !enabled;
  btn.style.opacity = enabled ? '1' : '0.4';
  btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
}

function parseDietTextOrAI(rawText) {
  const localMeals = parseDietTextLocally(rawText);
  if (localMeals.length) {
    acceptImportedMeals(localMeals, { title: `${localMeals.length} meals parsed` });
    return;
  }
  parseWithClaude(rawText);
}

async function parseWithClaude(rawText) {
  setImportStatus('loading', '🤖 Claude is reading your diet plan...');
  setImportPreview(null);
  setImportApplyBtn(false);

  const prompt = `You are a diet plan parser. The user will give you a diet plan in any format (plain text, structured notes, PDF extract, etc).

Your job is to extract all meals and return ONLY a JSON array — no explanation, no markdown, no extra text.

Each meal object must follow this exact structure:
{
  "id": "unique_slug",          // e.g. "breakfast", "lunch", "snack1", "preworkout", "dinner"
  "name": "🌅 Breakfast",       // include an appropriate emoji prefix
  "emoji": "🌅",
  "timeLabel": "9:00 AM",
  "timeVal": "09:00",           // 24hr HH:MM format
  "kcal": 950,
  "protein": 33,
  "carbs": 148,
  "fat": 22,
  "foods": [
    { "name": "Oats", "qty": "100g", "cal": 370, "pro": 13 }
  ]
}

Rules:
- Compute kcal as sum of all food items' cal if not explicitly stated
- Compute protein as sum of all food items' pro if not explicitly stated
- If carbs/fat not given for a food, estimate from context or use 0
- timeVal must be a valid 24hr time like "09:00", "13:30"
- Each meal must have at least 1 food item
- Return ONLY the JSON array, starting with [ and ending with ]

Diet plan to parse:
${rawText.slice(0, 4000)}`;

  try {
    const res = await fetch('https://blue-poetry-b2ac.vinayaknehwal98.workers.dev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const raw = data.content.find(b => b.type === 'text')?.text || '';

    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Could not find JSON in response');

    const meals = JSON.parse(match[0]);
    acceptImportedMeals(meals, { title: 'Meals parsed' });

  } catch(err) {
    setImportFailure(err.message && /json|api/i.test(err.message)
      ? 'Could not parse: ' + err.message + '. Try a cleaner format or JSON file.'
      : IMPORT_DIET_EMPTY_MESSAGE);
  }
}

function applyParsedMeals(meals) {
  acceptImportedMeals(meals, { title: 'Meals ready' });
}

function applyImport() {
  const result = validateImportedDietPlan(importedMeals);
  if (!result.valid) {
    setImportFailure(result.error);
    return;
  }
  if (!confirm(`Replace your current ${state.meals.length} meals with ${result.meals.length} new meals? Your check history stays.`)) return;

  state.meals = result.meals;
  saveState();
  closeImportModal();
  renderAll();
  showToast(`✅ Diet updated! ${result.meals.length} meals loaded.`);
}
