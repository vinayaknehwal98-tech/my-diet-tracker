// --- IMPORT DIET ---
let importedMeals = null;

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
        if (Array.isArray(parsed) && parsed[0] && parsed[0].foods) {
          applyParsedMeals(parsed);
          return;
        }
      } catch(err) {}
    }
    await parseWithClaude(text);
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
    if (!Array.isArray(meals) || !meals.length) throw new Error('No meals found');

    const fixed = meals.map((m, i) => ({
      id: m.id || ('meal' + i),
      name: m.name || ('Meal ' + (i+1)),
      emoji: m.emoji || '🍽️',
      timeLabel: m.timeLabel || fmt12(m.timeVal || '12:00'),
      timeVal: m.timeVal || '12:00',
      kcal: Number(m.kcal) || 0,
      protein: Number(m.protein) || 0,
      carbs: Number(m.carbs) || 0,
      fat: Number(m.fat) || 0,
      foods: (() => {
        const foods = (m.foods || []).map(f => ({
          name: f.name || '',
          qty: f.qty || '',
          cal: Number(f.cal) || 0,
          pro: Number(f.pro) || 0
        }));
        // If all foods have 0 cal, distribute meal total evenly
        const totalFoodCal = foods.reduce((a,f) => a+f.cal, 0);
        const totalFoodPro = foods.reduce((a,f) => a+f.pro, 0);
        if (totalFoodCal === 0 && foods.length > 0) {
          const perCal = Math.round((Number(m.kcal)||0) / foods.length);
          const perPro = Math.round((Number(m.protein)||0) / foods.length);
          return foods.map(f => ({ ...f, cal: perCal, pro: perPro }));
        }
        return foods;
      })()
    }));

    importedMeals = fixed;
    const totalKcal = fixed.reduce((a,m) => a + m.kcal, 0);
    const totalPro  = fixed.reduce((a,m) => a + m.protein, 0);
    setImportStatus('success', `✅ Found ${fixed.length} meals · ${totalKcal.toLocaleString()} kcal · ${totalPro}g protein`);
    setImportPreview(fixed);
    setImportApplyBtn(true);
    document.getElementById('dropIcon').textContent = '✅';
    document.getElementById('dropTitle').textContent = `${fixed.length} meals parsed from image`;
    document.getElementById('dropSub').textContent = 'Review below and tap Apply Diet';

  } catch(err) {
    setImportStatus('error', '❌ Could not read image: ' + err.message);
    setImportApplyBtn(false);
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
  pasteDebounce = setTimeout(() => parseWithClaude(val), 800);
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
        <div class="preview-meal-name">${m.emoji || ''} ${m.name.replace(/^[^\w\s]*\s*/,'')}</div>
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
    if (!Array.isArray(meals) || !meals.length) throw new Error('Empty meal list returned');

    // Validate and fix each meal
    const fixed = meals.map((m, i) => ({
      id: m.id || ('meal' + i),
      name: m.name || ('Meal ' + (i+1)),
      emoji: m.emoji || '🍽️',
      timeLabel: m.timeLabel || fmt12(m.timeVal || '12:00'),
      timeVal: m.timeVal || '12:00',
      kcal: Number(m.kcal) || m.foods?.reduce((a,f)=>a+(f.cal||0),0) || 0,
      protein: Number(m.protein) || m.foods?.reduce((a,f)=>a+(f.pro||0),0) || 0,
      carbs: Number(m.carbs) || 0,
      fat: Number(m.fat) || 0,
      foods: (m.foods || []).map(f => ({
        name: f.name || '',
        qty: f.qty || '',
        cal: Number(f.cal) || 0,
        pro: Number(f.pro) || 0
      }))
    }));

    importedMeals = fixed;
    const totalKcal = fixed.reduce((a,m) => a + m.kcal, 0);
    const totalPro  = fixed.reduce((a,m) => a + m.protein, 0);
    setImportStatus('success', `✅ Found ${fixed.length} meals · ${totalKcal.toLocaleString()} kcal · ${totalPro}g protein`);
    setImportPreview(fixed);
    setImportApplyBtn(true);

    document.getElementById('dropIcon').textContent = '✅';
    document.getElementById('dropTitle').textContent = `${fixed.length} meals parsed`;
    document.getElementById('dropSub').textContent = 'Review below and tap Apply Diet';

  } catch(err) {
    setImportStatus('error', '❌ Could not parse: ' + err.message + '. Try a cleaner format or JSON file.');
    setImportApplyBtn(false);
  }
}

function applyParsedMeals(meals) {
  importedMeals = meals;
  const totalKcal = meals.reduce((a,m) => a + m.kcal, 0);
  const totalPro  = meals.reduce((a,m) => a + m.protein, 0);
  setImportStatus('success', `✅ Found ${meals.length} meals · ${totalKcal.toLocaleString()} kcal · ${totalPro}g protein`);
  setImportPreview(meals);
  setImportApplyBtn(true);
  document.getElementById('dropIcon').textContent = '✅';
  document.getElementById('dropTitle').textContent = `${meals.length} meals ready`;
  document.getElementById('dropSub').textContent = 'Review below and tap Apply Diet';
}

function applyImport() {
  if (!importedMeals || !importedMeals.length) return;
  if (!confirm(`Replace your current ${state.meals.length} meals with ${importedMeals.length} new meals? Your check history stays.`)) return;

  state.meals = importedMeals;
  saveState();
  closeImportModal();
  renderAll();
  showToast(`✅ Diet updated! ${importedMeals.length} meals loaded.`);
}
