// --- FIREBASE ---
firebase.initializeApp({
  apiKey: "AIzaSyDuc449HUPShaU5wBP9CFDU_eREh8n0gsU",
  authDomain: "diet-tracker-5142c.firebaseapp.com",
  projectId: "diet-tracker-5142c",
  storageBucket: "diet-tracker-5142c.firebasestorage.app",
  messagingSenderId: "737243616902",
  appId: "1:737243616902:web:e0c5ddc889f16ec09f6307"
});

const messaging = firebase.messaging();
const VAPID_KEY = 'BPOR0SuL2cNUDicnm7Dcs6z-g7VAYoZZ5ZHlvuUcvYTKADc4FN4cTS-PGujmTdTsWv8rKOI1ga5LHcANEE2tZcY';

async function getFCMToken() {
  try {
    console.log("Starting FCM token generation...");

    const reg = await navigator.serviceWorker.register("./firebase-messaging-sw.js", {
      scope: "./"
    });

    console.log("Using Firebase Messaging SW:", reg);

    const token = await firebase.messaging().getToken({
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg
    });

    console.log("FCM Token:", token);

    if (token) {
      localStorage.setItem("fcmToken", token);
    }

    return token;
  } catch (err) {
    console.error("FCM TOKEN ERROR:", err);
    return null;
  }
}

  async function syncScheduleToCloudflare() {
  try {
    const token = localStorage.getItem("fcmToken") || await getFCMToken();
    if (!token) {
      console.warn("No FCM token found. Schedule not synced.");
      return;
    }

    const rs = getRemindersState();

    const res = await fetch("https://diet-push.vinayaknehwal98.workers.dev/schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token,
        meals: state.meals,
        remindBefore: rs.remindBefore || [15, 10, 5],
        alarmAtTime: rs.alarmAtTime !== false,
        timezone: "Asia/Kolkata"
      })
    });

    const data = await res.json();
    console.log("Cloudflare schedule sync:", data);
    return data;
  } catch (err) {
    console.error("Cloudflare schedule sync failed:", err);
  }
}
  
// Handle foreground messages
messaging.onMessage((payload) => {
  console.log('Foreground message:', payload);
  const { title, body, mealId } = payload.data || {};
  if (mealId) startAudioAlarm(mealId);
  else showToast(title || '🔔 Reminder');
});
  


// --- INIT REMINDERS ON LOAD ---
function initReminders() {
  if (!NOTIF_SUPPORTED || Notification.permission !== 'granted') return;
  const rs = getRemindersState();
  if (!rs.mealsOn && !rs.waterOn) return;
  // Wait for SW controller to be ready
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(() => {
      if (rs.mealsOn) scheduleMealReminders();
      if (rs.waterOn) startWaterReminders(rs.waterInterval);
    });
  } else {
    if (rs.mealsOn) scheduleMealReminders();
    if (rs.waterOn) startWaterReminders(rs.waterInterval);
  }
}

setInterval(() => {

  state.meals.forEach(meal => {
    ensureMissedMealReason(meal);
  });

  saveState();

}, 60000);

function exposeGlobals() {
  Object.assign(window, {
    state,
    renderAll,
    renderToday,
    renderWeek,
    renderWorkout,
    renderReminders,
    renderExport,
    updateMacros,
    switchTab,
    toggleExpand,
    toggleWeek,
    openModal,
    closeModal,
    addFoodRow,
    saveModal,
    toggleMealDone,
    saveMissReason,
    resetDay,
    exportToExcel,
    exportToCSV,
    handleEnableNotif,
    handleMealToggle,
    handleWaterToggle,
    handleWaterInterval,
    setWaterGoal,
    logWater,
    updateWaterUI,
    snoozeAlarm,
    doneAlarm,
    toggleReminderChip,
    toggleAlarmAtTime,
    openSnapModal,
    closeSnapModal,
    triggerSnapInput,
    handleSnapFile,
    compressSnapImage,
    onSnapDescInput,
    estimateSnapMeal,
    estimateSnapFromDescription,
    retrySnapPhotoScan,
    renderSnapResult,
    logSnapAsExtra,
    logSnapAsSwap,
    normalizeSnapFoodItem,
    estimateMissingSnapMacros,
    updateSnapFoodField,
    updateSnapMealField,
    calculateSnapTotals,
    identifyFoodFromImage,
    identifyFoodFromText,
    showSnapResult,
    removeExtra,
    openImportModal,
    closeImportModal,
    handleImportDrop,
    handleImportFile,
    onPasteInput,
    applyImport,
    normalizeImportedFood,
    normalizeImportedMeal,
    isValidImportedFood,
    isValidImportedMeal,
    calculateMealTotalsFromFoods,
    validateImportedDietPlan,
    parseDietTextLocally,
    openAI,
    closeAI,
    sendAI,
    executeAIAction,
    getCoachContext,
    getCoachDailyReport,
    getRemainingMacros,
    getMealConsistency,
    getNextMealSuggestion,
    getHungerSuggestion,
    getMissedMealRecovery,
    getEndOfDayReport,
    getWeeklyCoachReview,
    getBulkRescuePlan,
    handleCoachQuickAction,
    addCoachMessage,
    getFoodScanCoachNote,
    getStartupCoachBrief,
    showStartupCoachBrief,
    dismissStartupCoachBrief,
    openCoachFromBrief,
    editCurrentWeight,
    editStartWeight,
    editGoalWeight,
    addWeightEntry,
    showLoserModal,
    closeLoserModal,
    showMissionModal,
    closeMissionModal,
    showQuitModal,
    closeQuitModal,
    unlockContract,
    quitAnyway,
    lockContract
  });

  if (typeof renderWorkout === 'function') {
    Object.assign(window, {
      renderWorkout,
      getWorkoutState,
      saveWorkoutState,
      getTodayWorkout,
      saveWorkoutLog,
      resetTodayWorkout,
      clearExerciseLog,
      undoLastWorkoutAction,
      handleExerciseDoneToggle,
      handleSetDoneToggle,
      isExerciseActuallyLogged,
      cleanEmptyExerciseLog,
      openWorkoutImportModal,
      closeWorkoutImportModal,
      handleWorkoutImportFile,
      handleWorkoutImportDrop,
      onWorkoutPasteInput,
      applyWorkoutImport,
      restoreDefaultWorkoutSplit,
      getWorkoutCoachContext,
      getWorkoutWeeklyReview,
      getTodayWorkoutStatus,
      getProgressiveOverloadSuggestion,
      parseSetRepTarget,
      parseRepsInput,
      getExerciseHistory,
      getLastExercisePerformance,
      calculateVolume,
      isCompoundExercise,
      detectPersonalRecord,
      estimateWorkoutImportWithAI,
      parseWorkoutTextLocally,
      getXCoachMemory,
      saveXCoachMemory,
      updateXCoachMemoryFromDiet,
      updateXCoachMemoryFromWorkoutLog,
      updateExerciseMemory,
      getUserLearningSummary,
      clearXCoachMemory,
      addCoachMemoryNote,
      inferUserPatterns,
      getPatternConfidence,
      refreshXCoachMemory
    });
  }
}

function removeStaleHeaderImportButtons() {
  const header = document.querySelector('.header-top');
  if (!header) return 0;
  let removed = 0;
  header.querySelectorAll('button').forEach((button) => {
    const text = (button.textContent || '').trim().toLowerCase();
    const inlineClick = button.getAttribute('onclick') || '';
    const assignedClick = button.onclick ? String(button.onclick) : '';
    if (text.includes('import diet') || inlineClick.includes('openImportModal') || assignedClick.includes('openImportModal')) {
      button.remove();
      removed += 1;
    }
  });
  return removed;
}

function removeStaleFloatingLogExtraButtons() {
  let removed = 0;
  document.querySelectorAll('.fab-extra').forEach((button) => {
    if ((button.textContent || '').toLowerCase().includes('log extra')) {
      button.remove();
      removed += 1;
    }
  });
  return removed;
}

function removeStaleImportShellElements() {
  return {
    headerImportButtonsRemoved: removeStaleHeaderImportButtons(),
    floatingLogExtraButtonsRemoved: removeStaleFloatingLogExtraButtons()
  };
}

function installShellRefreshGuards() {
  if (typeof renderAll === 'function' && !renderAll.__shellRefreshGuarded) {
    const originalRenderAll = renderAll;
    renderAll = function(...args) {
      removeStaleImportShellElements();
      const result = originalRenderAll.apply(this, args);
      removeStaleImportShellElements();
      return result;
    };
    renderAll.__shellRefreshGuarded = true;
  }

  if (typeof switchTab === 'function' && !switchTab.__shellRefreshGuarded) {
    const originalSwitchTab = switchTab;
    switchTab = function(...args) {
      const result = originalSwitchTab.apply(this, args);
      removeStaleImportShellElements();
      return result;
    };
    switchTab.__shellRefreshGuarded = true;
  }
}


// --- INIT ---
console.log("Diet Tracker version: move-import-buttons-cache-fix-1");
installShellRefreshGuards();
exposeGlobals();
const initialShellCleanup = removeStaleImportShellElements();
console.log("App shell loaded:", {
  version: "move-import-buttons-cache-fix-1",
  headerImportButtonsRemoved: initialShellCleanup.headerImportButtonsRemoved
});
renderAll();
const postRenderShellCleanup = removeStaleImportShellElements();
if (postRenderShellCleanup.headerImportButtonsRemoved !== initialShellCleanup.headerImportButtonsRemoved) {
  console.log("App shell cleanup after render:", postRenderShellCleanup);
}
setTimeout(() => {
  if (typeof showStartupCoachBrief === "function") {
    showStartupCoachBrief();
  }
}, 600);
initReminders();
