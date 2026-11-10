// Main Application Controller & UI Logic
class NutriApp {
  constructor() {
    this.currentTab = 'planner'; // 'planner' | 'recipes' | 'ingredients' | 'scan' | 'analytics' | 'total'
    this.activeDay = this.getTodayRomanianName();
    this.totalSubTab = 'recipes'; // 'recipes' | 'planner' | 'summary'
    this.scanSubTab = 'ean'; // 'ean' | 'receipt'
    this.recipeFilterCategory = 'Toate';
    this.recipeSearch = '';
    this.recipeMainTab = localStorage.getItem('nutri_recipe_tab') || 'proprii'; // 'proprii' | 'comune'
    this.ingFilterCategory = 'Toate';
    this.ingSearch = '';
    this.ingSortBy = 'name';
    this.dailyCalorieTarget = window.store ? window.store.getTargets().calories : 2000;

    this.editingRecipe = null;
    this.editingIngredient = null;
    this.activeModal = null;

    this.init();
  }

  getTodayRomanianName() {
    const daysMap = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
    const now = new Date();
    return daysMap[now.getDay()] || 'Luni';
  }

  getCurrentWeekDayDefinitions() {
    const dayNames = [
      { id: 'Luni', short: 'Lun' },
      { id: 'Marți', short: 'Mar' },
      { id: 'Miercuri', short: 'Mie' },
      { id: 'Joi', short: 'Joi' },
      { id: 'Vineri', short: 'Vin' },
      { id: 'Sâmbătă', short: 'Sâm' },
      { id: 'Duminică', short: 'Dum' }
    ];
    const monthsShort = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Noi', 'Dec'];
    const monthsFull = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

    const now = new Date();
    const jsDay = now.getDay();
    // Monday is index 0:
    const dayIndexInWeek = jsDay === 0 ? 6 : jsDay - 1;

    const monday = new Date(now);
    monday.setDate(now.getDate() - dayIndexInWeek);
    monday.setHours(0, 0, 0, 0);

    return dayNames.map((d, idx) => {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + idx);
      const isToday = idx === dayIndexInWeek;
      return {
        id: d.id,
        short: d.short,
        dateNum: String(dayDate.getDate()),
        monthShort: monthsShort[dayDate.getMonth()],
        monthFull: monthsFull[dayDate.getMonth()],
        isToday,
        fullDateStr: `${dayDate.getDate()} ${monthsFull[dayDate.getMonth()]}`
      };
    });
  }

  init() {
    window.alert = (msg) => this.showToast(msg, 'info');

    // Purge any corrupted ingredients from prior OCR sessions (e.g. ", X")
    if (window.store && window.store.data && window.store.data.ingredients) {
      const origLen = window.store.data.ingredients.length;
      window.store.data.ingredients = window.store.data.ingredients.filter(ing => {
        if (!ing || !ing.name) return false;
        const letters = ing.name.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
        if (letters.length < 2) return false;
        if (/^[,'.~`"_\-^#*]+\s*[xX*]/i.test(ing.name.trim())) return false;
        if (/^[xX*]$/i.test(ing.name.trim())) return false;
        return true;
      });
      if (window.store.data.ingredients.length !== origLen) {
        window.store.saveState();
      }
    }

    this.updateHeaderProfile();
    this.bindEvents();

    // Initialize Cloud Sync with Firebase
    if (typeof window.NutriCloudSync !== 'undefined' && window.store) {
      window.cloudSync = new window.NutriCloudSync(window.store);
      window.cloudSync.onStatusChange(() => this.updateHeaderSyncStatus());
      window.cloudSync.onAuthChange(() => this.updateHeaderSyncStatus());
      this.updateHeaderSyncStatus();

      // Check for auto-configure sync link (?sync_cfg=...)
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const syncCfgParam = urlParams.get('sync_cfg');
        if (syncCfgParam) {
          const decoded = JSON.parse(decodeURIComponent(atob(syncCfgParam)));
          if (decoded && (decoded.apiKey || decoded.projectId)) {
            window.cloudSync.saveConfig(decoded);
            window.cloudSync.initFirebase(decoded);
            const cleanUrl = window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            setTimeout(() => {
              this.showToast('Configurația Firebase a fost importată automat! Te poți autentifica acum.', 'success');
              this.openCloudSyncModal();
            }, 600);
          }
        }
      } catch (e) {
        console.warn('Eroare la parsarea parametrului sync_cfg:', e);
      }
    }

    window.store.subscribe(() => {
      this.updateHeaderProfile();
      this.renderCurrentView();
    });
    this.renderCurrentView();
  }

  bindEvents() {
    // Navigation Tabs (both floating dock and desktop header)
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-nav-tab');
        this.switchTab(tab);
      });
    });

    // Profile button in header (Avatar / User Greeting)
    const profileBtn = document.getElementById('btn-header-profile');
    if (profileBtn) {
      profileBtn.addEventListener('click', () => {
        this.openProfileModal();
      });
    }

    // Cloud Sync & Account button in header
    const cloudSyncBtn = document.getElementById('btn-open-cloud-sync');
    if (cloudSyncBtn) {
      cloudSyncBtn.addEventListener('click', () => {
        this.openCloudSyncModal();
      });
    }

    // Theme toggle button (Light / Dark mode from Pinterest Screenshot 3)
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('nutri_theme', isDark ? 'dark' : 'light');
      });
    }

    // Settings button in header (Caloric & Macronutrient targets)
    const settingsBtn = document.getElementById('btn-open-settings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    // AI Chef & Product Assistant button in header
    const assistantBtn = document.getElementById('btn-open-assistant');
    if (assistantBtn) {
      assistantBtn.addEventListener('click', () => {
        this.openAssistantModal('recipe');
      });
    }

    // Close modal on click outside or close buttons
    document.addEventListener('click', (e) => {
      if (e.target.hasAttribute('data-modal-backdrop') || e.target.closest('[data-modal-close]')) {
        this.closeModal();
      }
    });

    // Esc key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModal) {
        this.closeModal();
      }
    });
  }

  switchTab(tab) {
    this.currentTab = tab;

    // Update bottom floating dock tabs & desktop header tabs
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      const active = el.getAttribute('data-nav-tab') === tab;

      // Floating bottom dock tabs
      if (el.classList.contains('dock-tab')) {
        if (active) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      } else {
        // Desktop nav tab pills
        if (active) {
          el.className = 'px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 lg:gap-2 text-[#121319] bg-white dark:bg-white dark:text-[#121319] shadow-sm';
        } else {
          el.className = 'px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 lg:gap-2';
        }
      }
    });

    // Stop camera if leaving scanner
    if (tab !== 'scan' && window.barcodeScanner) {
      window.barcodeScanner.stopCamera();
    }

    this.updateHeaderProfile();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderCurrentView() {
    const main = document.getElementById('app-main');
    if (!main) return;

    switch (this.currentTab) {
      case 'planner':
        main.innerHTML = this.renderPlannerView();
        this.bindPlannerEvents();
        break;
      case 'recipes':
        main.innerHTML = this.renderRecipesView();
        this.bindRecipesEvents();
        break;
      case 'ingredients':
        main.innerHTML = this.renderIngredientsView();
        this.bindIngredientsEvents();
        break;
      case 'scan':
        main.innerHTML = this.renderScanView();
        this.bindScanEvents();
        break;
      case 'analytics':
        main.innerHTML = this.renderAnalyticsView();
        this.bindAnalyticsEvents();
        break;
      case 'total':
        main.innerHTML = this.renderTotalView();
        this.bindTotalEvents();
        break;
      default:
        main.innerHTML = this.renderPlannerView();
    }
  }

  // ==========================================
  // 1. WEEKLY PLANNER VIEW
  // ==========================================
  renderPlannerView() {
    const weekData = window.store.calculateWeek();
    const dayDefinitions = this.getCurrentWeekDayDefinitions();
    const activeDayDef = dayDefinitions.find(d => d.id === this.activeDay) || dayDefinitions[0];
    const activeDayData = weekData.days[this.activeDay] || { items: [], totals: { cost: 0, calories: 0, protein: 0, carbs: 0, fat: 0 } };
    const targets = window.store.getTargets();
    this.dailyCalorieTarget = targets.calories;

    const calPercent = Math.min(100, Math.round((activeDayData.totals.calories / targets.calories) * 100));

    return `
      <div class="space-y-6 pb-24">
        <!-- Top Weekly KPI Hero Card (Inspired by Pinterest Screenshot 1 & 3) -->
        <div class="bento-lilac-hero p-6 sm:p-7 bento-card relative">
          <!-- 3D Clay Aesthetic Background Art -->
          <div class="absolute right-3 -top-2 sm:right-6 sm:top-2 pointer-events-none opacity-90 clay-3d-element hidden xs:block">
            <svg width="150" height="150" viewBox="0 0 160 160" fill="none" class="w-24 h-24 sm:w-36 sm:h-36">
              <defs>
                <radialGradient id="clayGold" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#FFE082"/>
                  <stop offset="45%" stop-color="#FFB300"/>
                  <stop offset="100%" stop-color="#E65100"/>
                </radialGradient>
                <radialGradient id="claySlate" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#475569"/>
                  <stop offset="60%" stop-color="#1E293B"/>
                  <stop offset="100%" stop-color="#0F172A"/>
                </radialGradient>
                <radialGradient id="clayPink" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#FFA4CD"/>
                  <stop offset="60%" stop-color="#FF6FA4"/>
                  <stop offset="100%" stop-color="#D81B60"/>
                </radialGradient>
                <filter id="clayShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="6" flood-opacity="0.25"/>
                </filter>
              </defs>
              <circle cx="85" cy="50" r="32" fill="url(#clayGold)" filter="url(#clayShadow)"/>
              <circle cx="85" cy="50" r="14" fill="#B8A9FD"/>
              <circle cx="115" cy="100" r="24" fill="url(#clayPink)" filter="url(#clayShadow)"/>
              <rect x="35" y="70" width="46" height="46" rx="16" fill="url(#claySlate)" transform="rotate(-15 35 70)" filter="url(#clayShadow)"/>
              <circle cx="58" cy="93" r="8" fill="#B8A9FD"/>
            </svg>
          </div>

          <div class="relative z-10 max-w-xl">
            <div class="flex items-center gap-2 mb-2">
              <span class="pill-badge pill-badge-translucent">
                <span class="w-2 h-2 rounded-full bg-[#121319] dark:bg-white animate-pulse"></span>
                Provocarea Zilei
              </span>
              <span class="text-xs font-semibold opacity-85 hidden sm:inline">Target Săptămânal</span>
            </div>

            <h2 class="text-2xl sm:text-3xl font-extrabold font-display leading-tight tracking-tight text-[#121319] dark:text-white">
              Cost & Macronutrienți Săptămână
            </h2>
            <p class="text-xs sm:text-sm mt-1 opacity-85 text-[#121319] dark:text-white font-medium max-w-md">
              Atinge targetul tău de proteine și calorii menținând bugetul optimizat per porție.
            </p>

            <!-- 4 Bento Metric Pills inside Hero Card -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5">
              <div class="bg-white/75 dark:bg-black/35 backdrop-blur-md rounded-2xl p-3 border border-white/80 dark:border-white/10 text-center shadow-xs">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Cost Total</div>
                <div class="text-lg sm:text-xl font-extrabold text-[#121319] dark:text-white mt-0.5">${weekData.totals.cost.toFixed(2)} <span class="text-xs font-semibold">RON</span></div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${weekData.totals.avgDailyCost.toFixed(1)} RON/zi</div>
              </div>
              <div class="bg-white/75 dark:bg-black/35 backdrop-blur-md rounded-2xl p-3 border border-white/80 dark:border-white/10 text-center shadow-xs">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Calorii</div>
                <div class="text-lg sm:text-xl font-extrabold text-[#121319] dark:text-white mt-0.5">${Math.round(weekData.totals.calories)} <span class="text-xs font-semibold">kcal</span></div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${Math.round(weekData.totals.avgDailyCalories)} kcal/zi</div>
              </div>
              <div class="bg-white/75 dark:bg-black/35 backdrop-blur-md rounded-2xl p-3 border border-white/80 dark:border-white/10 text-center shadow-xs">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Proteine</div>
                <div class="text-lg sm:text-xl font-extrabold text-[#E02868] dark:text-[#FFA4CD] mt-0.5">${Math.round(weekData.totals.protein)} <span class="text-xs font-semibold">g</span></div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${Math.round(weekData.totals.avgDailyProtein)} g/zi</div>
              </div>
              <div class="bg-white/75 dark:bg-black/35 backdrop-blur-md rounded-2xl p-3 border border-white/80 dark:border-white/10 text-center shadow-xs">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Carbi & Grăsimi</div>
                <div class="text-sm font-extrabold text-slate-800 dark:text-slate-100 mt-1.5">${Math.round(weekData.totals.carbs)}g C • ${Math.round(weekData.totals.fat)}g G</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">${Math.round(weekData.totals.avgDailyCarbs)}g / ${Math.round(weekData.totals.avgDailyFat)}g</div>
              </div>
            </div>

            <!-- Quick Action button -->
            <div class="mt-4 flex items-center justify-between">
              <button id="btn-quick-shop" class="btn-pill btn-pill-dark text-xs sm:text-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
                <span>Listă Cumpărături</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Dynamic Floating Day Island (Sticky on Scroll) -->
        <div class="floating-island-container">
          <div id="floating-day-nav" class="floating-day-island" role="navigation" aria-label="Navigator Zi Curentă">
            <!-- Prev Day Arrow (<) -->
            <button id="btn-day-prev" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-90 transition" title="Ziua anterioară (sau swipe spre dreapta)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>

            <!-- Center Day Info (Click to open day picker) -->
            <button id="btn-open-day-picker" class="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-slate-100/60 dark:hover:bg-white/10 active:scale-95 transition group" title="Apasă pentru selector rapid de zile">
              <span class="relative flex h-2.5 w-2.5 items-center justify-center">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A390F5] opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-gradient-to-tr from-[#A390F5] to-[#FF6FA4]"></span>
              </span>
              <span class="text-sm sm:text-base font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
                ${this.activeDay === 'ALL' ? 'Toată Săptămâna' : (activeDayDef ? activeDayDef.id : this.activeDay)}
              </span>
              ${this.activeDay === 'ALL' ? `
                <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  7 Zile
                </span>
              ` : `
                <span class="text-[11px] font-bold text-[#6D4AE8] dark:text-[#C4B5FD] bg-[#6D4AE8]/10 dark:bg-[#C4B5FD]/15 px-2.5 py-0.5 rounded-full border border-[#6D4AE8]/20 dark:border-[#C4B5FD]/25">
                  ${activeDayDef ? `${activeDayDef.dateNum} ${activeDayDef.monthShort}${activeDayDef.isToday ? ' • Azi' : ''}` : ''}
                </span>
              `}
              <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/></svg>
            </button>

            <!-- Next Day Arrow (>) -->
            <button id="btn-day-next" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/10 active:scale-90 transition" title="Ziua următoare (sau swipe spre stânga)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <!-- Single Day View or Overview Table with Horizontal Swipe Support -->
        <div id="planner-day-container" class="touch-pan-y">
          ${this.activeDay === 'ALL' ? this.renderAllDaysOverview(weekData) : this.renderSingleDayView(this.activeDay, activeDayData, calPercent)}
        </div>
      </div>
    `;
  }

  renderSingleDayView(day, dayData, calPercent) {
    const targets = window.store.getTargets();
    const mealThemes = [
      {
        id: 'Mic Dejun',
        title: 'Mic Dejun',
        badge: 'Mic Dejun / Snacks',
        colorClass: 'bento-apricot',
        iconSvg: `
          <svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="5" stroke-width="2"/>
            <path stroke-linecap="round" stroke-width="2" d="M12 2v2m0 16v2M2 12h2m16 0h2m-3.5-6.5l-1.5 1.5m-10 10l-1.5 1.5m13 0l-1.5-1.5m-10-10l-1.5-1.5"/>
          </svg>
        `
      },
      {
        id: 'Prânz',
        title: 'Prânz',
        badge: 'Mese Principale',
        colorClass: 'bento-sky',
        iconSvg: `
          <svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        `
      },
      {
        id: 'Snack',
        title: 'Gustare / Snack',
        badge: 'Snack & Energie',
        colorClass: 'bento-pink',
        iconSvg: `
          <svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
          </svg>
        `
      },
      {
        id: 'Cină',
        title: 'Cină',
        badge: 'Cină Ușoară',
        colorClass: 'bento-mint',
        iconSvg: `
          <svg class="w-8 h-8 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
          </svg>
        `
      }
    ];

    return `
      <div class="space-y-6">
        <!-- Section Header: "Planul tău" (Pinterest Screenshot 1 & 3) -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <div class="flex items-center gap-3">
              <h3 class="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
                Planul tău
              </h3>
              <span class="pill-badge pill-badge-translucent">
                ${day} • ${dayData.items.length} ${dayData.items.length === 1 ? 'preparat' : 'preparate'}
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mesele și aportul nutrițional calculate în timp real</p>
          </div>

          <!-- Quick Day Actions -->
          <div class="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
            <button id="btn-planner-settings" class="btn-pill btn-pill-white !py-2 !px-1.5 sm:!px-3 text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm" title="Configurează necesarul caloric & macronutrienți">
              <svg class="w-3.5 h-3.5 text-[#6D4AE8] dark:text-[#C4B5FD] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
              <span class="tracking-tight">Setări Ținte</span>
            </button>
            <button id="btn-copy-day" class="btn-pill btn-pill-white !py-2 !px-1.5 sm:!px-3 text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-sm">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
              <span class="tracking-tight">Copiază ziua</span>
            </button>
            <button id="btn-clear-day" class="btn-pill btn-pill-white !py-2 !px-1.5 sm:!px-3 text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap text-rose-600 hover:text-rose-700 shadow-sm">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              <span class="tracking-tight">Golește</span>
            </button>
          </div>
        </div>

        <!-- Daily Nutri Stats Bento Card & Calorie Target Progress -->
        <div class="bento-card bento-white p-5 border border-[#E5E0F5] dark:border-white/10">
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center mb-4">
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cost Zi</div>
              <div class="text-base sm:text-lg font-extrabold text-[#218352] dark:text-[#70D6A3] mt-0.5">${dayData.totals.cost.toFixed(2)} <span class="text-xs">RON</span></div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Calorii</div>
              <div class="text-base sm:text-lg font-extrabold text-[#6D4AE8] dark:text-[#C4B5FD] mt-0.5">${Math.round(dayData.totals.calories)} <span class="text-xs">kcal</span></div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">țintă ${targets.calories}</div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proteine</div>
              <div class="text-base sm:text-lg font-extrabold text-[#E02868] dark:text-[#FFA4CD] mt-0.5">${dayData.totals.protein.toFixed(1)} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">țintă ${targets.protein}g</div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Carbi</div>
              <div class="text-base sm:text-lg font-extrabold text-[#D97706] dark:text-[#FFC480] mt-0.5">${dayData.totals.carbs.toFixed(1)} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">țintă ${targets.carbs}g</div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5 col-span-2 sm:col-span-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Grăsimi</div>
              <div class="text-base sm:text-lg font-extrabold text-[#0284C7] dark:text-[#98DDFE] mt-0.5">${dayData.totals.fat.toFixed(1)} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">țintă ${targets.fat}g</div>
            </div>
          </div>

          <!-- Calorie & Macronutrient Targets Progress Bars -->
          <div class="space-y-3 pt-3 border-t border-slate-100 dark:border-white/5">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-slate-800 dark:text-white">Aport vs. Obiectiv</span>
              <button id="btn-edit-targets-quick" class="p-1.5 text-slate-400 hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] hover:bg-brand-lilac/10 dark:hover:bg-white/5 rounded-full transition" title="Configurare Obiectiv">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
              </button>
            </div>

            <!-- Calories Progress Bar -->
            <div class="space-y-1">
              <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span class="font-bold text-slate-700 dark:text-slate-300">Calorii</span>
                <span class="font-black text-slate-900 dark:text-white">${Math.round(dayData.totals.calories)} / ${targets.calories} kcal (${calPercent}%)</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300 ${calPercent > 100 ? 'bg-amber-400' : 'bg-gradient-to-r from-[#A390F5] to-[#70D6A3]'}" style="width: ${Math.min(100, calPercent)}%"></div>
              </div>
            </div>

            <!-- 3 Mini Macro Progress Bars (Protein, Carbs, Fat) -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div class="bg-slate-50 dark:bg-white/5 rounded-xl p-2 border border-slate-100 dark:border-white/5">
                <div class="flex justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span class="text-[#E02868] dark:text-[#FFA4CD]">Proteine</span>
                  <span>${dayData.totals.protein.toFixed(1)} / ${targets.protein}g</span>
                </div>
                <div class="w-full bg-slate-200/70 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full rounded-full bg-[#E02868] dark:bg-[#FFA4CD] transition-all" style="width: ${Math.min(100, Math.round((dayData.totals.protein / targets.protein) * 100))}%"></div>
                </div>
              </div>

              <div class="bg-slate-50 dark:bg-white/5 rounded-xl p-2 border border-slate-100 dark:border-white/5">
                <div class="flex justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span class="text-[#D97706] dark:text-[#FFC480]">Carbohidrați</span>
                  <span>${dayData.totals.carbs.toFixed(1)} / ${targets.carbs}g</span>
                </div>
                <div class="w-full bg-slate-200/70 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full rounded-full bg-[#D97706] dark:bg-[#FFC480] transition-all" style="width: ${Math.min(100, Math.round((dayData.totals.carbs / targets.carbs) * 100))}%"></div>
                </div>
              </div>

              <div class="bg-slate-50 dark:bg-white/5 rounded-xl p-2 border border-slate-100 dark:border-white/5">
                <div class="flex justify-between text-[10.5px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  <span class="text-[#0284C7] dark:text-[#98DDFE]">Grăsimi</span>
                  <span>${dayData.totals.fat.toFixed(1)} / ${targets.fat}g</span>
                </div>
                <div class="w-full bg-slate-200/70 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div class="h-full rounded-full bg-[#0284C7] dark:bg-[#98DDFE] transition-all" style="width: ${Math.min(100, Math.round((dayData.totals.fat / targets.fat) * 100))}%"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Bento Grid of 4 Meals (Screenshots 1 & 3: Warm Apricot, Sky Blue, Pink, Mint) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${mealThemes.map(meal => {
            const mealItems = dayData.items.filter(i => i.meal === meal.id);
            const mealCost = mealItems.reduce((acc, it) => acc + it.cost, 0);
            const mealCals = mealItems.reduce((acc, it) => acc + it.calories, 0);

            return `
              <div class="bento-card ${meal.colorClass} p-3.5 sm:p-6 flex flex-col justify-between">
                <div>
                  <!-- Meal Card Header -->
                  <div class="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 class="text-xl sm:text-2xl font-extrabold font-display leading-tight tracking-tight">
                        ${meal.title}
                      </h4>
                      ${mealItems.length > 0 ? `
                        <div class="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                          ${mealCost.toFixed(2)} RON • ${Math.round(mealCals)} kcal
                        </div>
                      ` : ''}
                    </div>

                    <div class="flex items-center gap-1.5 sm:gap-2">
                      <div class="hidden sm:block">
                        ${meal.iconSvg}
                      </div>
                      ${mealItems.length > 0 ? `
                        <button data-copy-meal="${meal.id}" class="btn-pill btn-pill-white text-xs py-2 px-2.5 sm:px-3 shadow-xs flex items-center gap-1.5" title="Copiază această masă în altă zi sau masă">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                          <span class="hidden xs:inline sm:inline">Copiază</span>
                        </button>
                      ` : ''}
                      <button data-add-meal-recipe="${meal.id}" class="btn-pill btn-pill-dark text-xs py-2 px-3 shadow-xs">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
                        <span>Adaugă</span>
                      </button>
                    </div>
                  </div>

                  <!-- Meal Items or Empty State -->
                  ${mealItems.length === 0 ? `
                    <div class="text-center py-6 border-2 border-dashed border-black/10 dark:border-white/10 rounded-2xl bg-white/40 dark:bg-black/20 text-xs font-medium opacity-70">
                      Nicio rețetă planificată. Apasă pe "+ Adaugă".
                    </div>
                  ` : `
                    <div class="space-y-2.5">
                      ${mealItems.map(item => `
                        <div class="bg-white/95 dark:bg-[#181924]/95 backdrop-blur-md rounded-2xl border border-white/60 dark:border-white/10 p-2.5 sm:p-3.5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 min-w-0">
                              <button type="button" data-open-plan-recipe="${item.recipeId}" data-is-ing="${item.isIngredient ? 'true' : 'false'}" class="text-left font-extrabold text-sm text-slate-900 dark:text-white truncate leading-snug hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] transition cursor-pointer flex items-center gap-1.5 group" title="Apasă pentru detalii și editare ingrediente">
                                <span class="truncate group-hover:underline">${item.recipeName}</span>
                                <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-[#6D4AE8] dark:group-hover:text-[#C4B5FD] flex-shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              </button>
                              ${item.isIngredient ? `
                                <span class="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                                  Aliment
                                </span>
                              ` : ''}
                            </div>
                            <!-- Single row: Price, Calories, Protein, Carbs, Fat (sized to fit all screens) -->
                            <div class="flex items-center gap-1 sm:gap-1.5 mt-1 text-[10.5px] sm:text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden">
                              <span class="font-black text-[#218352] dark:text-[#70D6A3] text-[11px] sm:text-xs">${item.cost.toFixed(2)} lei</span>
                              <span class="text-slate-300 dark:text-slate-600">•</span>
                              <span class="font-bold text-slate-800 dark:text-slate-200">${Math.round(item.calories)} kcal</span>
                              <span class="text-slate-300 dark:text-slate-600">•</span>
                              <span class="text-[#E02868] dark:text-[#FFA4CD] font-bold">${item.protein.toFixed(1)}g P</span>
                              <span class="text-slate-300 dark:text-slate-600">•</span>
                              <span class="text-[#D97706] dark:text-[#FFC480] font-bold">${item.carbs.toFixed(1)}g C</span>
                              <span class="text-slate-300 dark:text-slate-600">•</span>
                              <span class="text-[#0284C7] dark:text-[#98DDFE] font-bold">${item.fat.toFixed(1)}g G</span>
                            </div>
                          </div>

                          <!-- Portions / Grams control, Copy item & Delete -->
                          <div class="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/10 flex-shrink-0">
                            <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-2xl p-0.5">
                              <button data-portion-minus="${item.id}" data-is-ing="${item.isIngredient ? 'true' : 'false'}" class="w-6 h-6 flex items-center justify-center rounded-xl bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="${item.isIngredient ? 'Scade 10g' : 'Scade 0.5 porții'}">
                                −
                              </button>
                              <div class="flex items-center px-1">
                                <input type="number" step="${item.isIngredient ? '1' : '0.5'}" min="${item.isIngredient ? '1' : '0.1'}" data-portion-input="${item.id}" data-is-ing="${item.isIngredient ? 'true' : 'false'}" value="${item.isIngredient ? Math.round(item.portions * 100) : item.portions}" class="w-12 text-center text-xs font-extrabold text-slate-800 dark:text-white bg-transparent focus:bg-white dark:focus:bg-[#181924] focus:outline-none focus:ring-1 focus:ring-brand-lilac rounded py-0.5 transition" title="${item.isIngredient ? 'Modifică gramajul manual' : 'Modifică numărul de porții'}">
                                <span class="text-[10px] text-slate-400 dark:text-white/40 font-bold ml-0.5 pointer-events-none">${item.isIngredient ? 'g' : 'p'}</span>
                              </div>
                              <button data-portion-plus="${item.id}" data-is-ing="${item.isIngredient ? 'true' : 'false'}" class="w-6 h-6 flex items-center justify-center rounded-xl bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="${item.isIngredient ? 'Crește 10g' : 'Crește 0.5 porții'}">
                                +
                              </button>
                            </div>
                            <div class="flex items-center gap-1">
                              <button data-edit-plan-recipe="${item.recipeId}" data-is-ing="${item.isIngredient ? 'true' : 'false'}" class="p-1.5 text-slate-400 hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] rounded-full hover:bg-brand-lilac/15 transition" title="${item.isIngredient ? 'Editează alimentul' : 'Editează ingredientele rețetei'}">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                              <button data-copy-plan-item="${item.id}" class="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Copiază acest preparat în altă zi/masă">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
                              </button>
                              <button data-delete-plan-item="${item.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Șterge din plan">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      `).join('')}
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  renderAllDaysOverview(weekData) {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    return `
      <div class="space-y-4">
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-extrabold font-display text-slate-900 dark:text-white">Privire de Ansamblu Săptămânală</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Totalurile celor 7 zile din săptămână</p>
            </div>
            <span class="pill-badge pill-badge-translucent">7 Zile Active</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                  <th class="py-3 px-3.5 font-bold rounded-l-xl">Ziua</th>
                  <th class="py-3 px-3.5 font-bold">Mese</th>
                  <th class="py-3 px-3.5 font-bold text-[#218352] dark:text-[#70D6A3]">Cost (RON)</th>
                  <th class="py-3 px-3.5 font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">Calorii</th>
                  <th class="py-3 px-3.5 font-bold text-[#E02868] dark:text-[#FFA4CD]">Proteine</th>
                  <th class="py-3 px-3.5 font-bold text-[#D97706] dark:text-[#FFC480]">Carbi</th>
                  <th class="py-3 px-3.5 font-bold text-[#0284C7] dark:text-[#98DDFE]">Grăsimi</th>
                  <th class="py-3 px-3.5 font-bold text-right rounded-r-xl">Acțiuni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                ${days.map(day => {
                  const d = weekData.days[day];
                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                      <td class="py-3.5 px-3.5 font-extrabold text-slate-900 dark:text-white">${day}</td>
                      <td class="py-3.5 px-3.5 text-slate-600 dark:text-slate-400">${d.items.length}</td>
                      <td class="py-3.5 px-3.5 font-extrabold text-[#218352] dark:text-[#70D6A3]">${d.totals.cost.toFixed(2)} RON</td>
                      <td class="py-3.5 px-3.5 font-semibold text-slate-700 dark:text-slate-300">${Math.round(d.totals.calories)} kcal</td>
                      <td class="py-3.5 px-3.5 text-[#E02868] dark:text-[#FFA4CD] font-bold">${d.totals.protein.toFixed(1)}g</td>
                      <td class="py-3.5 px-3.5 text-[#D97706] dark:text-[#FFC480] font-bold">${d.totals.carbs.toFixed(1)}g</td>
                      <td class="py-3.5 px-3.5 text-[#0284C7] dark:text-[#98DDFE] font-bold">${d.totals.fat.toFixed(1)}g</td>
                      <td class="py-3.5 px-3.5 text-right">
                        <button data-switch-day="${day}" class="btn-pill btn-pill-dark text-xs py-1.5 px-3">
                          Deschide
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-slate-100/90 dark:bg-white/10 font-bold border-t-2 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  <td class="py-3.5 px-3.5 font-extrabold">TOTAL SĂPTĂMÂNĂ</td>
                  <td class="py-3.5 px-3.5">-</td>
                  <td class="py-3.5 px-3.5 text-[#218352] dark:text-[#70D6A3] font-black">${weekData.totals.cost.toFixed(2)} RON</td>
                  <td class="py-3.5 px-3.5 font-bold">${Math.round(weekData.totals.calories)} kcal</td>
                  <td class="py-3.5 px-3.5 text-[#E02868] dark:text-[#FFA4CD]">${Math.round(weekData.totals.protein)}g</td>
                  <td class="py-3.5 px-3.5 text-[#D97706] dark:text-[#FFC480]">${Math.round(weekData.totals.carbs)}g</td>
                  <td class="py-3.5 px-3.5 text-[#0284C7] dark:text-[#98DDFE]">${Math.round(weekData.totals.fat)}g</td>
                  <td></td>
                </tr>
                <tr class="bg-slate-50 dark:bg-white/5 font-semibold text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-white/5">
                  <td class="py-3 px-3.5">MEDIE ZILNICĂ</td>
                  <td class="py-3 px-3.5">-</td>
                  <td class="py-3 px-3.5 text-[#218352] dark:text-[#70D6A3] font-bold">${weekData.totals.avgDailyCost.toFixed(2)} RON</td>
                  <td class="py-3 px-3.5">${Math.round(weekData.totals.avgDailyCalories)} kcal</td>
                  <td class="py-3 px-3.5 text-[#E02868] dark:text-[#FFA4CD]">${Math.round(weekData.totals.avgDailyProtein)}g</td>
                  <td class="py-3 px-3.5 text-[#D97706] dark:text-[#FFC480]">${Math.round(weekData.totals.avgDailyCarbs)}g</td>
                  <td class="py-3 px-3.5 text-[#0284C7] dark:text-[#98DDFE]">${Math.round(weekData.totals.avgDailyFat)}g</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  goToPrevDay() {
    const dayOrder = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    let idx = dayOrder.indexOf(this.activeDay);
    if (idx === -1) idx = 0;
    idx = (idx - 1 + dayOrder.length) % dayOrder.length;
    this.activeDay = dayOrder[idx];
    this.renderCurrentView();
  }

  goToNextDay() {
    const dayOrder = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    let idx = dayOrder.indexOf(this.activeDay);
    if (idx === -1) idx = 0;
    idx = (idx + 1) % dayOrder.length;
    this.activeDay = dayOrder[idx];
    this.renderCurrentView();
  }

  openDayPickerModal() {
    const dayDefinitions = this.getCurrentWeekDayDefinitions();
    const weekData = window.store.calculateWeek();
    const html = `
      <div class="p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-brand-lilac/20 flex items-center justify-center text-[#6D4AE8] dark:text-[#C4B5FD]">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white font-display">Alege Ziua din Plan</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Poți naviga și prin swipe stânga / dreapta pe ecran</p>
          </div>
        </div>
        <button data-modal-close="true" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="p-4 sm:p-5 space-y-2.5 max-h-[70vh] overflow-y-auto">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${dayDefinitions.map(d => {
            const isSelected = this.activeDay === d.id;
            const totals = weekData.days[d.id]?.totals || { cost: 0, calories: 0 };
            const itemsCount = (window.store.data.weeklyPlan[d.id] || []).length;
            return `
              <button data-select-day="${d.id}" class="p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${isSelected ? 'border-[#6D4AE8] bg-brand-lilac/10 font-bold ring-2 ring-[#6D4AE8]/20' : 'border-[#E5E0F5] dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-[#181924]'}">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-extrabold text-slate-900 dark:text-white">${d.id}</span>
                    <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500">${d.dateNum} ${d.monthFull}</span>
                    ${d.isToday ? '<span class="text-[9px] bg-brand-lilac/30 text-[#6D4AE8] dark:text-[#C4B5FD] px-1.5 py-0.5 rounded-full font-black uppercase">Azi</span>' : ''}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ${itemsCount > 0 ? `${itemsCount} prep. • ${Math.round(totals.calories)} kcal • ${totals.cost.toFixed(1)} RON` : '<span class="italic text-slate-400">Nicio masă adăugată</span>'}
                  </div>
                </div>
                ${isSelected ? '<span class="w-2.5 h-2.5 rounded-full bg-[#6D4AE8] dark:bg-[#C4B5FD] flex-shrink-0"></span>' : ''}
              </button>
            `;
          }).join('')}
        </div>

        <button data-select-day="ALL" class="w-full p-3.5 rounded-2xl border text-center transition flex items-center justify-center gap-2 ${this.activeDay === 'ALL' ? 'border-[#6D4AE8] bg-brand-lilac/10 font-bold ring-2 ring-[#6D4AE8]/20' : 'border-[#E5E0F5] dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-[#181924]'}">
          <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          <span class="text-sm font-extrabold text-slate-900 dark:text-white">Toată Săptămâna (Tabel & Prezentare Generală)</span>
        </button>
      </div>
    `;
    this.openModal(html, { maxWidth: 'max-w-lg', position: 'center' });
    document.querySelectorAll('[data-select-day]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = e.currentTarget.getAttribute('data-select-day');
        this.activeDay = day;
        this.closeModal();
        this.renderCurrentView();
      });
    });
  }

  bindDaySwipeGestures() {
    const swipeTargets = [
      document.getElementById('planner-day-container'),
      document.getElementById('floating-day-nav'),
      document.querySelector('.floating-island-container')
    ].filter(Boolean);

    if (swipeTargets.length === 0) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const onTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const onTouchEnd = (e) => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      const deltaTime = Date.now() - touchStartTime;

      // Condition: Fast enough (< 800ms), sufficient distance (>= 40px), and primarily horizontal
      if (deltaTime < 800 && Math.abs(deltaX) >= 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        if (e.target && e.target.closest('input, textarea, select, [data-portion-plus], [data-portion-minus], [data-delete-plan-item]')) {
          if (Math.abs(deltaX) < 65) return;
        }

        if (deltaX > 40) {
          // Swipe spre dreapta -> o zi in urma
          this.goToPrevDay();
        } else if (deltaX < -40) {
          // Swipe spre stanga -> o zi dupa
          this.goToNextDay();
        }
      }
    };

    swipeTargets.forEach(target => {
      target.addEventListener('touchstart', onTouchStart, { passive: true });
      target.addEventListener('touchend', onTouchEnd, { passive: true });
    });
  }

  bindPlannerEvents() {
    // Floating day navigator controls
    const prevBtn = document.getElementById('btn-day-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.goToPrevDay());
    }

    const nextBtn = document.getElementById('btn-day-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.goToNextDay());
    }

    const pickerBtn = document.getElementById('btn-open-day-picker');
    if (pickerBtn) {
      pickerBtn.addEventListener('click', () => this.openDayPickerModal());
    }

    // Touch swipe gestures (swipe right -> prev day, swipe left -> next day)
    this.bindDaySwipeGestures();

    // Sticky Floating Island scroll state detection
    const island = document.getElementById('floating-day-nav');
    if (island) {
      const handleScroll = () => {
        if (window.scrollY > 100) {
          island.classList.add('is-scrolled');
        } else {
          island.classList.remove('is-scrolled');
        }
      };
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
    }

    // Day switcher buttons
    document.querySelectorAll('[data-day-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const day = e.currentTarget.getAttribute('data-day-btn');
        this.activeDay = day;
        this.renderCurrentView();
      });
    });

    document.querySelectorAll('[data-switch-day]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeDay = e.currentTarget.getAttribute('data-switch-day');
        this.renderCurrentView();
      });
    });

    // Add recipe to meal
    document.querySelectorAll('[data-add-meal-recipe]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const meal = e.currentTarget.getAttribute('data-add-meal-recipe');
        this.openAddRecipeToMealModal(this.activeDay, meal);
      });
    });

    // Direct manual input for portion / gramaj in day plan
    document.querySelectorAll('[data-portion-input]').forEach(input => {
      const applyInput = () => {
        const itemId = input.getAttribute('data-portion-input');
        const isIng = input.getAttribute('data-is-ing') === 'true';
        const val = parseFloat(input.value);
        if (isNaN(val) || val <= 0) return;
        const finalServings = isIng ? Math.max(0.01, val / 100) : Math.max(0.1, val);
        window.store.updatePlanItemServings(this.activeDay, itemId, finalServings);
      };

      input.addEventListener('change', applyInput);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          input.blur();
        }
      });
    });

    // Portion plus / minus
    document.querySelectorAll('[data-portion-minus]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-portion-minus');
        const isIng = e.currentTarget.getAttribute('data-is-ing') === 'true';
        const item = (window.store.data.weeklyPlan[this.activeDay] || []).find(i => i.id === itemId);
        if (item) {
          if (isIng) {
            const curGrams = Math.round(item.servings * 100);
            const newGrams = Math.max(5, curGrams - 10);
            window.store.updatePlanItemServings(this.activeDay, itemId, newGrams / 100);
          } else if (item.servings > 0.5) {
            window.store.updatePlanItemServings(this.activeDay, itemId, Math.round((item.servings - 0.5) * 10) / 10);
          }
        }
      });
    });

    document.querySelectorAll('[data-portion-plus]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-portion-plus');
        const isIng = e.currentTarget.getAttribute('data-is-ing') === 'true';
        const item = (window.store.data.weeklyPlan[this.activeDay] || []).find(i => i.id === itemId);
        if (item) {
          if (isIng) {
            const curGrams = Math.round(item.servings * 100);
            const newGrams = curGrams + 10;
            window.store.updatePlanItemServings(this.activeDay, itemId, newGrams / 100);
          } else {
            window.store.updatePlanItemServings(this.activeDay, itemId, Math.round((item.servings + 0.5) * 10) / 10);
          }
        }
      });
    });

    // Delete item from plan
    document.querySelectorAll('[data-delete-plan-item]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-delete-plan-item');
        window.store.removePlanItem(this.activeDay, itemId);
      });
    });

    // Copy meal
    document.querySelectorAll('[data-copy-meal]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const meal = e.currentTarget.getAttribute('data-copy-meal');
        this.openCopyMealModal(this.activeDay, meal);
      });
    });

    // Copy single plan item
    document.querySelectorAll('[data-copy-plan-item]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-copy-plan-item');
        this.openCopyPlanItemModal(this.activeDay, itemId);
      });
    });

    // Open recipe or ingredient details modal from plan
    document.querySelectorAll('[data-open-plan-recipe]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recipeId = e.currentTarget.getAttribute('data-open-plan-recipe');
        const isIng = e.currentTarget.getAttribute('data-is-ing') === 'true';
        if (isIng) {
          const ing = window.store.getIngredientById(recipeId);
          if (ing) {
            this.openIngredientModal(ing);
          } else {
            this.showToast('Alimentul nu a fost găsit.', 'warning');
          }
        } else {
          const rec = window.store.getRecipeById(recipeId);
          if (rec) {
            this.openRecipeDetailsModal(recipeId);
          } else {
            this.showToast('Rețeta nu a fost găsită.', 'warning');
          }
        }
      });
    });

    // Directly open edit builder for recipe or ingredient from plan
    document.querySelectorAll('[data-edit-plan-recipe]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const recipeId = e.currentTarget.getAttribute('data-edit-plan-recipe');
        const isIng = e.currentTarget.getAttribute('data-is-ing') === 'true';
        if (isIng) {
          const ing = window.store.getIngredientById(recipeId);
          if (ing) {
            this.openIngredientModal(ing);
          } else {
            this.showToast('Alimentul nu a fost găsit.', 'warning');
          }
        } else {
          const rec = window.store.getRecipeById(recipeId);
          if (rec) {
            this.openRecipeBuilderModal(rec);
          } else {
            this.showToast('Rețeta nu a fost găsită.', 'warning');
          }
        }
      });
    });

    // Settings targets buttons
    const plannerSettingsBtn = document.getElementById('btn-planner-settings');
    if (plannerSettingsBtn) {
      plannerSettingsBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    const editTargetsQuickBtn = document.getElementById('btn-edit-targets-quick');
    if (editTargetsQuickBtn) {
      editTargetsQuickBtn.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    // Copy day
    const copyBtn = document.getElementById('btn-copy-day');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        this.openCopyDayModal();
      });
    }

    // Clear day
    const clearBtn = document.getElementById('btn-clear-day');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.showConfirmModal({
          title: 'Golește Planul Zilei',
          message: `Ești sigur că vrei să golești toate mesele planificate pentru ziua de ${this.activeDay}?`,
          confirmText: 'Da, golește',
          isDanger: true,
          onConfirm: () => {
            window.store.clearDay(this.activeDay);
            this.showToast(`Planul pentru ziua de ${this.activeDay} a fost golit.`, 'info');
          }
        });
      });
    }

    // Quick shop button
    const shopBtn = document.getElementById('btn-quick-shop');
    if (shopBtn) {
      shopBtn.addEventListener('click', () => {
        this.switchTab('analytics');
      });
    }
  }

  // ==========================================
  // 2. RECIPES & CALCULATOR VIEW
  // ==========================================
  renderRecipesView() {
    const categories = window.INITIAL_DATA.recipeCategories || ['Toate', 'Snacks / Mic Dejun', 'Mese Mari'];
    const counts = window.store.getRecipeCounts ? window.store.getRecipeCounts() : { total: 0, custom: 0, common: 0 };
    const recipes = window.store.getRecipes(this.recipeFilterCategory, this.recipeSearch, this.recipeMainTab);

    return `
      <div class="space-y-6 pb-24">
        <!-- Header & Action Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm">
          <div>
            <div class="flex items-center gap-2">
              <span class="pill-badge pill-badge-translucent">Rețetar Nutrițional</span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white mt-1">
              Rețete & Calculator Cost / Macro
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Calculează automat costul per porție și distribuția macronutrienților</p>
          </div>
          <div class="grid grid-cols-2 gap-2 sm:flex sm:items-center w-full sm:w-auto">
            <button id="btn-open-assistant-recipes" class="btn-pill btn-pill-primary text-xs sm:text-sm py-2 px-3 shadow flex items-center justify-center gap-1.5 truncate">
              <svg class="w-4 h-4 animate-pulse text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span class="truncate">Asistent AI</span>
            </button>
            <button id="btn-create-recipe" class="btn-pill btn-pill-dark text-xs sm:text-sm py-2 px-3 shadow flex items-center justify-center gap-1.5 truncate">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
              <span class="truncate">Creează Rețetă</span>
            </button>
          </div>
        </div>

        <!-- Primary Tabs: Proprii (FIRST) & Comune (SECOND) -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 p-1.5 bg-slate-100/80 dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 w-full sm:w-auto">
            <button data-recipe-main-tab="proprii" class="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 ${
              this.recipeMainTab === 'proprii'
                ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
              <span>Proprii</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${
                this.recipeMainTab === 'proprii'
                  ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#121319]'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
              }">${counts.custom}</span>
            </button>

            <button data-recipe-main-tab="comune" class="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition flex items-center justify-center gap-2 ${
              this.recipeMainTab === 'comune'
                ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              <span>Comune</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${
                this.recipeMainTab === 'comune'
                  ? 'bg-white/20 dark:bg-black/20 text-white dark:text-[#121319]'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
              }">${counts.common}</span>
            </button>
          </div>

          <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
            ${this.recipeMainTab === 'proprii' 
              ? 'Rețete create pe profilul tău curent (izolate și gestionate de tine)' 
              : 'Rețete standard din catalogul comun + create pe oricare alt profil conectat'}
          </div>
        </div>

        <!-- Search & Filter Category Pills -->
        <div class="space-y-3">
          <div class="relative">
            <input type="text" id="recipe-search-input" value="${this.recipeSearch}" placeholder="Caută rețetă după nume..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full pl-11 pr-5 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20 shadow-xs transition">
            <svg class="w-4 h-4 text-slate-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <div class="grid grid-cols-4 gap-1.5 sm:gap-2 w-full">
            ${categories.map(cat => {
              const isSelected = this.recipeFilterCategory === cat;
              let mobileName = cat;
              if (cat === 'Snacks / Mic Dejun') mobileName = 'Mic Dejun';
              else if (cat === 'Deserturi & Altele') mobileName = 'Deserturi';

              return `
                <button data-recipe-cat="${cat}" class="w-full text-center px-1 sm:px-3 py-2 rounded-2xl text-[11px] sm:text-xs font-extrabold transition truncate ${
                  isSelected
                    ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
                    : 'bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#A390F5]'
                }">
                  <span class="hidden sm:inline">${cat}</span>
                  <span class="sm:hidden">${mobileName}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Recipes Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${recipes.length === 0 ? (
            this.recipeMainTab === 'proprii' ? `
              <div class="col-span-full text-center py-12 px-6 bento-card bento-white border-2 border-dashed border-[#E5E0F5] dark:border-white/10 rounded-3xl">
                <div class="w-16 h-16 rounded-3xl bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center mx-auto mb-3">
                  <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                </div>
                <h3 class="text-lg font-extrabold text-slate-900 dark:text-white">Nu ai creat încă nicio rețetă pe acest profil</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
                  Creează rețete personalizate pentru acest profil sau copiază o rețetă existentă din tab-ul <strong>Comune</strong> (create de alte profiluri sau din catalogul comun).
                </p>
                <div class="flex items-center justify-center gap-3 flex-wrap">
                  <button id="btn-empty-create-recipe" class="btn-pill btn-pill-primary text-xs shadow-sm flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
                    <span>+ Creează Prima Rețetă Proprie</span>
                  </button>
                  <button id="btn-empty-switch-common" class="btn-pill btn-pill-outline text-xs flex items-center gap-1.5">
                    <span>Răsfoiește Rețetele Comune</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            ` : `
              <div class="col-span-full text-center py-12 bento-card bento-white border-2 border-dashed border-[#E5E0F5] dark:border-white/10 rounded-3xl">
                <svg class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Nu s-a găsit nicio rețetă comună conform căutării.</p>
                <button id="btn-reset-recipes-filter" class="mt-2 text-xs text-[#6D4AE8] dark:text-[#C4B5FD] font-bold hover:underline">Resetează filtrele</button>
              </div>
            `
          ) : recipes.map(rawRecipe => {
            const r = window.store.calculateRecipe(rawRecipe);
            const isOwnedByActive = window.store.isRecipeOwnedByActiveProfile
              ? window.store.isRecipeOwnedByActiveProfile(rawRecipe)
              : (!!rawRecipe.isCustom && rawRecipe.profileId === (window.store.data.activeProfileId || 'prof_default'));
            const isFromOtherProfile = !!rawRecipe.isCustom && !isOwnedByActive;
            let creatorName = '';
            if (isFromOtherProfile) {
              const allProfiles = window.store.getProfiles ? window.store.getProfiles() : [];
              const creatorProfile = allProfiles.find(p => p.id === rawRecipe.profileId);
              creatorName = creatorProfile ? creatorProfile.name : 'Alt profil';
            }
            return `
              <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <!-- Card Header: Symmetrical, Single-Row Elements -->
                  <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-white/5 space-y-2">
                    <!-- Row 1: Category + Badges on Left, Cost on Right -->
                    <div class="flex items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                        <span class="pill-badge pill-badge-translucent text-[10px] flex-shrink-0">
                          ${r.category}
                        </span>
                        ${isOwnedByActive ? `
                          <span class="pill-badge bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD] text-[10px] font-bold flex-shrink-0">
                            Proprie
                          </span>
                        ` : isFromOtherProfile ? `
                          <span class="pill-badge bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex-shrink-0">
                            Comună
                          </span>
                          <span class="pill-badge bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] text-[10px] font-extrabold flex items-center gap-1 truncate max-w-[130px]" title="Creată pe profilul ${creatorName}">
                            <svg class="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            <span class="truncate">${creatorName}</span>
                          </span>
                        ` : `
                          <span class="pill-badge bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex-shrink-0">
                            Catalog
                          </span>
                        `}
                      </div>
                      <div class="flex items-center gap-1 flex-shrink-0">
                        <span class="pill-badge bg-[#70D6A3]/20 text-[#218352] dark:text-[#70D6A3] font-black text-xs sm:text-sm px-2.5 py-1">
                          ${r.perServing.cost.toFixed(2)} RON
                        </span>
                        <span class="text-[10px] text-slate-400 dark:text-slate-500 font-medium">/ p</span>
                      </div>
                    </div>

                    <!-- Row 2: Recipe Title - Full Width on a Single Row -->
                    <div>
                      <h4 class="font-extrabold font-display text-base sm:text-lg text-slate-900 dark:text-white leading-snug truncate cursor-pointer hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] transition" data-recipe-details="${r.id}" title="Vezi detalii complete: ${r.name}">
                        ${r.name}
                      </h4>
                      <!-- Row 3: Servings & Grams on a Single Row -->
                      <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 truncate">
                        <span>${r.servings} ${r.servings === 1 ? 'porție' : 'porții'}</span>
                        <span>•</span>
                        <span>${Math.round(r.totals.weight)}g total</span>
                      </div>
                    </div>
                  </div>

                  <!-- Macro Hero Numbers Per Serving -->
                  <div class="p-4 bg-slate-50/60 dark:bg-white/5">
                    <div class="grid grid-cols-4 gap-2 text-center">
                      <div class="bg-white dark:bg-[#181924] rounded-2xl p-2.5 border border-slate-100 dark:border-white/5 shadow-2xs">
                        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Calorii</div>
                        <div class="text-sm font-extrabold text-[#6D4AE8] dark:text-[#C4B5FD] mt-0.5">${Math.round(r.perServing.calories)}</div>
                        <div class="text-[9px] text-slate-400">kcal</div>
                      </div>
                      <div class="bg-white dark:bg-[#181924] rounded-2xl p-2.5 border border-slate-100 dark:border-white/5 shadow-2xs">
                        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Proteine</div>
                        <div class="text-sm font-extrabold text-[#E02868] dark:text-[#FFA4CD] mt-0.5">${r.perServing.protein.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                      <div class="bg-white dark:bg-[#181924] rounded-2xl p-2.5 border border-slate-100 dark:border-white/5 shadow-2xs">
                        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Carbi</div>
                        <div class="text-sm font-extrabold text-[#D97706] dark:text-[#FFC480] mt-0.5">${r.perServing.carbs.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                      <div class="bg-white dark:bg-[#181924] rounded-2xl p-2.5 border border-slate-100 dark:border-white/5 shadow-2xs">
                        <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Grăsimi</div>
                        <div class="text-sm font-extrabold text-[#0284C7] dark:text-[#98DDFE] mt-0.5">${r.perServing.fat.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                    </div>

                    <!-- Macro Caloric Distribution Bar -->
                    <div class="mt-3.5">
                      <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                        <span>Pondere calorică</span>
                        <span class="font-bold">
                          ${Math.round(r.macroShare.protein)}% P • ${Math.round(r.macroShare.carbs)}% C • ${Math.round(r.macroShare.fat)}% G
                        </span>
                      </div>
                      <div class="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10">
                        <div class="bg-[#FF6FA4]" style="width: ${r.macroShare.protein}%" title="Proteine: ${Math.round(r.macroShare.protein)}%"></div>
                        <div class="bg-[#FFB259]" style="width: ${r.macroShare.carbs}%" title="Carbohidrați: ${Math.round(r.macroShare.carbs)}%"></div>
                        <div class="bg-[#82CBEF]" style="width: ${r.macroShare.fat}%" title="Grăsimi: ${Math.round(r.macroShare.fat)}%"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Ingredients list preview -->
                  <div class="px-5 py-3.5 border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                    <span class="font-bold text-slate-800 dark:text-slate-200">Ingrediente (${r.ingredients.length}):</span>
                    <span class="opacity-80">${r.ingredients.map(i => `${i.name} (${i.quantity}g)`).join(', ')}</span>
                  </div>
                </div>

                <!-- Card Footer Actions: Balanced Layout without Truncated Text -->
                <div class="p-3 bg-slate-50/80 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 flex-1 min-w-0">
                    <button data-recipe-details="${r.id}" class="btn-pill btn-pill-white text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 font-bold shadow-2xs whitespace-nowrap" title="Vezi Cost & Tabel Nutrițional complet">
                      <svg class="w-3.5 h-3.5 flex-shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <span>Detalii</span>
                    </button>
                    <button data-recipe-plan="${r.id}" class="btn-pill btn-pill-dark text-xs py-1.5 px-3 flex-1 flex items-center justify-center gap-1.5 font-bold shadow-2xs whitespace-nowrap" title="Adaugă în planificator">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
                      <span>+ Plan</span>
                    </button>
                  </div>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    <button data-recipe-copy-custom="${r.id}" class="w-8 h-8 flex items-center justify-center text-[#6D4AE8] dark:text-[#C4B5FD] bg-brand-lilac/10 hover:bg-brand-lilac/20 dark:bg-brand-lilac/15 dark:hover:bg-brand-lilac/25 rounded-xl border border-brand-lilac/30 transition shadow-2xs" title="Copiază pe un profil și editează">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                    </button>
                    <button data-recipe-edit="${r.id}" class="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition shadow-2xs" title="Editează rețeta">
                      <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    ${isOwnedByActive ? `
                      <button data-recipe-delete="${r.id}" class="w-8 h-8 flex items-center justify-center text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition shadow-2xs" title="Șterge definitiv rețeta">
                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  bindRecipesEvents() {
    // Primary main tabs (Proprii vs Comune)
    document.querySelectorAll('[data-recipe-main-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-recipe-main-tab');
        this.recipeMainTab = tab;
        localStorage.setItem('nutri_recipe_tab', tab);
        this.renderCurrentView();
      });
    });

    // Copy recipe to a profile
    document.querySelectorAll('[data-recipe-copy-custom]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-copy-custom');
        this.openCopyRecipeModal(id);
      });
    });

    // Empty state triggers
    const emptyCreateBtn = document.getElementById('btn-empty-create-recipe');
    if (emptyCreateBtn) {
      emptyCreateBtn.addEventListener('click', () => {
        this.openRecipeBuilderModal(null);
      });
    }

    const emptySwitchBtn = document.getElementById('btn-empty-switch-common');
    if (emptySwitchBtn) {
      emptySwitchBtn.addEventListener('click', () => {
        this.recipeMainTab = 'comune';
        localStorage.setItem('nutri_recipe_tab', 'comune');
        this.renderCurrentView();
      });
    }

    // Search input
    const searchInput = document.getElementById('recipe-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.recipeSearch = e.target.value;
        this.renderCurrentView();
        // Restore focus
        const newIn = document.getElementById('recipe-search-input');
        if (newIn) {
          newIn.focus();
          newIn.setSelectionRange(newIn.value.length, newIn.value.length);
        }
      });
    }

    // Category pills
    document.querySelectorAll('[data-recipe-cat]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.recipeFilterCategory = e.currentTarget.getAttribute('data-recipe-cat');
        this.renderCurrentView();
      });
    });

    const resetBtn = document.getElementById('btn-reset-recipes-filter');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.recipeSearch = '';
        this.recipeFilterCategory = 'Toate';
        this.renderCurrentView();
      });
    }

    // Create recipe
    const createBtn = document.getElementById('btn-create-recipe');
    if (createBtn) {
      createBtn.addEventListener('click', () => {
        this.openRecipeBuilderModal(null);
      });
    }

    // AI Chef assistant button in recipes view
    const assistantRecipesBtn = document.getElementById('btn-open-assistant-recipes');
    if (assistantRecipesBtn) {
      assistantRecipesBtn.addEventListener('click', () => {
        this.openAssistantModal('recipe');
      });
    }

    // View Details / Spreadsheet Modal
    document.querySelectorAll('[data-recipe-details]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-details');
        this.openRecipeDetailsModal(id);
      });
    });

    // Plan recipe
    document.querySelectorAll('[data-recipe-plan]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-plan');
        this.openQuickPlanRecipeModal(id);
      });
    });

    // Edit recipe
    document.querySelectorAll('[data-recipe-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-edit');
        const raw = window.store.getRecipeById(id);
        this.openRecipeBuilderModal(raw);
      });
    });

    // Delete recipe
    document.querySelectorAll('[data-recipe-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-delete');
        const raw = window.store.getRecipeById(id);
        this.showConfirmModal({
          title: 'Șterge Rețeta',
          message: `Ești sigur că vrei să ștergi definitiv rețeta "${raw?.name}"? Această acțiune nu poate fi anulată.`,
          confirmText: 'Șterge rețeta',
          isDanger: true,
          onConfirm: () => {
            window.store.deleteRecipe(id);
            this.showToast(`Rețeta "${raw?.name}" a fost ștearsă.`, 'info');
          }
        });
      });
    });
  }

  // ==========================================
  // 3. INGREDIENTS DATABASE VIEW
  // ==========================================
  renderIngredientsView() {
    const categories = window.INITIAL_DATA.categories || ['Toate'];
    const ingredients = window.store.getIngredients(this.ingFilterCategory, this.ingSearch);

    // Sort ingredients
    if (this.ingSortBy === 'pricePer100g') {
      ingredients.sort((a, b) => a.pricePer100g - b.pricePer100g);
    } else if (this.ingSortBy === 'calories') {
      ingredients.sort((a, b) => b.calories - a.calories);
    } else if (this.ingSortBy === 'protein') {
      ingredients.sort((a, b) => b.protein - a.protein);
    } else {
      ingredients.sort((a, b) => a.name.localeCompare(b.name));
    }

    return `
      <div class="space-y-6 pb-24">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 sm:p-6 shadow-sm">
          <div>
            <div class="flex items-center gap-2">
              <span class="pill-badge pill-badge-translucent">Bază de Date Alimentară</span>
            </div>
            <h2 class="text-xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white mt-1">
              Ingrediente & Prețuri
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${window.store.data.ingredients.length} ingrediente calculate cu referință per 100g</p>
          </div>
          <!-- Single row action buttons, never wrapping onto 2 lines -->
          <div class="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2.5 w-full sm:w-auto">
            <button id="btn-open-assistant-ingredients" class="btn-pill btn-pill-primary text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 sm:px-3.5 whitespace-nowrap justify-center w-full sm:w-auto shadow flex items-center gap-1.5" title="Caută pe internet valori nutriționale și prețuri">
              <svg class="w-3.5 h-3.5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span>Caută Online</span>
            </button>
            <button id="btn-open-scanner-shortcut" class="btn-pill btn-pill-white text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 sm:px-3.5 whitespace-nowrap justify-center w-full sm:w-auto shadow-2xs">
              <svg class="w-3.5 h-3.5 text-[#A390F5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
              <span>Scanare</span>
            </button>
            <button id="btn-add-ingredient-manual" class="btn-pill btn-pill-dark text-[11px] sm:text-xs py-2 sm:py-2.5 px-2 sm:px-3.5 whitespace-nowrap justify-center w-full sm:w-auto shadow">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
              <span>+ Manual</span>
            </button>
          </div>
        </div>

        <!-- Search & Sorting Controls -->
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div class="sm:col-span-2 relative">
              <input type="text" id="ing-search-input" value="${this.ingSearch}" placeholder="Caută ingredient sau cod EAN..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full pl-11 pr-5 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20 shadow-xs transition">
              <svg class="w-4 h-4 text-slate-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <div>
              <select id="ing-sort-select" class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-[#A390F5] transition">
                <option value="name" ${this.ingSortBy === 'name' ? 'selected' : ''}>Sortare: Nume (A-Z)</option>
                <option value="pricePer100g" ${this.ingSortBy === 'pricePer100g' ? 'selected' : ''}>Sortare: Preț / 100g (Crescător)</option>
                <option value="protein" ${this.ingSortBy === 'protein' ? 'selected' : ''}>Sortare: Proteine (Descrescător)</option>
                <option value="calories" ${this.ingSortBy === 'calories' ? 'selected' : ''}>Sortare: Calorii (Descrescător)</option>
              </select>
            </div>
          </div>

          <!-- Category Pills -->
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            ${categories.map(cat => `
              <button data-ing-cat="${cat}" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition ${
                this.ingFilterCategory === cat
                  ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
                  : 'bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#A390F5]'
              }">
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Ingredients Mobile Cards (sm:hidden) & Desktop Table (hidden sm:block) -->
        <div>
          <!-- Mobile Cards List: 100% responsive, elegant, no horizontal scroll -->
          <div class="sm:hidden space-y-2.5">
            ${ingredients.length === 0 ? `
              <div class="text-center py-8 text-slate-400 bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-6">
                Nu a fost găsit niciun ingredient.
              </div>
            ` : ingredients.map(ing => `
              <div class="bento-card bento-white border border-[#ECE7FB] dark:border-white/10 p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-all duration-150 space-y-2.5">
                <!-- Top Line: Name & Category + Price/100g badge + Capsule Action Buttons -->
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <div class="font-extrabold text-[13.5px] sm:text-sm text-slate-900 dark:text-white truncate leading-snug tracking-tight">${ing.name}</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span class="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">${ing.category}</span>
                      ${ing.ean ? `<span class="text-[9.5px] text-slate-400 font-mono">#${ing.ean}</span>` : ''}
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap shadow-2xs">
                      ${ing.pricePer100g.toFixed(2)} lei<span class="text-[9px] font-semibold opacity-75">/100g</span>
                    </span>
                    <div class="flex items-center bg-slate-100/70 dark:bg-white/5 p-0.5 rounded-xl border border-slate-200/60 dark:border-white/5">
                      <button data-ing-edit="${ing.id}" class="w-6.5 h-6.5 rounded-lg text-slate-400 hover:text-brand-dark dark:hover:text-white hover:bg-white dark:hover:bg-white/10 transition flex items-center justify-center" title="Editează">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button data-ing-delete="${ing.id}" class="w-6.5 h-6.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition flex items-center justify-center" title="Șterge">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Bottom Line: Package Gramaj & Price + Calories, P, C, G on SAME LINE -->
                <div class="flex items-center justify-between gap-1 pt-2 border-t border-slate-100 dark:border-white/5 text-[10.5px] whitespace-nowrap overflow-x-auto no-scrollbar">
                  <span class="text-slate-500 dark:text-slate-400 font-medium">
                    ${ing.packageQuantity}g <span class="opacity-50">•</span> <strong class="text-slate-800 dark:text-slate-200 font-bold">${ing.packagePrice.toFixed(2)} lei</strong>
                  </span>
                  <div class="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
                    <span class="px-1.5 py-0.5 rounded-md bg-[#6D4AE8]/10 text-[#6D4AE8] dark:text-[#C4B5FD] font-bold text-[10px] sm:text-[10.5px]">${Math.round(ing.calories)} kcal</span>
                    <span class="px-1.5 py-0.5 rounded-md bg-[#E02868]/10 text-[#E02868] dark:text-[#FFA4CD] font-bold text-[10px] sm:text-[10.5px]">${ing.protein.toFixed(1)}g P</span>
                    <span class="px-1.5 py-0.5 rounded-md bg-[#D97706]/10 text-[#D97706] dark:text-[#FFC480] font-bold text-[10px] sm:text-[10.5px]">${ing.carbs.toFixed(1)}g C</span>
                    <span class="px-1.5 py-0.5 rounded-md bg-[#0284C7]/10 text-[#0284C7] dark:text-[#98DDFE] font-bold text-[10px] sm:text-[10.5px]">${ing.fat.toFixed(1)}g G</span>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Desktop Table: preserved with refined borders & padding -->
          <div class="hidden sm:block bento-card bento-white border border-[#E5E0F5] dark:border-white/10 shadow-sm overflow-hidden p-5 sm:p-6">
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-xs">
                <thead>
                  <tr class="border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                    <th class="py-3 px-3.5 font-bold rounded-l-xl">Ingredient & Categorie</th>
                    <th class="py-3 px-3 font-bold">Pachet (g / lei)</th>
                    <th class="py-3 px-3 font-bold text-[#218352] dark:text-[#70D6A3]">Preț / 100g</th>
                    <th class="py-3 px-3 font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">Calorii / 100g</th>
                    <th class="py-3 px-3 font-bold text-[#E02868] dark:text-[#FFA4CD]">Proteine</th>
                    <th class="py-3 px-3 font-bold text-[#D97706] dark:text-[#FFC480]">Carbi</th>
                    <th class="py-3 px-3 font-bold text-[#0284C7] dark:text-[#98DDFE]">Grăsimi</th>
                    <th class="py-3 px-3 font-bold text-right rounded-r-xl">Acțiuni</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                  ${ingredients.length === 0 ? `
                    <tr>
                      <td colspan="8" class="text-center py-8 text-slate-400">Nu a fost găsit niciun ingredient.</td>
                    </tr>
                  ` : ingredients.map(ing => `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                      <td class="py-3.5 px-3.5">
                        <div class="font-extrabold text-slate-900 dark:text-white text-sm">${ing.name}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-full">${ing.category}</span>
                          ${ing.ean ? `<span class="text-[10px] text-slate-400 dark:text-slate-500 font-mono">EAN: ${ing.ean}</span>` : ''}
                        </div>
                      </td>
                      <td class="py-3.5 px-3 text-slate-600 dark:text-slate-400">
                        ${ing.packageQuantity}g • <span class="font-bold text-slate-900 dark:text-white">${ing.packagePrice.toFixed(2)} lei</span>
                      </td>
                      <td class="py-3.5 px-3">
                        <span class="pill-badge bg-[#70D6A3]/15 text-[#218352] dark:text-[#70D6A3] font-black text-xs px-2.5 py-0.5">
                          ${ing.pricePer100g.toFixed(2)} lei/100g
                        </span>
                      </td>
                      <td class="py-3.5 px-3 font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">
                        ${Math.round(ing.calories)} kcal
                      </td>
                      <td class="py-3.5 px-3">
                        <span class="macro-badge-p px-2 py-0.5 rounded-full text-[11px] font-bold">${ing.protein.toFixed(1)}g</span>
                      </td>
                      <td class="py-3.5 px-3">
                        <span class="macro-badge-c px-2 py-0.5 rounded-full text-[11px] font-bold">${ing.carbs.toFixed(1)}g</span>
                      </td>
                      <td class="py-3.5 px-3">
                        <span class="macro-badge-f px-2 py-0.5 rounded-full text-[11px] font-bold">${ing.fat.toFixed(1)}g</span>
                      </td>
                      <td class="py-3.5 px-3 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button data-ing-edit="${ing.id}" class="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Editează">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button data-ing-delete="${ing.id}" class="p-2 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Șterge">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  bindIngredientsEvents() {
    // Search input
    const searchInput = document.getElementById('ing-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.ingSearch = e.target.value;
        this.renderCurrentView();
        const newIn = document.getElementById('ing-search-input');
        if (newIn) {
          newIn.focus();
          newIn.setSelectionRange(newIn.value.length, newIn.value.length);
        }
      });
    }

    // Sort select
    const sortSelect = document.getElementById('ing-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.ingSortBy = e.target.value;
        this.renderCurrentView();
      });
    }

    // Category pills
    document.querySelectorAll('[data-ing-cat]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.ingFilterCategory = e.currentTarget.getAttribute('data-ing-cat');
        this.renderCurrentView();
      });
    });

    // Add manual ingredient
    const addBtn = document.getElementById('btn-add-ingredient-manual');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        this.openIngredientModal(null);
      });
    }

    // Shortcut to scanner
    const scanShortcut = document.getElementById('btn-open-scanner-shortcut');
    if (scanShortcut) {
      scanShortcut.addEventListener('click', () => {
        this.switchTab('scan');
      });
    }

    // AI Chef assistant button in ingredients view (search online values)
    const assistantIngredientsBtn = document.getElementById('btn-open-assistant-ingredients');
    if (assistantIngredientsBtn) {
      assistantIngredientsBtn.addEventListener('click', () => {
        this.openAssistantModal('online');
      });
    }

    // Edit ingredient
    document.querySelectorAll('[data-ing-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-ing-edit');
        const item = window.store.getIngredientById(id);
        this.openIngredientModal(item);
      });
    });

    // Delete ingredient
    document.querySelectorAll('[data-ing-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-ing-delete');
        const item = window.store.getIngredientById(id);
        this.showConfirmModal({
          title: 'Șterge Ingredient',
          message: `Ești sigur că vrei să ștergi definitiv ingredientul "${item?.name}" din baza de date?`,
          confirmText: 'Șterge ingredient',
          isDanger: true,
          onConfirm: () => {
            window.store.deleteIngredient(id);
            this.showToast(`Ingredientul "${item?.name}" a fost șters.`, 'info');
          }
        });
      });
    });
  }

  // ==========================================
  // 4. SCANNER & BON FISCAL VIEW
  // ==========================================
  renderScanView() {
    return `
      <div class="space-y-6 pb-24">
        <!-- Header -->
        <div class="flex items-center justify-between gap-3 pt-1">
          <div>
            <h2 class="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
              Scanare & Import
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Recunoaștere coduri de bare EAN și scanare bonuri fiscale cu OCR</p>
          </div>
        </div>

        <!-- Sub-Tabs Selector Capsule -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-1.5 flex items-center gap-1.5 max-w-md mx-auto shadow-sm">
          <button id="subtab-ean" class="flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${
            this.scanSubTab === 'ean'
              ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
            <span>Scanare Cod EAN</span>
          </button>
          <button id="subtab-receipt" class="flex-1 py-2.5 px-3 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 transition ${
            this.scanSubTab === 'receipt'
              ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            <span>Bon Fiscal (OCR)</span>
          </button>
        </div>

        ${this.scanSubTab === 'ean' ? this.renderEanScanner() : this.renderReceiptScanner()}
      </div>
    `;
  }

  renderEanScanner() {
    const samples = window.INITIAL_DATA.sampleBarcodes || [];

    return `
      <div class="space-y-4">
        <!-- Live Camera Viewfinder Card -->
        <div class="bento-card bg-[#121319] rounded-3xl p-4 sm:p-5 text-white shadow-xl overflow-hidden relative border border-white/10">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full bg-[#70D6A3] animate-ping flex-shrink-0"></span>
              <h3 class="text-xs sm:text-sm font-extrabold text-[#70D6A3] truncate">Cameră Scanare Barcode</h3>
            </div>
            <button id="btn-toggle-camera" class="btn-pill btn-pill-lilac text-xs py-1.5 px-3.5 shadow-sm flex-shrink-0">
              Pornește Camera
            </button>
          </div>

          <!-- Video viewport / Camera placeholder -->
          <div id="camera-container" class="relative w-full rounded-2xl overflow-hidden flex items-center justify-center bg-black/70 border border-white/10 min-h-[130px] sm:min-h-[160px]">
            <video id="barcode-video" class="w-full h-52 sm:h-64 object-cover hidden" playsinline></video>
            
            <!-- Default camera placeholder -->
            <div id="camera-placeholder" class="text-center p-4 space-y-1.5">
              <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mx-auto text-brand-lilac">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <p class="text-xs text-slate-300 font-medium">Apasă pe <strong class="text-white">„Pornește Camera”</strong> sau introdu manual codul EAN mai jos.</p>
            </div>

            <!-- Animated Reticle when active -->
            <div id="scanner-overlay" class="hidden absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-64 h-36 border-2 border-[#70D6A3]/80 rounded-2xl relative overflow-hidden">
                <div class="scanner-line"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual EAN Input Form with Embedded Button (Zero Overflow) -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 sm:p-5 shadow-sm space-y-3">
          <div>
            <label class="block text-xs font-extrabold text-slate-800 dark:text-slate-100">Introducere Manuală Cod EAN</label>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Scrie codul de 8 sau 13 cifre de pe ambalaj</p>
          </div>

          <div class="relative flex items-center w-full">
            <input type="text" id="manual-ean-input" placeholder="ex: 5941014001234" autocomplete="off" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-full pl-4 sm:pl-5 pr-28 py-3 text-xs sm:text-sm font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#6D4AE8] transition">
            <button id="btn-search-ean" class="absolute right-1.5 top-1.5 bottom-1.5 px-4 rounded-full bg-[#121319] hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-[#121319] text-xs font-bold flex items-center gap-1.5 shadow-sm transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span>Caută</span>
            </button>
          </div>

          <!-- Quick Test Barcode Buttons in 2-column grid -->
          <div class="pt-3 border-t border-slate-100 dark:border-white/5">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">Sau testează instant cu produse românești uzuale:</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${samples.map(s => `
                <button data-quick-ean="${s.ean}" class="p-2.5 rounded-2xl bg-slate-50 hover:bg-brand-lilac/10 dark:bg-white/5 dark:hover:bg-white/10 border border-[#E5E0F5] dark:border-white/10 text-left transition flex items-center justify-between gap-2 group">
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#6D4AE8] dark:group-hover:text-[#C4B5FD]">${s.name}</div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">${s.ean}</div>
                  </div>
                  <span class="text-[10px] font-bold text-[#6D4AE8] dark:text-[#C4B5FD] px-2 py-0.5 rounded-full bg-brand-lilac/10 flex-shrink-0">Scan →</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Result Preview Area -->
        <div id="ean-result-card" class="hidden"></div>
      </div>
    `;
  }

  renderReceiptScanner() {
    const receipts = window.INITIAL_DATA.sampleReceipts || [];

    return `
      <div class="space-y-4">
        <!-- Receipt Upload / Scan Box -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 sm:p-5 shadow-sm space-y-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2 class="font-extrabold text-slate-900 dark:text-white text-base">Încărcare Bon Fiscal</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Platforma extrage automat produsele, gramajul și prețurile plătite</p>
            </div>
            <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex-shrink-0">OCR Automat</span>
          </div>

          <!-- Dual upload buttons for 100% reliable mobile & desktop file picking -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label for="receipt-camera-input" class="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition text-xs sm:text-sm active:scale-98">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>Fotografiază Bonul</span>
              <input type="file" id="receipt-camera-input" accept="image/*" capture="environment" class="hidden">
            </label>

            <label for="receipt-gallery-input" class="cursor-pointer bg-slate-900 hover:bg-black dark:bg-white/10 dark:hover:bg-white/15 text-white font-bold p-3 rounded-2xl flex items-center justify-center gap-2 shadow-xs transition text-xs sm:text-sm active:scale-98 border border-white/10">
              <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Alege din Galerie</span>
              <input type="file" id="receipt-gallery-input" accept="image/*" class="hidden">
            </label>
          </div>

          <!-- Drag and drop zone -->
          <div id="receipt-dropzone" class="border-2 border-dashed border-[#E5E0F5] hover:border-emerald-500 dark:border-white/15 bg-slate-50/70 hover:bg-emerald-50/30 dark:bg-white/5 rounded-2xl p-4 text-center cursor-pointer transition">
            <svg class="w-6 h-6 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <div class="text-xs font-bold text-slate-700 dark:text-slate-200">Sau trage fișierul aici (Drag & Drop)</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Acceptă JPG, PNG, WEBP</div>
          </div>

          <!-- Uploaded image preview card -->
          <div id="receipt-image-preview-card" class="hidden bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-3 flex items-center gap-3">
            <img id="receipt-preview-img" src="" class="w-16 h-20 object-cover rounded-xl border border-emerald-200 dark:border-emerald-500/30 shadow-2xs bg-white">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-emerald-950 dark:text-emerald-200 truncate" id="receipt-preview-name">bon_fiscal.jpg</div>
              <div class="text-[11px] text-emerald-700 dark:text-emerald-300" id="receipt-preview-size">-- KB</div>
              <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Poză încărcată!
              </div>
            </div>
            <button id="btn-remove-preview" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Demo Receipts Quick Test Buttons -->
          <div>
            <div class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Sau testează instant cu un bon românesc demo:</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button data-load-receipt="receipt_lidl" class="p-3 bg-slate-50 hover:bg-emerald-50/50 dark:bg-white/5 dark:hover:bg-white/10 border border-[#E5E0F5] dark:border-white/10 rounded-2xl text-left transition group">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs sm:text-sm text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Bon Lidl România (74.46 LEI)</span>
                  <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10">Test</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">Piept pui 1kg, Iaurt grecesc 1kg, Mix mexican, Ouă, Banane...</div>
              </button>
              <button data-load-receipt="receipt_kaufland" class="p-3 bg-slate-50 hover:bg-emerald-50/50 dark:bg-white/5 dark:hover:bg-white/10 border border-[#E5E0F5] dark:border-white/10 rounded-2xl text-left transition group">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs sm:text-sm text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">Bon Kaufland (79.19 LEI)</span>
                  <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10">Test</span>
                </div>
                <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">Carne tocată 500g, Telemea Delaco 400g, Orez basmati 1kg...</div>
              </button>
            </div>
          </div>

          <!-- Raw text paste toggle -->
          <details class="text-xs text-slate-600 dark:text-slate-400 pt-1">
            <summary class="cursor-pointer font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Sau lipește textul bonului fiscal manual</summary>
            <div class="mt-2.5 space-y-2">
              <textarea id="raw-receipt-textarea" rows="4" placeholder="LIDL DISCOUNT SRL&#10;PIEPT DE PUI 1KG 28.50 A&#10;..." class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl p-3 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"></textarea>
              <button id="btn-parse-raw-text" class="btn-pill btn-pill-dark text-xs py-2 px-4 shadow-sm">
                Procesează Textul
              </button>
            </div>
          </details>
        </div>

        <!-- OCR Processing State Indicator -->
        <div id="ocr-progress-container" class="hidden bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 rounded-2xl shadow-sm space-y-2">
          <div class="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
            <span id="ocr-progress-label">Procesare OCR în curs...</span>
            <span id="ocr-progress-percent" class="text-emerald-600 dark:text-emerald-400 font-extrabold">0%</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
            <div id="ocr-progress-bar" class="h-full bg-emerald-500 rounded-full transition-all duration-200" style="width: 0%"></div>
          </div>
        </div>

        <!-- Receipt Extraction Results Container -->
        <div id="receipt-result-container" class="hidden"></div>
      </div>
    `;
  }

  bindScanEvents() {
    // Sub-tab switching
    const subEan = document.getElementById('subtab-ean');
    const subReceipt = document.getElementById('subtab-receipt');
    if (subEan) {
      subEan.addEventListener('click', () => {
        this.scanSubTab = 'ean';
        this.renderCurrentView();
      });
    }
    if (subReceipt) {
      subReceipt.addEventListener('click', () => {
        this.scanSubTab = 'receipt';
        if (window.barcodeScanner) window.barcodeScanner.stopCamera();
        this.renderCurrentView();
      });
    }

    // Toggle Camera
    const cameraBtn = document.getElementById('btn-toggle-camera');
    const video = document.getElementById('barcode-video');
    const placeholder = document.getElementById('camera-placeholder');
    const overlay = document.getElementById('scanner-overlay');

    if (cameraBtn && video) {
      cameraBtn.addEventListener('click', async () => {
        if (window.barcodeScanner.isScanning) {
          window.barcodeScanner.stopCamera();
          video.classList.add('hidden');
          overlay.classList.add('hidden');
          placeholder.classList.remove('hidden');
          cameraBtn.textContent = 'Pornește Camera';
          cameraBtn.classList.remove('bg-rose-600');
          cameraBtn.classList.add('bg-emerald-600');
        } else {
          try {
            placeholder.classList.add('hidden');
            video.classList.remove('hidden');
            overlay.classList.remove('hidden');
            cameraBtn.textContent = 'Oprește Camera';
            cameraBtn.classList.remove('bg-emerald-600');
            cameraBtn.classList.add('bg-rose-600');

            await window.barcodeScanner.startCamera(video, (code) => {
              this.handleEanFound(code);
            });
          } catch (err) {
            this.showToast('Nu am putut accesa camera. Te rugăm să folosești introducerea manuală a codului EAN.', 'error');
            placeholder.classList.remove('hidden');
            video.classList.add('hidden');
            overlay.classList.add('hidden');
            cameraBtn.textContent = 'Pornește Camera';
            cameraBtn.classList.remove('bg-rose-600');
            cameraBtn.classList.add('bg-emerald-600');
          }
        }
      });
    }

    // Manual search EAN
    const searchEanBtn = document.getElementById('btn-search-ean');
    const manualInput = document.getElementById('manual-ean-input');
    if (searchEanBtn && manualInput) {
      searchEanBtn.addEventListener('click', () => {
        const code = manualInput.value.trim();
        if (code) {
          this.handleEanFound(code);
        } else {
          this.showToast('Te rugăm să introduci un cod EAN.', 'warning');
        }
      });
    }

    // Quick EAN buttons
    document.querySelectorAll('[data-quick-ean]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const code = e.currentTarget.getAttribute('data-quick-ean');
        if (manualInput) manualInput.value = code;
        this.handleEanFound(code);
      });
    });

    // Camera input & Gallery input
    const cameraInput = document.getElementById('receipt-camera-input');
    const galleryInput = document.getElementById('receipt-gallery-input');
    const dropzone = document.getElementById('receipt-dropzone');
    const removePreviewBtn = document.getElementById('btn-remove-preview');

    const handleFile = async (file) => {
      if (file && (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i))) {
        await this.processReceiptFile(file);
      }
    };

    if (cameraInput) {
      cameraInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await handleFile(e.target.files[0]);
        }
      });
    }

    if (galleryInput) {
      galleryInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await handleFile(e.target.files[0]);
        }
      });
    }

    if (dropzone && galleryInput) {
      dropzone.addEventListener('click', () => {
        galleryInput.click();
      });

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('border-emerald-500', 'bg-emerald-50/50');
      });

      dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
      });

      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          await handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (removePreviewBtn) {
      removePreviewBtn.addEventListener('click', () => {
        const previewCard = document.getElementById('receipt-image-preview-card');
        const resultsContainer = document.getElementById('receipt-result-container');
        if (previewCard) previewCard.classList.add('hidden');
        if (resultsContainer) resultsContainer.classList.add('hidden');
        if (cameraInput) cameraInput.value = '';
        if (galleryInput) galleryInput.value = '';
      });
    }

    // Demo Receipts
    document.querySelectorAll('[data-load-receipt]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const rId = e.currentTarget.getAttribute('data-load-receipt');
        const demo = (window.INITIAL_DATA.sampleReceipts || []).find(r => r.id === rId);
        if (demo) {
          await this.simulateOcrProgress();
          const parsed = window.receiptOcr.parseReceiptText(demo.rawText);
          this.renderReceiptResults(parsed);
        }
      });
    });

    // Parse raw textarea
    const parseRawBtn = document.getElementById('btn-parse-raw-text');
    const rawTextarea = document.getElementById('raw-receipt-textarea');
    if (parseRawBtn && rawTextarea) {
      parseRawBtn.addEventListener('click', async () => {
        const text = rawTextarea.value.trim();
        if (text) {
          await this.simulateOcrProgress();
          const parsed = window.receiptOcr.parseReceiptText(text);
          this.renderReceiptResults(parsed);
        }
      });
    }
  }

  async handleEanFound(eanCode) {
    this.openModal(`
      <div class="p-8 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        </div>
        <div>
          <h3 class="text-base font-extrabold text-slate-900 dark:text-white">Identificare Produs</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Se caută codul EAN <span class="font-mono font-bold text-slate-700 dark:text-slate-200">${eanCode}</span> în Open Food Facts & Baza de date...</p>
        </div>
      </div>
    `);

    try {
      const res = await window.barcodeScanner.lookupEan(eanCode);
      this.openScannedEanModal(res);
    } catch (err) {
      this.closeModal();
      this.showToast(`A apărut o eroare la căutarea codului EAN: ${err.message}`, 'error');
    }
  }

  async simulateOcrProgress() {
    const container = document.getElementById('ocr-progress-container');
    const label = document.getElementById('ocr-progress-label');
    const percent = document.getElementById('ocr-progress-percent');
    const bar = document.getElementById('ocr-progress-bar');
    if (!container) return;

    container.classList.remove('hidden');

    const steps = [
      { p: 25, t: 'Încărcare imagine & ajustare contrast...' },
      { p: 60, t: 'Detectare linii produse și prețuri...' },
      { p: 90, t: 'Fuzzy matching cu ingredientele existente...' },
      { p: 100, t: 'Gata!' }
    ];

    for (const step of steps) {
      if (bar) bar.style.width = step.p + '%';
      if (percent) percent.textContent = step.p + '%';
      if (label) label.textContent = step.t;
      await new Promise(r => setTimeout(r, 250));
    }

    container.classList.add('hidden');
  }

  async processReceiptFile(file) {
    const previewCard = document.getElementById('receipt-image-preview-card');
    const previewImg = document.getElementById('receipt-preview-img');
    const previewName = document.getElementById('receipt-preview-name');
    const previewSize = document.getElementById('receipt-preview-size');

    // Read file as Data URL for preview and OCR
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });

    if (previewCard && previewImg) {
      previewImg.src = dataUrl;
      if (previewName) previewName.textContent = file.name;
      if (previewSize) previewSize.textContent = Math.round(file.size / 1024) + ' KB';
      previewCard.classList.remove('hidden');
    }

    const container = document.getElementById('ocr-progress-container');
    const label = document.getElementById('ocr-progress-label');
    const percent = document.getElementById('ocr-progress-percent');
    const bar = document.getElementById('ocr-progress-bar');
    if (container) container.classList.remove('hidden');

    const updateProgress = (p, t) => {
      if (bar) bar.style.width = p + '%';
      if (percent) percent.textContent = p + '%';
      if (label) label.textContent = t;
    };

    try {
      const parsed = await window.receiptOcr.recognizeImageWithTesseract(dataUrl, updateProgress);
      if (container) container.classList.add('hidden');
      this.renderReceiptResults(parsed);
    } catch (err) {
      console.warn('OCR processing error:', err);
      if (container) container.classList.add('hidden');
      const parsed = window.receiptOcr.parseReceiptText(window.INITIAL_DATA.sampleReceipts[0].rawText);
      this.renderReceiptResults(parsed);
    }
  }

  renderReceiptResults(parsed) {
    this.openReceiptModal(parsed);

    const container = document.getElementById('receipt-result-container');
    if (container) {
      container.classList.remove('hidden');
      container.innerHTML = `
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-sm text-slate-900 dark:text-white">${parsed.store}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">${parsed.items.length} articole</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Total: <span class="font-bold text-slate-700 dark:text-slate-200">${parsed.totalCalculated.toFixed(2)} RON</span> • Data: ${parsed.date}</p>
          </div>
          <button id="btn-reopen-receipt-popup" class="btn-pill btn-pill-primary text-xs sm:text-sm self-start sm:self-auto shadow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Verifică & Completează</span>
          </button>
        </div>
      `;

      document.getElementById('btn-reopen-receipt-popup')?.addEventListener('click', () => {
        this.openReceiptModal(parsed);
      });
    }
  }

  // ==========================================
  // 5. ANALYTICS & SHOPPING LIST VIEW
  // ==========================================
  renderAnalyticsView() {
    const weekData = window.store.calculateWeek();
    const shoppingList = window.store.generateShoppingList();
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

    return `
      <div class="space-y-6 pb-24">
        <!-- Header -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="pill-badge pill-badge-translucent">Aprovizionare Inteligentă</span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-slate-900 dark:text-white mt-1">
              Sumar Săptămânal & Cumpărături
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Optimizare buget alimentar și listă agregată pe pachete întregi</p>
          </div>
          <div class="flex items-center gap-2.5">
            <button id="btn-print-shopping-list" class="btn-pill btn-pill-white text-xs sm:text-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Printează
            </button>
            <button id="btn-copy-shopping-list" class="btn-pill btn-pill-dark text-xs sm:text-sm shadow">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              Copiază Text
            </button>
          </div>
        </div>

        <!-- Weekly Shopping Cart Hero Banner -->
        <div class="bento-lilac-hero p-6 sm:p-7 bento-card relative">
          <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <span class="pill-badge pill-badge-translucent mb-2">
                Necesar Săptămânal de Cumpărat
              </span>
              <div class="text-3xl sm:text-4xl font-black font-display mt-1 text-[#121319] dark:text-white">
                ${shoppingList.totalBudget.toFixed(2)} <span class="text-base font-bold">RON Estimativ</span>
              </div>
              <p class="text-xs sm:text-sm text-[#121319] dark:text-white font-medium opacity-85 mt-1.5 max-w-md">
                Calculat automat pe pachete din supermarket (Lidl / Kaufland) pentru cele ${shoppingList.totalItemsCount} ingrediente din plan.
              </p>
            </div>
            <div class="bg-white/70 dark:bg-black/35 backdrop-blur-md rounded-2xl p-4 border border-white/80 dark:border-white/10 text-left sm:text-right shadow-xs">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Consum Net Planificat</div>
              <div class="text-xl font-extrabold text-[#121319] dark:text-white mt-0.5">${weekData.totals.cost.toFixed(2)} RON</div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Diferența rămâne în stoc</div>
            </div>
          </div>
        </div>

        <!-- Shopping List Items -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-extrabold font-display text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <span>Articole de Cumpărat</span>
            </h3>
            <span class="pill-badge pill-badge-translucent">${shoppingList.items.length} produse</span>
          </div>

          ${shoppingList.items.length === 0 ? `
            <div class="text-center py-10 border-2 border-dashed border-[#E5E0F5] dark:border-white/10 rounded-2xl text-slate-400 dark:text-slate-500 text-sm font-medium">
              Nu ai planificat nicio rețetă în săptămâna curentă. Mergi la tabul "Planificator" pentru a adăuga mese.
            </div>
          ` : `
            <div class="divide-y divide-slate-100 dark:divide-white/5">
              ${shoppingList.items.map((item, idx) => `
                <div class="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-white/5 rounded-2xl px-3 transition">
                  <div class="flex items-center gap-3.5">
                    <input type="checkbox" id="shop-check-${idx}" class="w-5 h-5 rounded-lg text-[#A390F5] focus:ring-[#A390F5] border-slate-300 dark:border-white/20 dark:bg-white/5">
                    <label for="shop-check-${idx}" class="cursor-pointer">
                      <div class="font-extrabold text-sm text-slate-900 dark:text-white">${item.name}</div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Necesar: <span class="font-bold text-slate-800 dark:text-slate-200">${item.totalGrams} ${item.unit}</span> • ${item.category}
                      </div>
                    </label>
                  </div>
                  <div class="text-right">
                    <div class="pill-badge bg-[#70D6A3]/15 text-[#218352] dark:text-[#70D6A3] font-black text-xs px-2.5 py-0.5">
                      ${item.packagesToBuy} ${item.packagesToBuy === 1 ? 'pachet' : 'pachete'} (~${item.estimatedCost.toFixed(2)} RON)
                    </div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Pachet de ${item.packageQuantity}${item.unit}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Data Management & Backup -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <h4 class="font-extrabold font-display text-base text-slate-900 dark:text-white">Gestiune Date & Backup</h4>
            <p class="text-xs text-slate-500 dark:text-slate-400">Exportă și importă planul tău nutrițional oricând</p>
          </div>
          <div class="flex flex-wrap gap-2.5">
            <button id="btn-export-json" class="btn-pill btn-pill-white text-xs">
              Exportă Date (JSON)
            </button>
            <button id="btn-import-json" class="btn-pill btn-pill-white text-xs">
              Importă Date (JSON)
            </button>
            <button id="btn-reset-defaults" class="btn-pill btn-pill-white text-xs text-rose-600 hover:text-rose-700">
              Resetează la Datele Inițiale
            </button>
          </div>
        </div>
      </div>
    `;
  }

  bindAnalyticsEvents() {
    // Print shopping list
    document.getElementById('btn-print-shopping-list')?.addEventListener('click', () => {
      window.print();
    });

    // Copy shopping list text
    document.getElementById('btn-copy-shopping-list')?.addEventListener('click', () => {
      const shoppingList = window.store.generateShoppingList();
      let text = `LISTĂ DE CUMPĂRĂTURI NUTRIPLANNER\nTotal estimat: ${shoppingList.totalBudget.toFixed(2)} RON\n\n`;
      shoppingList.items.forEach(it => {
        text += `[ ] ${it.name} - ${it.totalGrams}g (Cumpără ${it.packagesToBuy} pachete ~ ${it.estimatedCost.toFixed(2)} RON)\n`;
      });
      navigator.clipboard.writeText(text).then(() => {
        this.showToast('Lista de cumpărături a fost copiată în clipboard!', 'success');
      });
    });

    // Export JSON
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
      const jsonStr = window.store.exportDataJson();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutriplanner_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import JSON
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const ok = window.store.importDataJson(event.target.result);
            if (ok) {
              this.showToast('Datele au fost importate cu succes!', 'success');
              this.renderCurrentView();
            } else {
              this.showToast('Fișierul JSON nu are formatul corect.', 'error');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });

    // Reset defaults
    document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
      this.showConfirmModal({
        title: 'Resetare Date Inițiale',
        message: 'Ești sigur că vrei să resetezi toate datele la starea inițială din Google Sheet? Toate rețetele și ingredientele adăugate vor fi resetate.',
        confirmText: 'Resetează tot',
        isDanger: true,
        onConfirm: () => {
          window.store.resetToDefaults();
          this.showToast('Datele au fost resetate la starea inițială!', 'success');
          this.renderCurrentView();
        }
      });
    });
  }

  // ==========================================
  // 6. TOTAL PROFILE / CONSOLIDATED VIEW
  // ==========================================
  renderTotalView() {
    const data = window.store.calculateAllProfilesTotal();
    const activeSubTab = this.totalSubTab || 'recipes';
    const activeProfile = window.store.getActiveProfile() || { name: 'Profil' };

    return `
      <div class="space-y-6 pb-24">
        <!-- Top Hero Bento Card: Consolidated Overview -->
        <div class="bento-lilac-hero p-6 sm:p-7 bento-card relative">
          <!-- 3D Clay Aesthetic Background Art -->
          <div class="absolute right-3 -top-2 sm:right-6 sm:top-2 pointer-events-none opacity-90 clay-3d-element hidden xs:block">
            <svg width="150" height="150" viewBox="0 0 160 160" fill="none" class="w-24 h-24 sm:w-36 sm:h-36">
              <defs>
                <radialGradient id="clayTotalGold" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stop-color="#FFE082"/>
                  <stop offset="45%" stop-color="#FFB300"/>
                  <stop offset="100%" stop-color="#E65100"/>
                </radialGradient>
                <radialGradient id="clayTotalPurple" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stop-color="#C4B5FD"/>
                  <stop offset="60%" stop-color="#8B5CF6"/>
                  <stop offset="100%" stop-color="#5B21B6"/>
                </radialGradient>
                <filter id="clayTotalShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="8" stdDeviation="6" flood-opacity="0.25"/>
                </filter>
              </defs>
              <circle cx="85" cy="55" r="34" fill="url(#clayTotalPurple)" filter="url(#clayTotalShadow)"/>
              <circle cx="85" cy="55" r="16" fill="#F3E8FF"/>
              <rect x="30" y="65" width="48" height="48" rx="16" fill="url(#clayTotalGold)" transform="rotate(-12 30 65)" filter="url(#clayTotalShadow)"/>
            </svg>
          </div>

          <div class="relative z-10 max-w-xl">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-black/30 backdrop-blur-md text-[11px] font-black tracking-wider uppercase text-[#6D4AE8] dark:text-[#C4B5FD] mb-2.5 border border-white/60 dark:border-white/10 shadow-2xs">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Profil de Total & Costuri Consolidate
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold font-display text-slate-900 dark:text-white tracking-tight leading-tight">
              Sinteză Rețete & Costuri per Profil
            </h1>
            <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-1.5 leading-relaxed font-medium">
              Vizualizează toate rețetele introduse pe fiecare profil de membru, costurile totale per profil și costul consolidat al planificării săptămânale.
            </p>

            <!-- Quick Exit Buttons back to Individual Views -->
            <div class="flex items-center gap-2.5 mt-3.5 flex-wrap">
              <button id="btn-exit-total-to-planner" class="btn-pill btn-pill-dark text-xs !py-2 !px-4 font-bold flex items-center gap-2 shadow-md hover:scale-[1.02] transition cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                <span>← Înapoi la Planificator (${activeProfile.name})</span>
              </button>
              <button id="btn-exit-total-to-recipes" class="btn-pill btn-pill-outline text-xs !py-2 !px-3.5 font-bold bg-white/80 dark:bg-black/30 flex items-center gap-1.5 shadow-2xs hover:scale-[1.02] transition cursor-pointer">
                <span>Rețetar Individual (${activeProfile.name})</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          </div>

          <!-- Top Bento KPI Metrics -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-5 relative z-10">
            <!-- Metric 1: Cost Rețete Proprii -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#181924]/90 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-2xs">
              <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Rețete Proprii</div>
              <div class="text-lg sm:text-2xl font-black text-[#218352] dark:text-[#70D6A3] mt-1 font-display">
                ${data.totals.grandTotalCreatedRecipesCost.toFixed(2)} <span class="text-xs sm:text-sm font-extrabold">RON</span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                ${data.totals.grandTotalCreatedRecipesCount} rețete pe ${data.profiles.length} profiluri
              </div>
            </div>

            <!-- Metric 2: Cost Plan Săptămânal Consolidat -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#181924]/90 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-2xs">
              <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Plan Săptămânal Menaj</div>
              <div class="text-lg sm:text-2xl font-black text-[#6D4AE8] dark:text-[#C4B5FD] mt-1 font-display">
                ${data.totals.grandTotalWeeklyCost.toFixed(2)} <span class="text-xs sm:text-sm font-extrabold">RON</span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                ${data.totals.grandTotalWeeklyItems} mese planificate pe 7 zile
              </div>
            </div>

            <!-- Metric 3: Medie Zilnică Menaj -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#181924]/90 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-2xs">
              <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Medie / Zi Menaj</div>
              <div class="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-display">
                ${(data.totals.grandTotalWeeklyCost / 7).toFixed(2)} <span class="text-xs sm:text-sm font-extrabold">RON/zi</span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Consolidat toți membrii
              </div>
            </div>

            <!-- Metric 4: Profiluri Active -->
            <div class="p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-[#181924]/90 backdrop-blur-md border border-white/60 dark:border-white/10 shadow-2xs">
              <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400">Profiluri Înregistrate</div>
              <div class="text-lg sm:text-2xl font-black text-slate-800 dark:text-white mt-1 font-display">
                ${data.profiles.length} <span class="text-xs sm:text-sm font-extrabold">profiluri</span>
              </div>
              <div class="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                ${data.commonRecipes.length} rețete comune în catalog
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-Tab Navigation Bar -->
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div class="inline-flex items-center p-1 rounded-2xl bg-slate-200/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-2xs">
            <button data-total-tab="recipes" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${activeSubTab === 'recipes' ? 'bg-white dark:bg-[#181924] text-[#121319] dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              <span>Rețete per Profil (${data.totals.grandTotalCreatedRecipesCount})</span>
            </button>
            <button data-total-tab="planner" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${activeSubTab === 'planner' ? 'bg-white dark:bg-[#181924] text-[#121319] dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Plan Săptămânal Menaj (${data.totals.grandTotalWeeklyCost.toFixed(0)} RON)</span>
            </button>
            <button data-total-tab="summary" class="px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${activeSubTab === 'summary' ? 'bg-white dark:bg-[#181924] text-[#121319] dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              <span>Tabel Comparativ</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-total-export-json" class="btn-pill btn-pill-outline text-xs !py-1.5 !px-3 font-bold flex items-center gap-1.5 shadow-2xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              <span>Export Date</span>
            </button>
          </div>
        </div>

        <!-- Sub-Tab Content -->
        ${activeSubTab === 'recipes' ? this.renderTotalRecipesTab(data) : ''}
        ${activeSubTab === 'planner' ? this.renderTotalPlannerTab(data) : ''}
        ${activeSubTab === 'summary' ? this.renderTotalSummaryTab(data) : ''}
      </div>
    `;
  }

  renderTotalRecipesTab(data) {
    return `
      <div class="space-y-6">
        ${data.recipesByProfile.map(pData => {
          const p = pData.profile;
          const recipeCount = pData.recipes.length;
          const totalCost = pData.totalCost;

          return `
            <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm space-y-4">
              <!-- Profile Header Row -->
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E0F5] dark:border-white/10">
                <div class="flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-[#B8A9FD] via-[#FFB259] to-[#FF6FA4] p-0.5 shadow-sm flex-shrink-0">
                    <div class="w-full h-full rounded-full bg-[#121319] dark:bg-white flex items-center justify-center overflow-hidden">
                      ${p.photo ? `
                        <img src="${p.photo}" alt="${p.name}" class="w-full h-full object-cover">
                      ` : `
                        <span class="text-sm font-black text-white dark:text-[#121319]">${p.name ? p.name.slice(0, 2).toUpperCase() : 'NP'}</span>
                      `}
                    </div>
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="text-lg font-extrabold font-display text-slate-900 dark:text-white">${p.name}</h3>
                      <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD]">
                        ${p.gender === 'feminin' ? '♀ Feminin' : '♂ Masculin'}
                      </span>
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ${p.calories} kcal/zi țintă • ${p.protein}g P • ${p.carbs}g C • ${p.fat}g G
                    </div>
                  </div>
                </div>

                <!-- Subtotal Cost Pill & Actions -->
                <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div class="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 flex items-center gap-2">
                    <span class="text-xs text-emerald-800 dark:text-emerald-300 font-bold">Subtotal Profil:</span>
                    <span class="text-sm sm:text-base font-black text-[#218352] dark:text-[#70D6A3] font-display">
                      ${totalCost.toFixed(2)} RON
                    </span>
                  </div>

                  <button data-switch-to-profile="${p.id}" class="btn-pill btn-pill-outline text-xs !py-1.5 !px-3 font-bold flex items-center gap-1.5 whitespace-nowrap bg-white/80 dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 cursor-pointer shadow-2xs" title="Comută pe acest profil și deschide planificatorul">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    <span>Comută Profil 👤</span>
                  </button>

                  <button data-create-recipe-for-profile="${p.id}" class="btn-pill btn-pill-primary text-xs !py-1.5 !px-3 font-bold flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                    <span>+ Rețetă Proprie</span>
                  </button>
                </div>
              </div>

              <!-- Recipes List / Grid for this Profile -->
              ${recipeCount === 0 ? `
                <div class="text-center py-8 border-2 border-dashed border-[#E5E0F5] dark:border-white/10 rounded-2xl bg-slate-50/50 dark:bg-white/5 space-y-2">
                  <div class="w-10 h-10 rounded-full bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center mx-auto">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  </div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-300">Nu există încă rețete create exclusiv pe profilul „${p.name}”.</p>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500">Apasă pe butonul „+ Rețetă Proprie” de mai sus pentru a adăuga prima rețetă cu calcul automat de cost.</p>
                </div>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${pData.recipes.map(r => `
                    <div class="p-3.5 sm:p-4 rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 hover:border-brand-lilac/50 transition shadow-2xs space-y-2.5">
                      <!-- Title & Category -->
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0 flex-1">
                          <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD]">
                            ${r.category || 'Rețetă'}
                          </span>
                          <button type="button" data-recipe-details="${r.id}" class="text-left font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate block hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] transition mt-1" title="Apasă pentru detalii și editare ingrediente">
                            ${r.name}
                          </button>
                        </div>
                        <div class="text-right flex-shrink-0">
                          <div class="text-sm sm:text-base font-black text-[#218352] dark:text-[#70D6A3] font-display">
                            ${r.perServing.cost.toFixed(2)} lei
                          </div>
                          <div class="text-[10px] text-slate-400 dark:text-slate-500">per porție</div>
                        </div>
                      </div>

                      <!-- Cost breakdown & Servings badge -->
                      <div class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200/60 dark:border-white/5">
                        <span class="text-slate-600 dark:text-slate-300 font-semibold">${r.servings} porții • ${Math.round(r.totals.weight)}g total</span>
                        <span class="font-extrabold text-[#218352] dark:text-[#70D6A3] text-xs">Total Rețetă: ${r.totals.cost.toFixed(2)} lei</span>
                      </div>

                      <!-- Nutritional Macros per Serving -->
                      <div class="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap overflow-hidden">
                        <span class="font-bold text-slate-800 dark:text-white">${Math.round(r.perServing.calories)} kcal</span>
                        <span class="text-slate-300 dark:text-slate-600">•</span>
                        <span class="text-[#E02868] dark:text-[#FFA4CD] font-bold">${r.perServing.protein.toFixed(1)}g P</span>
                        <span class="text-slate-300 dark:text-slate-600">•</span>
                        <span class="text-[#D97706] dark:text-[#FFC480] font-bold">${r.perServing.carbs.toFixed(1)}g C</span>
                        <span class="text-slate-300 dark:text-slate-600">•</span>
                        <span class="text-[#0284C7] dark:text-[#98DDFE] font-bold">${r.perServing.fat.toFixed(1)}g G</span>
                      </div>

                      <!-- Action Buttons -->
                      <div class="flex items-center gap-1.5 pt-1 border-t border-slate-200/50 dark:border-white/5">
                        <button type="button" data-recipe-details="${r.id}" class="flex-1 py-1.5 px-2.5 text-center rounded-xl bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/15 border border-slate-200/70 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 transition">
                          Detalii Ingrediente
                        </button>
                        <button type="button" data-recipe-edit="${r.id}" class="py-1.5 px-3 rounded-xl bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-bold hover:opacity-90 transition flex items-center gap-1">
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          <span>Editează</span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}

        <!-- Grand Total Summary Banner for Recipes -->
        <div class="bento-card bento-lilac p-4 sm:p-5 rounded-3xl border border-brand-lilac/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-[#6D4AE8] dark:text-[#C4B5FD]">
              TOTAL GENERAL REȚETE PROPRII (TOATE PROFILURILE)
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Costul cumulat al tuturor celor ${data.totals.grandTotalCreatedRecipesCount} rețete înregistrate
            </div>
          </div>
          <div class="text-xl sm:text-2xl font-black text-[#218352] dark:text-[#70D6A3] font-display">
            ${data.totals.grandTotalCreatedRecipesCost.toFixed(2)} RON
          </div>
        </div>
      </div>
    `;
  }

  renderTotalPlannerTab(data) {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

    return `
      <div class="space-y-6">
        ${data.profilesPlanData.map(pPlan => {
          const p = pPlan.profile;
          return `
            <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E0F5] dark:border-white/10">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                    ${p.photo ? `
                      <img src="${p.photo}" alt="${p.name}" class="w-full h-full object-cover">
                    ` : `
                      <span class="text-xs font-black text-slate-800 dark:text-white">${p.name ? p.name.slice(0, 2).toUpperCase() : 'NP'}</span>
                    `}
                  </div>
                  <div>
                    <h3 class="text-base font-extrabold text-slate-900 dark:text-white">${p.name}</h3>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                      ${pPlan.totalItems} preparate planificate • Medie: ${pPlan.totals.avgDailyCost.toFixed(2)} RON/zi
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <div class="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-right">
                    <div class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Cost Săptămânal</div>
                    <div class="text-base font-black text-[#218352] dark:text-[#70D6A3] font-display">
                      ${pPlan.totals.cost.toFixed(2)} RON
                    </div>
                  </div>
                  <button data-switch-to-profile="${p.id}" class="btn-pill btn-pill-outline text-xs !py-1.5 !px-3 font-bold">
                    Deschide Plan 📅
                  </button>
                </div>
              </div>

              <!-- 7 Days Grid for this Profile -->
              <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                ${days.map(d => {
                  const dayData = pPlan.days[d] || { items: [], totals: { cost: 0, calories: 0 } };
                  const count = dayData.items.length;
                  return `
                    <div class="p-2.5 rounded-xl border border-slate-200/70 dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 space-y-1 text-center">
                      <div class="text-[11px] font-extrabold text-slate-900 dark:text-white">${d}</div>
                      <div class="text-xs font-black text-[#218352] dark:text-[#70D6A3]">${dayData.totals.cost.toFixed(1)} lei</div>
                      <div class="text-[10px] text-slate-500 dark:text-slate-400">${Math.round(dayData.totals.calories)} kcal • ${count} prep.</div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}

        <!-- Grand Total Weekly Plan Banner -->
        <div class="bento-card bento-lilac p-4 sm:p-5 rounded-3xl border border-brand-lilac/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-[#6D4AE8] dark:text-[#C4B5FD]">
              TOTAL GENERAL PLAN SĂPTĂMÂNAL MENAJ (TOATE PROFILURILE)
            </div>
            <div class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Bugetul total de alimente planificate pe 7 zile pentru toți membrii
            </div>
          </div>
          <div class="text-xl sm:text-2xl font-black text-[#6D4AE8] dark:text-[#C4B5FD] font-display">
            ${data.totals.grandTotalWeeklyCost.toFixed(2)} RON
          </div>
        </div>
      </div>
    `;
  }

  renderTotalSummaryTab(data) {
    return `
      <div class="space-y-4">
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm overflow-hidden">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xl font-extrabold font-display text-slate-900 dark:text-white">Tabel Comparativ per Profil</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Comparație detaliată a costurilor și rețetelor între toate profilurile din cont</p>
            </div>
            <span class="pill-badge pill-badge-translucent">${data.profiles.length} Profiluri</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                  <th class="py-3 px-3.5 font-bold rounded-l-xl">Membru Profil</th>
                  <th class="py-3 px-3.5 font-bold">Țintă Calorii</th>
                  <th class="py-3 px-3.5 font-bold">Rețete Proprii</th>
                  <th class="py-3 px-3.5 font-bold text-[#218352] dark:text-[#70D6A3]">Cost Rețete</th>
                  <th class="py-3 px-3.5 font-bold">Mese Săpt.</th>
                  <th class="py-3 px-3.5 font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">Cost Săptămână</th>
                  <th class="py-3 px-3.5 font-bold">Medie Zilnică</th>
                  <th class="py-3 px-3.5 font-bold text-right rounded-r-xl">Acțiuni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-white/5">
                ${data.profiles.map(p => {
                  const pRec = data.recipesByProfile.find(item => item.profile.id === p.id);
                  const pPlan = data.profilesPlanData.find(item => item.profile.id === p.id);
                  const recCount = pRec ? pRec.recipes.length : 0;
                  const recCost = pRec ? pRec.totalCost : 0;
                  const planItems = pPlan ? pPlan.totalItems : 0;
                  const planCost = pPlan ? pPlan.totals.cost : 0;
                  const avgDaily = pPlan ? pPlan.totals.avgDailyCost : 0;

                  return `
                    <tr class="hover:bg-slate-50/80 dark:hover:bg-white/5 transition">
                      <td class="py-3.5 px-3.5 font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold">
                          ${p.name ? p.name.slice(0, 2).toUpperCase() : 'NP'}
                        </div>
                        <span>${p.name}</span>
                      </td>
                      <td class="py-3.5 px-3.5 text-slate-600 dark:text-slate-400 font-medium">${Math.round(p.calories)} kcal</td>
                      <td class="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 font-bold">${recCount}</td>
                      <td class="py-3.5 px-3.5 font-black text-[#218352] dark:text-[#70D6A3]">${recCost.toFixed(2)} RON</td>
                      <td class="py-3.5 px-3.5 text-slate-700 dark:text-slate-300">${planItems}</td>
                      <td class="py-3.5 px-3.5 font-black text-[#6D4AE8] dark:text-[#C4B5FD]">${planCost.toFixed(2)} RON</td>
                      <td class="py-3.5 px-3.5 text-amber-600 dark:text-amber-400 font-bold">${avgDaily.toFixed(2)} RON/zi</td>
                      <td class="py-3.5 px-3.5 text-right">
                        <button data-switch-to-profile="${p.id}" class="btn-pill btn-pill-dark text-xs py-1.5 px-2.5">
                          Deschide
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-slate-100/90 dark:bg-white/10 font-bold border-t-2 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                  <td class="py-3.5 px-3.5 font-black">TOTAL CONSOLIDAT</td>
                  <td class="py-3.5 px-3.5">-</td>
                  <td class="py-3.5 px-3.5 font-black">${data.totals.grandTotalCreatedRecipesCount}</td>
                  <td class="py-3.5 px-3.5 font-black text-[#218352] dark:text-[#70D6A3]">${data.totals.grandTotalCreatedRecipesCost.toFixed(2)} RON</td>
                  <td class="py-3.5 px-3.5 font-black">${data.totals.grandTotalWeeklyItems}</td>
                  <td class="py-3.5 px-3.5 font-black text-[#6D4AE8] dark:text-[#C4B5FD]">${data.totals.grandTotalWeeklyCost.toFixed(2)} RON</td>
                  <td class="py-3.5 px-3.5 font-black text-amber-600 dark:text-amber-400">${(data.totals.grandTotalWeeklyCost / 7).toFixed(2)} RON/zi</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  bindTotalEvents() {
    // Total sub-tabs switcher
    document.querySelectorAll('[data-total-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.totalSubTab = e.currentTarget.getAttribute('data-total-tab');
        this.renderCurrentView();
      });
    });

    // Recipe details modal
    document.querySelectorAll('[data-recipe-details]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-details');
        this.openRecipeDetailsModal(id);
      });
    });

    // Recipe edit builder modal
    document.querySelectorAll('[data-recipe-edit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-recipe-edit');
        const raw = window.store.getRecipeById(id);
        if (raw) {
          this.openRecipeBuilderModal(raw);
        }
      });
    });

    // Create recipe for specific profile
    document.querySelectorAll('[data-create-recipe-for-profile]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const profId = e.currentTarget.getAttribute('data-create-recipe-for-profile');
        if (profId) {
          window.store.setActiveProfile(profId);
          this.updateHeaderProfile();
        }
        this.openRecipeBuilderModal(null);
      });
    });

    // Switch to profile and open planner
    document.querySelectorAll('[data-switch-to-profile]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const profId = e.currentTarget.getAttribute('data-switch-to-profile');
        const switched = window.store.setActiveProfile(profId);
        if (switched) {
          this.dailyCalorieTarget = switched.calories;
          this.updateHeaderProfile();
          this.switchTab('planner');
          this.showToast(`Comutat pe profilul "${switched.name}".`, 'success');
        }
      });
    });

    // Exit buttons back to individual planner or recipes
    document.getElementById('btn-exit-total-to-planner')?.addEventListener('click', () => {
      this.switchTab('planner');
    });
    document.getElementById('btn-exit-total-to-recipes')?.addEventListener('click', () => {
      this.switchTab('recipes');
    });

    // Export data JSON button
    document.getElementById('btn-total-export-json')?.addEventListener('click', () => {
      const json = window.store.exportDataJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutriplanner_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('Baza de date a fost exportată!', 'success');
    });
  }

  // ==========================================
  // MODALS & DIALOGS
  // ==========================================
  openModal(html, options = {}) {
    this.closeModal();
    const modalWrapper = document.createElement('div');
    modalWrapper.id = 'active-modal-root';

    // Position: 'center' (default: center middle vertically & horizontally) vs 'top' (for virtual keyboard search forms)
    const isTop = options.position === 'top';
    const positionClass = isTop
      ? 'items-start pt-2 sm:pt-6 sm:items-center'
      : 'items-center';

    const marginClass = isTop ? 'my-0 sm:my-auto' : 'my-auto';
    const heightClass = options.height || (isTop ? 'h-[88dvh] max-h-[88dvh] sm:h-[680px]' : 'max-h-[88dvh] max-h-[88vh]');
    const maxWidthClass = options.maxWidth || 'max-w-2xl';

    modalWrapper.innerHTML = `
      <div class="fixed inset-0 z-50 flex ${positionClass} justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-md modal-enter" data-modal-backdrop="true">
        <div class="bg-white dark:bg-[#181924] rounded-3xl ${maxWidthClass} w-full ${heightClass} flex flex-col shadow-2xl border border-[#E5E0F5] dark:border-white/10 text-slate-800 dark:text-white relative overflow-hidden ${marginClass}">
          ${html}
        </div>
      </div>
    `;
    document.body.appendChild(modalWrapper);
    this.activeModal = modalWrapper;
    document.body.style.overflow = 'hidden';

    // Direct listener on backdrop (click outside card)
    const backdrop = modalWrapper.querySelector('[data-modal-backdrop="true"]');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          this.closeModal();
        }
      });
    }

    // Direct click listeners for all close buttons inside the modal ('X', 'Anulează', 'Închide')
    modalWrapper.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeModal();
      });
    });
  }

  closeModal() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
      document.body.style.overflow = '';
    }
  }

  showToast(message, type = 'success', duration = 3500) {
    let toastContainer = document.getElementById('app-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'app-toast-container';
      toastContainer.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none px-4 w-full max-w-md';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#121319]/95 dark:bg-[#1E202E]/95 text-white backdrop-blur-xl border border-white/15 shadow-2xl transition-all duration-300 transform -translate-y-2 opacity-0 text-xs sm:text-sm font-semibold max-w-full';

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg></div>`;
    } else if (type === 'error') {
      iconSvg = `<div class="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg></div>`;
    } else if (type === 'warning') {
      iconSvg = `<div class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>`;
    } else {
      iconSvg = `<div class="w-6 h-6 rounded-full bg-brand-lilac/20 text-brand-lilac flex items-center justify-center flex-shrink-0"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>`;
    }

    toast.innerHTML = `
      ${iconSvg}
      <span class="flex-1">${message}</span>
      <button class="text-white/40 hover:text-white transition p-1" onclick="this.parentElement.remove()">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;

    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('-translate-y-2', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  showConfirmModal({ title, message, confirmText = 'Da, confirmă', cancelText = 'Anulează', onConfirm, isDanger = false }) {
    const html = `
      <div class="p-5 sm:p-6 text-center space-y-4">
        <div class="w-12 h-12 rounded-2xl ${isDanger ? 'bg-rose-500/15 text-rose-500' : 'bg-brand-lilac/15 text-brand-lilac'} flex items-center justify-center mx-auto">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${isDanger 
              ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>'
              : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'}
          </svg>
        </div>

        <div>
          <h3 class="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">${title}</h3>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">${message}</p>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-2 max-w-xs mx-auto">
          <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs sm:text-sm py-2.5 px-3 whitespace-nowrap justify-center w-full">
            ${cancelText}
          </button>
          <button id="modal-confirm-action-btn" class="btn-pill ${isDanger ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'btn-pill-primary'} text-xs sm:text-sm py-2.5 px-3 whitespace-nowrap justify-center w-full shadow">
            ${confirmText}
          </button>
        </div>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-sm' });
    document.getElementById('modal-confirm-action-btn')?.addEventListener('click', () => {
      this.closeModal();
      if (typeof onConfirm === 'function') onConfirm();
    });
  }

  // --- Modal: Scanned EAN Ingredient Pop-up ---
  openScannedEanModal(res) {
    const d = res.data;
    const categories = ['Carne & Pește', 'Lactate', 'Cereale & Carbi', 'Legume & Fructe', 'Grăsimi & Uleiuri', 'Condimente & Sosuri', 'Altele'];

    const initialPrice = d.packagePrice ? parseFloat(d.packagePrice).toFixed(2) : '';
    const initialQty = d.packageQuantity || 100;
    const initialP100 = (initialPrice && initialQty > 0) ? ((parseFloat(initialPrice) / initialQty) * 100).toFixed(2) : '0.00';

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">Produs Identificat</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${res.isExisting ? 'bg-brand-lilac/20 text-brand-dark dark:text-brand-lilac' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'} flex-shrink-0">
                ${res.isExisting ? 'Existent în DB' : 'Open Food Facts'}
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">EAN: ${d.ean || '-'}</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition" title="Închide">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- Name & Category -->
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">Denumire Produs</label>
            <input type="text" id="scan-modal-name" value="${d.name || ''}" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">Categorie</label>
              <select id="scan-modal-cat" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
                ${categories.map(c => `
                  <option value="${c}" ${d.category === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 dark:text-white/80 mb-1">Brand / Magazin (opțional)</label>
              <input type="text" id="scan-modal-brand" value="${d.brand || ''}" placeholder="ex: Pilos, K-Classic..." class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
            </div>
          </div>
        </div>

        <!-- Package Weight & Price Card -->
        <div class="bento-card bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 p-3.5 sm:p-4 rounded-2xl space-y-2.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-emerald-950 dark:text-emerald-200 mb-1">Gramaj Pachet (g)</label>
              <input type="number" id="scan-modal-qty" value="${initialQty}" class="w-full bg-white dark:bg-[#181924] border border-emerald-300 dark:border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            </div>
            <div>
              <label class="block text-xs font-bold text-emerald-950 dark:text-emerald-200 mb-1">Preț Pachet (RON)</label>
              <input type="number" step="0.01" id="scan-modal-price" value="${initialPrice}" placeholder="ex: 8.50" class="w-full bg-white dark:bg-[#181924] border border-emerald-300 dark:border-emerald-500/40 rounded-xl px-3 py-2 text-sm font-extrabold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            </div>
          </div>
          <div class="flex items-center justify-between text-xs pt-1.5 border-t border-emerald-500/20">
            <span class="text-emerald-900 dark:text-emerald-200 font-medium">Preț calculat per 100g:</span>
            <span id="scan-modal-calc-p100" class="font-black text-sm text-emerald-700 dark:text-emerald-400">${initialP100} lei/100g</span>
          </div>
        </div>

        <!-- Nutrition Inputs (per 100g) -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-3.5 sm:p-4 rounded-2xl space-y-2.5">
          <div class="flex items-center justify-between">
            <label class="text-xs font-extrabold text-slate-800 dark:text-white">Valori Nutriționale per 100g</label>
            <span class="text-[10px] text-slate-400 dark:text-slate-500">Introdu ce mai este necesar</span>
          </div>
          <div class="grid grid-cols-4 gap-2 text-center">
            <div class="bg-brand-lilac/15 dark:bg-brand-lilac/10 p-2 sm:p-2.5 rounded-xl border border-brand-lilac/30">
              <div class="text-[10px] font-bold text-brand-dark dark:text-brand-lilac">Calorii</div>
              <input type="number" id="scan-modal-cals" value="${Math.round(d.calories || 0)}" class="w-full text-center bg-white dark:bg-[#181924] border border-brand-lilac/40 rounded-lg py-1 mt-1 text-xs font-black text-brand-dark dark:text-white focus:outline-none">
              <div class="text-[9px] text-slate-400 mt-0.5">kcal</div>
            </div>
            <div class="bg-brand-pink/15 dark:bg-brand-pink/10 p-2 sm:p-2.5 rounded-xl border border-brand-pink/30">
              <div class="text-[10px] font-bold text-rose-700 dark:text-brand-pink">Proteine</div>
              <input type="number" step="0.1" id="scan-modal-prot" value="${d.protein || 0}" class="w-full text-center bg-white dark:bg-[#181924] border border-brand-pink/40 rounded-lg py-1 mt-1 text-xs font-black text-rose-600 dark:text-brand-pink focus:outline-none">
              <div class="text-[9px] text-slate-400 mt-0.5">g</div>
            </div>
            <div class="bg-brand-apricot/15 dark:bg-brand-apricot/10 p-2 sm:p-2.5 rounded-xl border border-brand-apricot/30">
              <div class="text-[10px] font-bold text-amber-800 dark:text-brand-apricot">Carbi</div>
              <input type="number" step="0.1" id="scan-modal-carbs" value="${d.carbs || 0}" class="w-full text-center bg-white dark:bg-[#181924] border border-brand-apricot/40 rounded-lg py-1 mt-1 text-xs font-black text-amber-600 dark:text-brand-apricot focus:outline-none">
              <div class="text-[9px] text-slate-400 mt-0.5">g</div>
            </div>
            <div class="bg-brand-sky/15 dark:bg-brand-sky/10 p-2 sm:p-2.5 rounded-xl border border-brand-sky/30">
              <div class="text-[10px] font-bold text-sky-800 dark:text-brand-sky">Grăsimi</div>
              <input type="number" step="0.1" id="scan-modal-fat" value="${d.fat || 0}" class="w-full text-center bg-white dark:bg-[#181924] border border-brand-sky/40 rounded-lg py-1 mt-1 text-xs font-black text-sky-600 dark:text-brand-sky focus:outline-none">
              <div class="text-[9px] text-slate-400 mt-0.5">g</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-save-scanned-modal" class="btn-pill btn-pill-primary text-xs sm:text-sm shadow">
          ${res.isExisting ? 'Actualizează în DB' : 'Salvează în Baza de Date'}
        </button>
      </div>
    `;

    this.openModal(html);

    // Live price per 100g recalculation
    const qtyIn = document.getElementById('scan-modal-qty');
    const priceIn = document.getElementById('scan-modal-price');
    const p100El = document.getElementById('scan-modal-calc-p100');

    const updateCalc = () => {
      const q = parseFloat(qtyIn?.value) || 0;
      const p = parseFloat(priceIn?.value) || 0;
      if (q > 0 && p > 0) {
        p100El.textContent = ((p / q) * 100).toFixed(2) + ' lei/100g';
      } else {
        p100El.textContent = '0.00 lei/100g';
      }
    };

    qtyIn?.addEventListener('input', updateCalc);
    priceIn?.addEventListener('input', updateCalc);

    // Save button logic
    document.getElementById('btn-save-scanned-modal')?.addEventListener('click', () => {
      const name = document.getElementById('scan-modal-name')?.value.trim();
      const category = document.getElementById('scan-modal-cat')?.value || 'Altele';
      const brand = document.getElementById('scan-modal-brand')?.value.trim();
      const packageQuantity = parseFloat(qtyIn?.value) || 100;
      const packagePrice = parseFloat(priceIn?.value) || 0;
      const calories = parseFloat(document.getElementById('scan-modal-cals')?.value) || 0;
      const protein = parseFloat(document.getElementById('scan-modal-prot')?.value) || 0;
      const carbs = parseFloat(document.getElementById('scan-modal-carbs')?.value) || 0;
      const fat = parseFloat(document.getElementById('scan-modal-fat')?.value) || 0;

      if (!name) {
        this.showToast('Te rugăm să introduci denumirea produsului.', 'warning');
        return;
      }
      if (packagePrice <= 0) {
        this.showToast('Te rugăm să introduci prețul plătit pe pachet.', 'warning');
        return;
      }

      if (res.isExisting && res.ingredient) {
        window.store.updateIngredient(res.ingredient.id, {
          name,
          category,
          packageQuantity,
          packagePrice,
          calories,
          protein,
          carbs,
          fat,
          brand
        });
        this.showToast(`Prețul și datele pentru "${name}" au fost actualizate!`, 'success');
      } else {
        window.store.addIngredient({
          name,
          category,
          packageQuantity,
          packagePrice,
          calories,
          protein,
          carbs,
          fat,
          brand,
          ean: d.ean
        });
        this.showToast(`Produsul "${name}" a fost salvat cu succes în baza de date!`, 'success');
      }

      this.closeModal();
      if (window.barcodeScanner && window.barcodeScanner.isScanning) {
        window.barcodeScanner.stopCamera();
        const cameraBtn = document.getElementById('btn-toggle-camera');
        if (cameraBtn) {
          cameraBtn.textContent = 'Pornește Camera';
          cameraBtn.classList.remove('bg-rose-600');
          cameraBtn.classList.add('bg-emerald-600');
        }
      }
    });
  }

  // --- Modal: Scanned Receipt (Bon Fiscal) Pop-up ---
  openReceiptModal(parsed) {
    const categories = ['Carne & Pește', 'Lactate', 'Cereale & Carbi', 'Legume & Fructe', 'Grăsimi & Uleiuri', 'Condimente & Sosuri', 'Altele'];

    // Sanitize items: purge any OCR noise items like ", X", "' X", or items without letters
    parsed.items = (parsed.items || []).filter(it => {
      if (!it || !it.name) return false;
      const letters = it.name.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
      if (letters.length < 2) return false;
      if (/^[,'.~`"_\-^#*]+\s*[xX*]/i.test(it.name.trim())) return false;
      if (/^[xX*]$/i.test(it.name.trim())) return false;
      return true;
    });

    // Ensure valid positive quantity (never 0g fallback)
    parsed.items.forEach(it => {
      if (!it.quantity || it.quantity <= 0) {
        it.quantity = 100;
      }
    });

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-brand-lilac/15 text-brand-lilac flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">${parsed.store}</h3>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                ${parsed.items.length} articole
              </span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${parsed.date} • Total: ${parsed.totalCalculated.toFixed(2)} RON</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition" title="Închide">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body with Items -->
      <div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-2.5">
        <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pb-1">
          <span>Verifică și ajustează datele extrase:</span>
          <label class="flex items-center gap-1.5 cursor-pointer font-bold text-brand-dark dark:text-brand-lilac text-[11px]">
            <input type="checkbox" id="modal-receipt-check-all" checked class="rounded border-slate-300">
            <span>Selectează tot</span>
          </label>
        </div>

        ${parsed.items.map((it, idx) => `
          <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 space-y-2 shadow-2xs" data-receipt-idx="${idx}">
            <div class="flex items-start gap-2.5">
              <input type="checkbox" data-receipt-item-cb="${idx}" checked class="mt-1 rounded border-slate-300 text-brand-lilac flex-shrink-0">
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <input type="text" data-receipt-name="${idx}" value="${it.name}" class="w-full font-bold text-xs sm:text-sm bg-transparent border-b border-dashed border-slate-300 dark:border-white/20 focus:border-brand-lilac focus:outline-none text-slate-900 dark:text-white pb-0.5">
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${it.isMatched ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}">
                      ${it.isMatched ? 'Găsit în DB' : 'Produs Nou'}
                    </span>
                    <button type="button" data-receipt-remove-item="${idx}" class="p-1 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-white/10 transition" title="Șterge din listă">
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-xs">
                  <div class="flex items-center gap-1">
                    <span class="text-slate-400 text-[11px]">Gramaj:</span>
                    <input type="number" data-receipt-qty="${idx}" value="${it.quantity || 100}" class="w-16 bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-center text-slate-800 dark:text-white">
                    <span class="text-slate-400 text-[11px]">g</span>
                  </div>

                  <div class="flex items-center gap-1">
                    <span class="text-slate-400 text-[11px]">Preț:</span>
                    <input type="number" step="0.01" data-receipt-price="${idx}" value="${it.price.toFixed(2)}" class="w-20 bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-lg px-2 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400 text-right">
                    <span class="text-slate-400 text-[11px]">lei</span>
                  </div>

                  <div class="flex items-center gap-1">
                    <span class="text-slate-400 text-[11px]">Cat:</span>
                    <select data-receipt-cat="${idx}" class="bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 dark:text-white">
                      ${categories.map(c => `
                        <option value="${c}" ${(it.matchedIngredient && it.matchedIngredient.category === c) ? 'selected' : ''}>${c}</option>
                      `).join('')}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-import-receipt-modal" class="btn-pill btn-pill-primary text-xs sm:text-sm shadow">
          Importă în Baza de Date
        </button>
      </div>
    `;

    this.openModal(html);

    // Delete item row handler
    document.querySelectorAll('[data-receipt-remove-item]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.getAttribute('data-receipt-remove-item');
        const card = document.querySelector(`[data-receipt-idx="${idx}"]`);
        if (card) card.remove();
      });
    });

    // Toggle select all
    const checkAll = document.getElementById('modal-receipt-check-all');
    if (checkAll) {
      checkAll.addEventListener('change', (e) => {
        document.querySelectorAll('[data-receipt-item-cb]').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }

    // Import button
    document.getElementById('btn-import-receipt-modal')?.addEventListener('click', () => {
      let updatedCount = 0;
      let newCount = 0;

      parsed.items.forEach((it, idx) => {
        const cb = document.querySelector(`[data-receipt-item-cb="${idx}"]`);
        if (cb && cb.checked) {
          const name = document.querySelector(`[data-receipt-name="${idx}"]`)?.value.trim() || it.name;
          const letters = name.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
          if (letters.length < 2) return; // Skip invalid noise items

          const qty = parseFloat(document.querySelector(`[data-receipt-qty="${idx}"]`)?.value) || it.quantity || 100;
          const price = parseFloat(document.querySelector(`[data-receipt-price="${idx}"]`)?.value) || it.price || 0;
          const category = document.querySelector(`[data-receipt-cat="${idx}"]`)?.value || 'Altele';

          if (it.isMatched && it.matchedIngredient) {
            window.store.updateIngredient(it.matchedIngredient.id, {
              name,
              packagePrice: price,
              packageQuantity: qty,
              category
            });
            updatedCount++;
          } else {
            window.store.addIngredient({
              name,
              category,
              packageQuantity: qty,
              packagePrice: price,
              calories: 100,
              protein: 5,
              carbs: 10,
              fat: 2
            });
            newCount++;
          }
        }
      });

      this.closeModal();
      this.showToast(`Succes! S-au actualizat ${updatedCount} ingrediente și s-au adăugat ${newCount} produse noi.`, 'success');
      this.switchTab('ingredients');
    });
  }

  // --- Modal: Add Recipe or Foods to Meal (with Multi-Select & 2-Week Favorites & Snacks Categories) ---
  openAddRecipeToMealModal(day, meal) {
    const favorites = window.store.getFavoriteMealsForCategory(meal, 14);
    const recipes = window.store.getRecipes();
    const ingredients = window.store.getIngredients();

    // Map recipes and ingredients into unified item structures
    const recipesList = recipes.map(raw => {
      const r = window.store.calculateRecipe(raw);
      return {
        id: r.id,
        name: r.name,
        category: r.category,
        isIngredient: false,
        calories: r.perServing.calories,
        protein: r.perServing.protein,
        carbs: r.perServing.carbs,
        fat: r.perServing.fat,
        cost: r.perServing.cost,
        unit: 'porție'
      };
    });

    const ingredientsList = ingredients.map(ing => ({
      id: ing.id,
      name: ing.name,
      category: ing.category,
      isIngredient: true,
      calories: ing.calories,
      protein: ing.protein,
      carbs: ing.carbs,
      fat: ing.fat,
      cost: ing.pricePer100g,
      unit: '100g'
    }));

    // Helpers to identify Fruits & Vegetables and Sweets / Desserts
    const isFruitVeg = (it) => {
      const c = (it.category || '').toLowerCase();
      const n = (it.name || '').toLowerCase();
      return c.includes('fruct') || c.includes('legum') || 
             /mar|mere|banana|banană|afine|capsuni|căpșuni|portocal|portocale|strugur|struguri|rosie|roșii|castravet|morcov|ardei|salat|avocado|ciuperc|spanac|lamaie|lămâie|pere|ananas|kiwi|piersic|prun|pepene/i.test(n);
    };

    const isSweet = (it) => {
      const c = (it.category || '').toLowerCase();
      const n = (it.name || '').toLowerCase();
      return c.includes('dulciur') || c.includes('desert') || 
             /ciocolat|biscuit|biscuiți|prajitur|prăjitură|tort|miere|dulceat|dulceață|gem|clatit|clătite|croissant|brio|brioșă|napolitan|inghetat|înghețată|budinc|budincă|pancakes|waffle|gofre|bomboane|nutella/i.test(n);
    };

    // Filtered lists for Legume & Fructe and Dulciuri (ingredients + matching recipes)
    const fruitVegList = [
      ...ingredientsList.filter(isFruitVeg),
      ...recipesList.filter(isFruitVeg)
    ];

    const sweetsList = [
      ...ingredientsList.filter(isSweet),
      ...recipesList.filter(isSweet)
    ];

    const favoritesList = favorites.map(f => ({
      ...f,
      isFavorite: true,
      unit: f.isIngredient ? '100g' : 'porție'
    }));

    // Selection state & Servings state
    const selectedMap = new Map(); // id -> { id, isIngredient, servings, name }
    const servingsMap = new Map(); // id -> servings number

    // If opening for snack / gustare, default to favorites or fruit_veg
    const isSnackMeal = (meal || '').toLowerCase().includes('snack') || (meal || '').toLowerCase().includes('gustar');
    let currentFilterTab = favoritesList.length > 0 ? 'favorites' : (isSnackMeal ? 'fruit_veg' : 'all');
    let searchQuery = '';

    const html = `
      <!-- Fixed Header + Filter Tabs + Search Bar -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924] space-y-3">
        <div class="flex items-center justify-between">
          <div class="min-w-0">
            <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate">Adaugă la ${meal}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ziua: <span class="font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">${day}</span> • Selectează unul sau mai multe preparate</p>
          </div>
          <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition" title="Închide">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Filter Pill Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" id="meal-modal-tabs">
          <button type="button" data-meal-modal-tab="favorites" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'favorites' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            ⭐ Favorite (${favoritesList.length})
          </button>
          <button type="button" data-meal-modal-tab="fruit_veg" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'fruit_veg' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            🍓 Legume & Fructe (${fruitVegList.length})
          </button>
          <button type="button" data-meal-modal-tab="sweets" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'sweets' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            🍫 Dulciuri (${sweetsList.length})
          </button>
          <button type="button" data-meal-modal-tab="recipes" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'recipes' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            🍲 Rețete (${recipesList.length})
          </button>
          <button type="button" data-meal-modal-tab="ingredients" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'ingredients' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            🍎 Toate Alimentele (${ingredientsList.length})
          </button>
          <button type="button" data-meal-modal-tab="all" class="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${currentFilterTab === 'all' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'}">
            Toate
          </button>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <input type="text" id="modal-meal-search" placeholder="Caută fructe, legume, dulciuri sau rețete (ex: mere, banană, ciocolată)..." autocomplete="off" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-[#6D4AE8]">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Scrollable List -->
      <div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-2.5" id="modal-meal-items-container">
        <!-- Rendered dynamically -->
      </div>

      <!-- Fixed Footer with Multi-Select Actions -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between gap-2 bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2 min-w-0">
          <span id="modal-meal-selected-count" class="px-2.5 py-1 rounded-full text-xs font-black bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] whitespace-nowrap">
            0 selectate
          </span>
          <button id="btn-modal-select-all-visible" type="button" class="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white underline whitespace-nowrap">
            Selectează tot
          </button>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          <button data-modal-close="true" class="hidden sm:inline-flex btn-pill btn-pill-outline text-xs py-2 px-3.5">Anulează</button>
          <button id="btn-modal-submit-meal-items" class="btn-pill btn-pill-primary text-xs sm:text-sm shadow whitespace-nowrap py-2.5 px-4 sm:px-5">
            Adaugă în Plan (0)
          </button>
        </div>
      </div>
    `;

    this.openModal(html, { position: 'top', height: 'h-[88dvh] sm:h-[680px]', maxWidth: 'max-w-2xl' });

    const container = document.getElementById('modal-meal-items-container');
    const searchInput = document.getElementById('modal-meal-search');
    const selectedBadge = document.getElementById('modal-meal-selected-count');
    const submitBtn = document.getElementById('btn-modal-submit-meal-items');
    const selectAllBtn = document.getElementById('btn-modal-select-all-visible');

    const updateFooterCounter = () => {
      const count = selectedMap.size;
      if (selectedBadge) {
        selectedBadge.textContent = `${count} ${count === 1 ? 'selectat' : 'selectate'}`;
      }
      if (submitBtn) {
        submitBtn.textContent = `Adaugă în Plan (${count})`;
      }
      if (selectAllBtn) {
        const visible = getVisibleItems();
        const allSelected = visible.length > 0 && visible.every(it => selectedMap.has(it.id));
        selectAllBtn.textContent = allSelected ? 'Deselectează tot' : 'Selectează tot';
      }
    };

    const getVisibleItems = () => {
      let baseList = [];
      if (currentFilterTab === 'favorites') {
        baseList = favoritesList;
      } else if (currentFilterTab === 'fruit_veg') {
        baseList = fruitVegList;
      } else if (currentFilterTab === 'sweets') {
        baseList = sweetsList;
      } else if (currentFilterTab === 'recipes') {
        baseList = recipesList;
      } else if (currentFilterTab === 'ingredients') {
        baseList = ingredientsList;
      } else {
        // 'all': show favorites first, then fruitVeg, then sweets, then recipes, then ingredients without duplicates
        const seen = new Set();
        baseList = [];
        favoritesList.forEach(f => {
          seen.add(f.id);
          baseList.push(f);
        });
        fruitVegList.forEach(fv => {
          if (!seen.has(fv.id)) {
            seen.add(fv.id);
            baseList.push(fv);
          }
        });
        sweetsList.forEach(sw => {
          if (!seen.has(sw.id)) {
            seen.add(sw.id);
            baseList.push(sw);
          }
        });
        recipesList.forEach(r => {
          if (!seen.has(r.id)) {
            seen.add(r.id);
            baseList.push(r);
          }
        });
        ingredientsList.forEach(i => {
          if (!seen.has(i.id)) {
            seen.add(i.id);
            baseList.push(i);
          }
        });
      }

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        return baseList.filter(it => {
          const nameMatch = it.name.toLowerCase().includes(q);
          const catMatch = (it.category || '').toLowerCase().includes(q);
          const fruitVegMatch = (q.includes('fruct') || q.includes('legum')) && isFruitVeg(it);
          const sweetMatch = (q.includes('dulc') || q.includes('desert') || q.includes('snack') || q.includes('ciocolat')) && isSweet(it);
          return nameMatch || catMatch || fruitVegMatch || sweetMatch;
        });
      }
      return baseList;
    };

    const renderList = () => {
      if (!container) return;
      const visible = getVisibleItems();

      if (visible.length === 0) {
        container.innerHTML = `
          <div class="text-center py-10 text-slate-400 dark:text-slate-500 space-y-2">
            <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto text-slate-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <p class="text-xs font-semibold">Niciun aliment sau rețetă găsită pentru acest filtru.</p>
          </div>
        `;
        return;
      }

      // Header banner for specific tabs
      let bannerHtml = '';
      if (currentFilterTab === 'favorites') {
        bannerHtml = `
          <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2 mb-1">
            <span>⭐</span>
            <span class="font-bold">Mesele și gustările cele mai frecvente pentru ${meal} în ultimele 2 săptămâni</span>
          </div>
        `;
      } else if (currentFilterTab === 'fruit_veg') {
        bannerHtml = `
          <div class="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 mb-1">
            <span>🍓</span>
            <span class="font-bold">Legume & Fructe proaspete ideale pentru gustări (Snack) sau preparate</span>
          </div>
        `;
      } else if (currentFilterTab === 'sweets') {
        bannerHtml = `
          <div class="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-800 dark:text-pink-300 text-xs flex items-center gap-2 mb-1">
            <span>🍫</span>
            <span class="font-bold">Dulciuri, deserturi și gustări dulci</span>
          </div>
        `;
      }

      container.innerHTML = `
        ${bannerHtml}

        <div class="space-y-2">
          ${visible.map(it => {
            const isSelected = selectedMap.has(it.id);
            const servings = servingsMap.get(it.id) || 1.0;

            let badgeHtml = '';
            if (it.category === 'Legume & Fructe' || isFruitVeg(it)) {
              badgeHtml = `<span class="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex-shrink-0">🍓 Legume & Fructe</span>`;
            } else if (it.category === 'Dulciuri' || isSweet(it)) {
              badgeHtml = `<span class="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-pink-500/15 text-pink-700 dark:text-pink-300 flex-shrink-0">🍫 Dulciuri</span>`;
            } else if (it.isIngredient) {
              badgeHtml = `<span class="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex-shrink-0">Aliment</span>`;
            } else {
              badgeHtml = `<span class="px-1.5 py-0.5 rounded-md text-[9.5px] font-bold bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex-shrink-0">Rețetă</span>`;
            }

            return `
              <div class="p-3 rounded-2xl border transition shadow-2xs cursor-pointer flex items-center justify-between gap-3 ${
                isSelected
                  ? 'border-[#6D4AE8] bg-[#6D4AE8]/10 dark:bg-[#6D4AE8]/15 ring-2 ring-[#6D4AE8]/20'
                  : 'bg-[#FAF9FD] dark:bg-white/5 border-[#E5E0F5] dark:border-white/10 hover:bg-white dark:hover:bg-white/10'
              }" data-meal-card-id="${it.id}">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <!-- Custom Checkbox -->
                  <input type="checkbox" data-meal-cb="${it.id}" ${isSelected ? 'checked' : ''} class="w-4.5 h-4.5 rounded-md border-slate-300 text-[#6D4AE8] focus:ring-[#6D4AE8] flex-shrink-0 cursor-pointer">
                  
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">${it.name}</span>
                      ${it.isFavorite ? `
                        <span class="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 flex-shrink-0">
                          ⭐ Favorit (${it.count}×)
                        </span>
                      ` : ''}
                      ${badgeHtml}
                    </div>

                    <!-- Single line macros -->
                    <div class="flex items-center gap-1 sm:gap-1.5 mt-1 text-[10px] sm:text-[10.5px] text-slate-500 dark:text-slate-400 whitespace-nowrap overflow-hidden">
                      <span class="font-black text-[#218352] dark:text-[#70D6A3]">${it.cost.toFixed(2)} lei</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="font-bold text-slate-800 dark:text-slate-200">${Math.round(it.calories)} kcal</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="text-[#E02868] dark:text-[#FFA4CD] font-bold">${it.protein.toFixed(1)}g P</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="text-[#D97706] dark:text-[#FFC480] font-bold">${it.carbs.toFixed(1)}g C</span>
                      <span class="text-slate-300 dark:text-slate-600">•</span>
                      <span class="text-[#0284C7] dark:text-[#98DDFE] font-bold">${it.fat.toFixed(1)}g G</span>
                    </div>
                  </div>
                </div>

                <!-- Right Side: Servings / Grams Stepper & Quick Add Button -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <div class="flex items-center bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-xl p-0.5 shadow-2xs" onclick="event.stopPropagation()">
                    <button type="button" data-meal-minus="${it.id}" data-is-ing="${it.isIngredient ? 'true' : 'false'}" class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition" title="${it.isIngredient ? 'Scade 10g' : 'Scade 0.5 porții'}">−</button>
                    <div class="flex items-center px-1">
                      <input type="number" step="${it.isIngredient ? '1' : '0.5'}" min="${it.isIngredient ? '1' : '0.1'}" data-meal-servings-input="${it.id}" data-is-ing="${it.isIngredient ? 'true' : 'false'}" value="${it.isIngredient ? Math.round(servings * 100) : servings}" class="w-12 text-center text-xs font-extrabold text-slate-900 dark:text-white bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-lilac rounded py-0.5" title="${it.isIngredient ? 'Introdu gramajul manual (ex: 60, 75, 120)' : 'Număr porții'}">
                      <span class="text-[10px] text-slate-400 dark:text-white/40 font-bold ml-0.5 pointer-events-none">${it.isIngredient ? 'g' : 'p'}</span>
                    </div>
                    <button type="button" data-meal-plus="${it.id}" data-is-ing="${it.isIngredient ? 'true' : 'false'}" class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition" title="${it.isIngredient ? 'Crește 10g' : 'Crește 0.5 porții'}">+</button>
                  </div>

                  <button type="button" data-meal-quick-add="${it.id}" class="p-1.5 rounded-xl text-slate-400 hover:text-[#6D4AE8] hover:bg-brand-lilac/10 transition" title="Adaugă instant">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      bindCardEvents();
    };

    const toggleItemSelection = (id) => {
      const allItems = [...favoritesList, ...fruitVegList, ...sweetsList, ...recipesList, ...ingredientsList];
      const target = allItems.find(x => x.id === id);
      if (!target) return;

      if (selectedMap.has(id)) {
        selectedMap.delete(id);
      } else {
        const servings = servingsMap.get(id) || 1.0;
        selectedMap.set(id, {
          id: target.id,
          recipeId: target.id,
          name: target.name,
          servings,
          isIngredient: !!target.isIngredient
        });
      }

      updateFooterCounter();
      renderList();
    };

    const bindCardEvents = () => {
      // Card click toggles selection
      container?.querySelectorAll('[data-meal-card-id]').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('input[type="checkbox"]') || e.target.closest('input[type="number"]')) return;
          const id = card.getAttribute('data-meal-card-id');
          toggleItemSelection(id);
        });
      });

      // Checkbox click
      container?.querySelectorAll('[data-meal-cb]').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-meal-cb');
          toggleItemSelection(id);
        });
      });

      // Manual input change for portions / grams
      container?.querySelectorAll('[data-meal-servings-input]').forEach(input => {
        const handleUpdate = () => {
          const id = input.getAttribute('data-meal-servings-input');
          const isIng = input.getAttribute('data-is-ing') === 'true';
          const val = parseFloat(input.value);
          if (isNaN(val) || val <= 0) return;
          const updatedServings = isIng ? Math.max(0.01, val / 100) : Math.max(0.1, val);
          servingsMap.set(id, updatedServings);
          if (selectedMap.has(id)) {
            selectedMap.get(id).servings = updatedServings;
          }

          // Live update macro numbers and cost on this card
          const allItems = [...favoritesList, ...fruitVegList, ...sweetsList, ...recipesList, ...ingredientsList];
          const target = allItems.find(x => x.id === id);
          if (target) {
            const card = container.querySelector(`[data-meal-card-id="${id}"]`);
            const macroRow = card?.querySelector('.whitespace-nowrap.overflow-hidden');
            if (macroRow) {
              const cost = target.cost * updatedServings;
              const cals = target.calories * updatedServings;
              const prot = target.protein * updatedServings;
              const carbs = target.carbs * updatedServings;
              const fat = target.fat * updatedServings;
              macroRow.innerHTML = `
                <span class="font-black text-[#218352] dark:text-[#70D6A3]">${cost.toFixed(2)} lei</span>
                <span class="text-slate-300 dark:text-slate-600">•</span>
                <span class="font-bold text-slate-800 dark:text-slate-200">${Math.round(cals)} kcal</span>
                <span class="text-slate-300 dark:text-slate-600">•</span>
                <span class="text-[#E02868] dark:text-[#FFA4CD] font-bold">${prot.toFixed(1)}g P</span>
                <span class="text-slate-300 dark:text-slate-600">•</span>
                <span class="text-[#D97706] dark:text-[#FFC480] font-bold">${carbs.toFixed(1)}g C</span>
                <span class="text-slate-300 dark:text-slate-600">•</span>
                <span class="text-[#0284C7] dark:text-[#98DDFE] font-bold">${fat.toFixed(1)}g G</span>
              `;
            }
          }
        };

        input.addEventListener('click', (e) => e.stopPropagation());
        input.addEventListener('input', handleUpdate);
        input.addEventListener('change', handleUpdate);
      });

      // Portion minus
      container?.querySelectorAll('[data-meal-minus]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-meal-minus');
          const isIng = btn.getAttribute('data-is-ing') === 'true';
          const cur = servingsMap.get(id) || 1.0;
          let updated;
          if (isIng) {
            const curGrams = Math.round(cur * 100);
            const newGrams = Math.max(5, curGrams - 10);
            updated = newGrams / 100;
          } else {
            updated = Math.max(0.5, Math.round((cur - 0.5) * 10) / 10);
          }
          servingsMap.set(id, updated);
          if (selectedMap.has(id)) {
            selectedMap.get(id).servings = updated;
          }
          const inputEl = container.querySelector(`[data-meal-servings-input="${id}"]`);
          if (inputEl) {
            inputEl.value = isIng ? Math.round(updated * 100) : updated;
            inputEl.dispatchEvent(new Event('input'));
          }
        });
      });

      // Portion plus
      container?.querySelectorAll('[data-meal-plus]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-meal-plus');
          const isIng = btn.getAttribute('data-is-ing') === 'true';
          const cur = servingsMap.get(id) || 1.0;
          let updated;
          if (isIng) {
            const curGrams = Math.round(cur * 100);
            const newGrams = curGrams + 10;
            updated = newGrams / 100;
          } else {
            updated = Math.round((cur + 0.5) * 10) / 10;
          }
          servingsMap.set(id, updated);
          if (selectedMap.has(id)) {
            selectedMap.get(id).servings = updated;
          }
          const inputEl = container.querySelector(`[data-meal-servings-input="${id}"]`);
          if (inputEl) {
            inputEl.value = isIng ? Math.round(updated * 100) : updated;
            inputEl.dispatchEvent(new Event('input'));
          }
        });
      });

      // Quick add button: adds single item immediately
      container?.querySelectorAll('[data-meal-quick-add]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-meal-quick-add');
          const allItems = [...favoritesList, ...fruitVegList, ...sweetsList, ...recipesList, ...ingredientsList];
          const target = allItems.find(x => x.id === id);
          if (!target) return;
          const s = servingsMap.get(id) || 1.0;
          window.store.addPlanItem(day, meal, target.id, s, !!target.isIngredient);
          this.closeModal();
          this.showToast(`"${target.name}" a fost adăugat la ${meal}!`, 'success');
        });
      });
    };

    // Filter tabs click
    document.querySelectorAll('[data-meal-modal-tab]').forEach(tabBtn => {
      tabBtn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-meal-modal-tab');
        currentFilterTab = tab;

        document.querySelectorAll('[data-meal-modal-tab]').forEach(b => {
          const isAct = b.getAttribute('data-meal-modal-tab') === tab;
          b.className = `px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
            isAct
              ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs'
              : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:border-brand-lilac'
          }`;
        });

        renderList();
      });
    });

    // Search input
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderList();
    });

    // Select all visible items button
    selectAllBtn?.addEventListener('click', () => {
      const visible = getVisibleItems();
      const allSelected = visible.length > 0 && visible.every(it => selectedMap.has(it.id));

      visible.forEach(it => {
        if (allSelected) {
          selectedMap.delete(it.id);
        } else {
          const s = servingsMap.get(it.id) || 1.0;
          selectedMap.set(it.id, {
            id: it.id,
            recipeId: it.id,
            name: it.name,
            servings: s,
            isIngredient: !!it.isIngredient
          });
        }
      });

      updateFooterCounter();
      renderList();
    });

    // Submit batch add
    submitBtn?.addEventListener('click', () => {
      if (selectedMap.size === 0) {
        this.showToast('Bifează cel puțin un preparat sau aliment pentru a-l adăuga în plan.', 'warning');
        return;
      }

      const itemsToAdd = Array.from(selectedMap.values());
      window.store.addPlanItems(day, meal, itemsToAdd);
      this.closeModal();
      this.showToast(`Succes! S-au adăugat ${itemsToAdd.length} preparate la ${meal}.`, 'success');
    });

    // Initial render
    renderList();
    updateFooterCounter();
  }

  // --- Modal: Recipe Details & Full Spreadsheet Breakdown ---
  openRecipeDetailsModal(recipeId) {
    const raw = window.store.getRecipeById(recipeId);
    if (!raw) return;
    const r = window.store.calculateRecipe(raw);

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-start justify-between bg-white dark:bg-[#181924]">
        <div>
          <span class="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-brand-lilac/20 text-brand-dark dark:text-brand-lilac">${r.category}</span>
          <h2 class="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-white mt-1.5">${r.name}</h2>
          <div class="text-xs text-slate-500 dark:text-white/60">${r.servings} porții • Greutate totală: ${Math.round(r.totals.weight)}g</div>
        </div>
        <div class="flex items-center gap-1.5">
          <button data-recipe-delete-from-modal="${r.id}" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition" title="Șterge rețeta">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
          <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
        <!-- Recipe Overview Cards (Bento Macro Cards) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-center">
          <div class="bg-emerald-50 dark:bg-emerald-500/10 p-3 sm:p-3.5 rounded-2xl border border-emerald-200/50 dark:border-emerald-500/20">
            <div class="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Preț / Porție</div>
            <div class="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">${r.perServing.cost.toFixed(2)} RON</div>
            <div class="text-[10px] text-emerald-600 dark:text-emerald-300/70 mt-0.5">Total: ${r.totals.cost.toFixed(2)} RON</div>
          </div>
          <div class="bg-brand-lilac/15 dark:bg-brand-lilac/10 p-3 sm:p-3.5 rounded-2xl border border-brand-lilac/30">
            <div class="text-[11px] font-bold text-brand-dark dark:text-brand-lilac">Calorii / Porție</div>
            <div class="text-base sm:text-lg font-black text-brand-dark dark:text-white mt-0.5">${Math.round(r.perServing.calories)} <span class="text-xs font-normal">kcal</span></div>
            <div class="text-[10px] text-slate-500 dark:text-white/60 mt-0.5">Total: ${Math.round(r.totals.calories)} kcal</div>
          </div>
          <div class="bg-brand-pink/15 dark:bg-brand-pink/10 p-3 sm:p-3.5 rounded-2xl border border-brand-pink/30">
            <div class="text-[11px] font-bold text-rose-700 dark:text-brand-pink">Proteine / Porție</div>
            <div class="text-base sm:text-lg font-black text-rose-600 dark:text-brand-pink mt-0.5">${r.perServing.protein.toFixed(1)}g</div>
            <div class="text-[10px] text-rose-500 dark:text-brand-pink/70 mt-0.5">${Math.round(r.macroShare.protein)}% calorii</div>
          </div>
          <div class="bg-brand-apricot/15 dark:bg-brand-apricot/10 p-3 sm:p-3.5 rounded-2xl border border-brand-apricot/30">
            <div class="text-[11px] font-bold text-amber-800 dark:text-brand-apricot">Carbi & Grăsimi</div>
            <div class="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white mt-1 whitespace-nowrap">${r.perServing.carbs.toFixed(1)}g C • ${r.perServing.fat.toFixed(1)}g G</div>
            <div class="text-[10px] text-slate-500 dark:text-white/60 whitespace-nowrap mt-0.5">${Math.round(r.macroShare.carbs)}% C • ${Math.round(r.macroShare.fat)}% G</div>
          </div>
        </div>

        <!-- Recipe Ingredients Composition: Mobile Cards (sm:hidden) & Desktop Table (hidden sm:block) -->
        <div>
          <h4 class="text-xs font-extrabold text-slate-700 dark:text-white/80 uppercase tracking-wider mb-2.5">Compoziție Ingrediente & Costuri</h4>
          
          <!-- Mobile List Cards (Zero horizontal scroll needed) -->
          <div class="sm:hidden space-y-2">
            ${r.ingredients.map(ing => `
              <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 space-y-1.5 shadow-2xs">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">${ing.name}</span>
                  <span class="font-black text-xs text-[#218352] dark:text-[#70D6A3] whitespace-nowrap">${ing.cost.toFixed(2)} RON</span>
                </div>
                <div class="flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-xs text-slate-600 dark:text-white/70 whitespace-nowrap overflow-hidden">
                  <span class="font-bold text-slate-800 dark:text-white">${ing.quantity}g</span>
                  <span class="text-slate-400">(${ing.pricePer100g.toFixed(2)} lei)</span>
                  <span class="opacity-40">•</span>
                  <span class="font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">${Math.round(ing.calories)} kcal</span>
                  <span class="opacity-40">•</span>
                  <span class="text-rose-500 font-bold">${ing.protein.toFixed(1)}g P</span>
                  <span class="opacity-40">•</span>
                  <span class="text-amber-500 font-bold">${ing.carbs.toFixed(1)}g C</span>
                  <span class="opacity-40">•</span>
                  <span class="text-sky-500 font-bold">${ing.fat.toFixed(1)}g G</span>
                </div>
              </div>
            `).join('')}

            <!-- Mobile Totals Card -->
            <div class="p-3 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-2xl border border-emerald-500/20 space-y-1 mt-2.5">
              <div class="flex justify-between text-xs font-bold text-slate-700 dark:text-white/80">
                <span>TOTAL REȚETĂ (${Math.round(r.totals.weight)}g)</span>
                <span class="font-black text-[#218352] dark:text-[#70D6A3]">${r.totals.cost.toFixed(2)} RON</span>
              </div>
              <div class="flex justify-between text-xs font-black text-emerald-800 dark:text-emerald-300 pt-1 border-t border-emerald-500/20">
                <span>PER PORȚIE (${r.servings} porții • ${Math.round(r.perServing.weight)}g)</span>
                <span>${r.perServing.cost.toFixed(2)} RON</span>
              </div>
            </div>
          </div>

          <!-- Desktop Table (Preserved with all 9 columns for wide screens) -->
          <div class="hidden sm:block overflow-x-auto border border-[#E5E0F5] dark:border-white/10 rounded-2xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-[#F4F3FA] dark:bg-white/5 border-b border-[#E5E0F5] dark:border-white/10 text-slate-600 dark:text-white/70">
                  <th class="py-2.5 px-3 font-bold">Ingredient</th>
                  <th class="py-2.5 px-2 font-bold">Cantitate</th>
                  <th class="py-2.5 px-2 font-bold">Preț / 100g</th>
                  <th class="py-2.5 px-2 font-bold text-emerald-600 dark:text-emerald-400">Cost Total</th>
                  <th class="py-2.5 px-2 font-bold">Calorii</th>
                  <th class="py-2.5 px-2 font-bold text-rose-500">P</th>
                  <th class="py-2.5 px-2 font-bold text-amber-500">C</th>
                  <th class="py-2.5 px-2 font-bold text-sky-500">G</th>
                  <th class="py-2.5 px-2 font-bold text-right">Pondere</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E5E0F5] dark:divide-white/5">
                ${r.ingredients.map(ing => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition">
                    <td class="py-2.5 px-3 font-semibold text-slate-800 dark:text-white">${ing.name}</td>
                    <td class="py-2.5 px-2 text-slate-600 dark:text-white/70">${ing.quantity}g</td>
                    <td class="py-2.5 px-2 text-slate-600 dark:text-white/70">${ing.pricePer100g.toFixed(2)} lei</td>
                    <td class="py-2.5 px-2 font-bold text-emerald-600 dark:text-emerald-400">${ing.cost.toFixed(2)} RON</td>
                    <td class="py-2.5 px-2 text-slate-700 dark:text-white/80">${Math.round(ing.calories)}</td>
                    <td class="py-2.5 px-2 text-rose-500 font-semibold">${ing.protein.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-amber-500 font-semibold">${ing.carbs.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-sky-500 font-semibold">${ing.fat.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-right font-medium text-slate-500 dark:text-white/50">${ing.costShare.toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-slate-100 dark:bg-white/10 font-bold border-t-2 border-[#E5E0F5] dark:border-white/10 text-slate-800 dark:text-white">
                  <td class="py-2.5 px-3">TOTAL REȚETĂ</td>
                  <td class="py-2.5 px-2">${Math.round(r.totals.weight)}g</td>
                  <td class="py-2.5 px-2">-</td>
                  <td class="py-2.5 px-2 text-emerald-600 dark:text-emerald-400">${r.totals.cost.toFixed(2)} RON</td>
                  <td class="py-2.5 px-2">${Math.round(r.totals.calories)}</td>
                  <td class="py-2.5 px-2 text-rose-500">${r.totals.protein.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-amber-500">${r.totals.carbs.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-sky-500">${r.totals.fat.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-right">100%</td>
                </tr>
                <tr class="bg-emerald-500/10 dark:bg-emerald-500/20 font-extrabold text-emerald-800 dark:text-emerald-300 border-t border-emerald-200 dark:border-emerald-500/30">
                  <td class="py-2.5 px-3">PER PORȚIE (${r.servings})</td>
                  <td class="py-2.5 px-2">${Math.round(r.perServing.weight)}g</td>
                  <td class="py-2.5 px-2">-</td>
                  <td class="py-2.5 px-2 text-emerald-600 dark:text-emerald-400">${r.perServing.cost.toFixed(2)} RON</td>
                  <td class="py-2.5 px-2">${Math.round(r.perServing.calories)}</td>
                  <td class="py-2.5 px-2 text-rose-500">${r.perServing.protein.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-amber-500">${r.perServing.carbs.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-sky-500">${r.perServing.fat.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- Fixed Footer: Symmetrical 3-Column Single Row -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924]">
        <div class="grid grid-cols-3 gap-2 w-full">
          <button data-recipe-copy-from-modal="${r.id}" class="w-full py-2.5 px-1 text-center rounded-2xl border border-brand-lilac/40 text-xs font-bold text-[#6D4AE8] dark:text-[#C4B5FD] hover:bg-brand-lilac/10 transition truncate flex items-center justify-center gap-1" title="Copiază această rețetă pe un profil">
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            <span class="truncate">Copiază</span>
          </button>
          <button data-recipe-edit-from-modal="${r.id}" class="w-full py-2.5 px-1 text-center rounded-2xl bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-bold hover:opacity-95 transition truncate flex items-center justify-center gap-1" title="Editează rețeta">
            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span class="truncate">Editează</span>
          </button>
          <button data-modal-close="true" class="w-full py-2.5 px-1 text-center rounded-2xl border border-[#E5E0F5] dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition truncate">
            Închide
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    document.querySelector('[data-recipe-copy-from-modal]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-recipe-copy-from-modal');
      this.openCopyRecipeModal(id);
    });

    document.querySelector('[data-recipe-edit-from-modal]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-recipe-edit-from-modal');
      const rec = window.store.getRecipeById(id);
      if (rec) {
        this.openRecipeBuilderModal(rec);
      }
    });

    document.querySelector('[data-recipe-delete-from-modal]')?.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-recipe-delete-from-modal');
      const raw = window.store.getRecipeById(id);
      this.showConfirmModal({
        title: 'Șterge Rețeta',
        message: `Ești sigur că vrei să ștergi definitiv rețeta "${raw?.name}"? Această acțiune nu poate fi anulată.`,
        confirmText: 'Șterge rețeta',
        isDanger: true,
        onConfirm: () => {
          window.store.deleteRecipe(id);
          this.closeModal();
          this.renderCurrentView();
          this.showToast(`Rețeta "${raw?.name}" a fost ștearsă.`, 'info');
        }
      });
    });
  }

  // --- Modal: Copy Recipe to Profile ---
  openCopyRecipeModal(recipeId) {
    const raw = window.store.getRecipeById(recipeId);
    if (!raw) return;
    const r = window.store.calculateRecipe(raw);
    const profiles = window.store.getProfiles ? window.store.getProfiles() : [];
    const activeProfileId = window.store.data.activeProfileId || profiles[0]?.id || 'prof_default';

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-2xl bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Copiază Rețeta pe un Profil</h3>
            <p class="text-xs text-slate-500 dark:text-white/60">Alege profilul unde dorești să o adaugi și personalizezi</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 sm:p-6 space-y-4">
        <!-- Selected Recipe Summary Card -->
        <div class="p-3.5 bg-slate-50/80 dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 flex items-center justify-between">
          <div>
            <span class="pill-badge pill-badge-translucent text-[10px] mb-1">${r.category}</span>
            <div class="font-extrabold text-sm text-slate-900 dark:text-white">${r.name}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${r.servings} porții • ${r.ingredients.length} ingrediente</div>
          </div>
          <div class="text-right">
            <div class="font-black text-sm text-emerald-600 dark:text-emerald-400">${r.perServing.cost.toFixed(2)} RON</div>
            <div class="text-[10px] text-slate-400">${Math.round(r.perServing.calories)} kcal / p</div>
          </div>
        </div>

        <!-- Target Profile Selector -->
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Profilul pe care dorești să copiezi rețeta:</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2" id="copy-profile-list">
            ${profiles.map(p => {
              const isSelected = p.id === activeProfileId;
              return `
                <label class="flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition copy-prof-option ${
                  isSelected 
                    ? 'border-[#6D4AE8] bg-brand-lilac/10 text-slate-900 dark:text-white ring-2 ring-[#6D4AE8]/20'
                    : 'border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-white/5 hover:border-brand-lilac/40 text-slate-700 dark:text-slate-300'
                }">
                  <input type="radio" name="copy-target-profile" value="${p.id}" ${isSelected ? 'checked' : ''} class="accent-[#6D4AE8]">
                  <div class="w-7 h-7 rounded-full bg-[#121319] dark:bg-white text-white dark:text-[#121319] font-black text-xs flex items-center justify-center overflow-hidden flex-shrink-0">
                    ${p.photo ? `<img src="${p.photo}" class="w-full h-full object-cover">` : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-extrabold truncate">${p.name}</div>
                    <div class="text-[10px] text-slate-400">${p.calories} kcal/zi ${isSelected ? '• Profil Activ' : ''}</div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <!-- New Recipe Name -->
        <div class="space-y-1">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Nume rețetă pe profilul ales:</label>
          <input type="text" id="copy-recipe-new-name" value="${r.name} (Proprie)" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
        </div>
      </div>

      <!-- Footer with Actions: Symmetrical 3-Column Single Row -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924]">
        <div class="grid grid-cols-3 gap-2 w-full">
          <button data-modal-close="true" class="w-full py-2.5 px-1 text-center rounded-2xl border border-[#E5E0F5] dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition truncate">
            Anulează
          </button>
          <button id="btn-copy-just-save" class="w-full py-2.5 px-1 text-center rounded-2xl border border-brand-lilac/40 text-xs font-bold text-[#6D4AE8] dark:text-[#C4B5FD] hover:bg-brand-lilac/10 transition truncate">
            Doar Copiază
          </button>
          <button id="btn-copy-and-edit" class="w-full py-2.5 px-1.5 text-center rounded-2xl bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-black shadow-sm hover:opacity-95 transition whitespace-nowrap">
            Copiază & Editează
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    // Dynamic style update on radio change
    document.querySelectorAll('input[name="copy-target-profile"]').forEach(radio => {
      radio.addEventListener('change', () => {
        document.querySelectorAll('.copy-prof-option').forEach(opt => {
          const isChk = opt.querySelector('input')?.checked;
          if (isChk) {
            opt.className = 'flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition copy-prof-option border-[#6D4AE8] bg-brand-lilac/10 text-slate-900 dark:text-white ring-2 ring-[#6D4AE8]/20';
          } else {
            opt.className = 'flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer transition copy-prof-option border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-white/5 hover:border-brand-lilac/40 text-slate-700 dark:text-slate-300';
          }
        });
      });
    });

    document.getElementById('btn-copy-and-edit')?.addEventListener('click', () => {
      const targetProf = document.querySelector('input[name="copy-target-profile"]:checked')?.value || activeProfileId;
      const customName = document.getElementById('copy-recipe-new-name')?.value.trim() || `${r.name} (Proprie)`;
      const cloned = window.store.cloneRecipeToCustom(recipeId, targetProf, customName);
      if (cloned) {
        window.store.setActiveProfile(targetProf);
        this.recipeMainTab = 'proprii';
        localStorage.setItem('nutri_recipe_tab', 'proprii');
        this.updateHeaderProfile();
        this.renderCurrentView();
        this.openRecipeBuilderModal(cloned);
        this.showToast(`Rețeta a fost copiată pe profilul ales! O poți edita acum.`, 'success');
      }
    });

    document.getElementById('btn-copy-just-save')?.addEventListener('click', () => {
      const targetProf = document.querySelector('input[name="copy-target-profile"]:checked')?.value || activeProfileId;
      const customName = document.getElementById('copy-recipe-new-name')?.value.trim() || `${r.name} (Proprie)`;
      const cloned = window.store.cloneRecipeToCustom(recipeId, targetProf, customName);
      if (cloned) {
        window.store.setActiveProfile(targetProf);
        this.recipeMainTab = 'proprii';
        localStorage.setItem('nutri_recipe_tab', 'proprii');
        this.updateHeaderProfile();
        this.closeModal();
        this.renderCurrentView();
        this.showToast(`Rețeta "${cloned.name}" a fost adăugată în secțiunea Proprii!`, 'success');
      }
    });
  }

  // --- Modal: Recipe Builder (Create / Edit) ---
  openRecipeBuilderModal(existingRecipe = null) {
    const isEdit = !!existingRecipe;
    const allIngredients = window.store.getIngredients();
    const categories = window.INITIAL_DATA.recipeCategories?.filter(c => c !== 'Toate') || ['Mese Mari', 'Snacks / Mic Dejun'];
    const profiles = window.store.getProfiles ? window.store.getProfiles() : [];
    const activeProfileId = window.store.data.activeProfileId || profiles[0]?.id || 'prof_default';

    // Temporary list of recipe ingredients
    let curIngredients = existingRecipe
      ? JSON.parse(JSON.stringify(existingRecipe.ingredients || []))
      : [
          { ingredientId: allIngredients[0]?.id || '', name: allIngredients[0]?.name || '', quantity: 200 }
        ];

    // Auto-match ingredients by name if ingredientId is missing or invalid in DB
    curIngredients.forEach(item => {
      if (!item.ingredientId || !allIngredients.some(i => i.id === item.ingredientId)) {
        const itemLower = (item.name || '').toLowerCase().trim();
        const matched = allIngredients.find(i => i.name.toLowerCase().trim() === itemLower) ||
                        allIngredients.find(i => i.name.toLowerCase().includes(itemLower) || itemLower.includes(i.name.toLowerCase()));
        if (matched) {
          item.ingredientId = matched.id;
          item.name = matched.name;
        } else if (allIngredients.length > 0) {
          item.ingredientId = allIngredients[0].id;
        }
      }
    });

    let servings = existingRecipe?.servings || 1;
    const isExistingGeneral = existingRecipe ? !existingRecipe.isCustom : false;
    const assignedProfileId = existingRecipe?.profileId || activeProfileId;

    const renderRows = () => {
      if (curIngredients.length === 0) {
        return `
          <div class="text-center py-6 border-2 border-dashed border-[#E5E0F5] dark:border-white/10 rounded-2xl text-xs text-slate-400 dark:text-white/40">
            Niciun ingredient adăugat. Apasă pe "+ Adaugă" pentru a include ingrediente.
          </div>
        `;
      }

      return curIngredients.map((item, idx) => {
        const ing = allIngredients.find(i => i.id === item.ingredientId) || allIngredients[0];
        const qty = parseFloat(item.quantity) || 0;
        const itemCost = ing ? (ing.pricePer100g * qty) / 100 : 0;
        const itemKcal = ing ? (ing.calories * qty) / 100 : 0;

        return `
          <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 space-y-2">
            <!-- Row 1: Ingredient Select dropdown + Delete Trash Button -->
            <div class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <select data-builder-ing-select="${idx}" class="w-full min-w-0 bg-white dark:bg-[#202230] border border-[#E5E0F5] dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac truncate">
                  ${allIngredients.map(i => `
                    <option value="${i.id}" ${i.id === item.ingredientId ? 'selected' : ''}>
                      ${i.name} (${i.pricePer100g.toFixed(2)} lei/100g)
                    </option>
                  `).join('')}
                </select>
              </div>
              <button type="button" data-builder-ing-remove="${idx}" class="flex-shrink-0 p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition" title="Șterge ingredient">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>

            <!-- Row 2: Grams Input + Live Price & Calorie Preview -->
            <div class="flex items-center justify-between gap-3 pt-0.5">
              <div class="flex items-center gap-2">
                <span class="text-xs text-slate-500 dark:text-white/60 font-semibold">Cantitate:</span>
                <div class="relative w-28">
                  <input type="number" step="5" min="0" data-builder-ing-qty="${idx}" value="${item.quantity}" class="w-full bg-white dark:bg-[#202230] border border-[#E5E0F5] dark:border-white/10 rounded-xl pl-3 pr-7 py-1.5 text-xs font-black text-slate-800 dark:text-white text-left focus:outline-none focus:border-brand-lilac">
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 dark:text-white/40 font-bold pointer-events-none">g</span>
                </div>
              </div>

              <div class="text-right text-xs">
                <span class="font-black text-emerald-600 dark:text-emerald-400">${itemCost.toFixed(2)} RON</span>
                <span class="text-slate-400 dark:text-white/40 text-[11px] ml-1">(${Math.round(itemKcal)} kcal)</span>
              </div>
            </div>
          </div>
        `;
      }).join('');
    };

    const calcTotalCost = () => {
      let totalCost = 0;
      let totalCals = 0;
      curIngredients.forEach(item => {
        const ing = allIngredients.find(i => i.id === item.ingredientId);
        const qty = parseFloat(item.quantity) || 0;
        if (ing) {
          totalCost += (ing.pricePer100g * qty) / 100;
          totalCals += (ing.calories * qty) / 100;
        }
      });
      const s = parseFloat(document.getElementById('recipe-builder-servings')?.value) || 1;
      const perServCost = s > 0 ? totalCost / s : totalCost;
      const perServCals = s > 0 ? totalCals / s : totalCals;
      return { totalCost, totalCals, perServCost, perServCals };
    };

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div>
          <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">${isEdit ? 'Editează Rețeta' : 'Creează Rețetă Nouă'}</h3>
          <p class="text-xs text-slate-500 dark:text-white/60">Configurează ingredientele și gramajele</p>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- Recipe Name -->
        <div class="space-y-1">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Nume Rețetă</label>
          <input type="text" id="recipe-builder-name" value="${existingRecipe?.name || ''}" placeholder="ex: Souvlaki cu Cartofi" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
        </div>

        <!-- 3-Column Grid: Categorie, Număr Porții & Destinație / Profil -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Categorie</label>
            <select id="recipe-builder-cat" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac truncate">
              ${categories.map(c => `
                <option value="${c}" ${existingRecipe?.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Porții</label>
            <div class="flex items-center bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl p-1">
              <button type="button" id="btn-servings-minus" class="w-7 h-7 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-white font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/20 transition shadow-xs active:scale-95 text-xs">-</button>
              <input type="number" step="0.5" min="0.5" id="recipe-builder-servings" value="${servings}" class="w-full text-center font-extrabold text-xs bg-transparent text-slate-800 dark:text-white focus:outline-none">
              <button type="button" id="btn-servings-plus" class="w-7 h-7 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-white font-bold flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/20 transition shadow-xs active:scale-95 text-xs">+</button>
            </div>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Destinație / Profil</label>
            <select id="recipe-builder-profile" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac truncate">
              ${profiles.map(p => `
                <option value="${p.id}" ${(!isExistingGeneral && p.id === assignedProfileId) ? 'selected' : ''}>
                  👤 ${p.name} ${p.id === activeProfileId ? '(Profil Activ)' : ''}
                </option>
              `).join('')}
              <option value="comune" ${isExistingGeneral ? 'selected' : ''}>
                🌐 Rețetă Generală (Comună)
              </option>
            </select>
          </div>
        </div>

        <!-- Ingredients Section Header & Add Button -->
        <div class="space-y-2.5">
          <div class="flex items-center justify-between pt-1">
            <div>
              <span class="text-xs font-extrabold text-slate-700 dark:text-white/80 uppercase tracking-wider">Ingrediente</span>
              <span id="builder-ing-count" class="text-[11px] text-slate-400 dark:text-white/40 ml-1">(${curIngredients.length})</span>
            </div>
            <button type="button" id="btn-builder-add-ing" class="px-3 py-1.5 text-xs font-bold rounded-xl bg-brand-lilac/25 dark:bg-brand-lilac/30 text-brand-dark dark:text-brand-lilac hover:bg-brand-lilac/40 active:scale-95 transition flex items-center gap-1.5 shadow-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
              <span>Adaugă</span>
            </button>
          </div>

          <div id="recipe-builder-rows" class="space-y-2.5">
            ${renderRows()}
          </div>
        </div>
      </div>

      <!-- Fixed Footer with Cost Summary & Actions -->
      <div class="flex-shrink-0 p-3.5 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924] space-y-2.5">
        <!-- Row 1: Full-Width Clean Cost & Calorie Summary (Zero horizontal squeezing or text wrapping) -->
        <div class="flex items-center justify-between px-1 text-xs">
          <span class="text-xs font-bold text-slate-500 dark:text-white/60">Total estimat:</span>
          <div id="builder-total-cost" class="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
            0.00 RON
          </div>
        </div>

        <!-- Row 2: Action Buttons in a Single Symmetrical, Balanced Row -->
        <div class="flex items-center gap-2 w-full">
          ${isEdit ? `
            <button type="button" id="btn-builder-delete" class="w-10 h-10 flex-shrink-0 flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-500 border border-rose-200 dark:border-rose-500/30 rounded-2xl transition shadow-2xs" title="Șterge definitiv rețeta">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          ` : ''}

          <button data-modal-close="true" class="flex-1 py-2.5 px-2 text-center rounded-2xl border border-[#E5E0F5] dark:border-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition truncate">
            Anulează
          </button>

          ${(isEdit && isExistingGeneral) ? `
            <button type="button" id="btn-builder-save-as-custom" class="flex-1 py-2.5 px-2 text-center rounded-2xl border border-brand-lilac/40 text-xs font-bold text-[#6D4AE8] dark:text-[#C4B5FD] hover:bg-brand-lilac/10 transition truncate" title="Salvează ca o copie proprie pe profil">
              Copiază
            </button>
          ` : ''}

          <button id="btn-builder-save" class="flex-1 py-2.5 px-2 text-center rounded-2xl bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-black shadow-sm hover:opacity-95 transition truncate">
            ${isEdit ? 'Salvează' : 'Creează Rețeta'}
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    const updateTotalsDisplay = () => {
      const { totalCost, perServCost, perServCals } = calcTotalCost();
      const costEl = document.getElementById('builder-total-cost');
      if (costEl) {
        costEl.innerHTML = `${totalCost.toFixed(2)} RON <span class="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-white/50">(${perServCost.toFixed(2)}/p • ${Math.round(perServCals)} kcal)</span>`;
      }
      const countEl = document.getElementById('builder-ing-count');
      if (countEl) {
        countEl.textContent = `(${curIngredients.length})`;
      }
    };

    const refreshRows = () => {
      const container = document.getElementById('recipe-builder-rows');
      if (container) {
        container.innerHTML = renderRows();
        bindRowHandlers();
        updateTotalsDisplay();
      }
    };

    const bindRowHandlers = () => {
      document.querySelectorAll('[data-builder-ing-select]').forEach(el => {
        el.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-builder-ing-select'), 10);
          const ingId = e.target.value;
          const ing = window.store.getIngredientById(ingId);
          if (curIngredients[idx] && ing) {
            curIngredients[idx].ingredientId = ing.id;
            curIngredients[idx].name = ing.name;
            refreshRows();
          }
        });
      });

      document.querySelectorAll('[data-builder-ing-qty]').forEach(el => {
        el.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-builder-ing-qty'), 10);
          if (curIngredients[idx]) {
            curIngredients[idx].quantity = parseFloat(e.target.value) || 0;
            const ing = allIngredients.find(i => i.id === curIngredients[idx].ingredientId);
            const parentCard = e.target.closest('.space-y-2');
            if (parentCard && ing) {
              const qty = curIngredients[idx].quantity;
              const cost = (ing.pricePer100g * qty) / 100;
              const kcal = (ing.calories * qty) / 100;
              const costDisplay = parentCard.querySelector('.text-right.text-xs');
              if (costDisplay) {
                costDisplay.innerHTML = `<span class="font-black text-emerald-600 dark:text-emerald-400">${cost.toFixed(2)} RON</span><span class="text-slate-400 dark:text-white/40 text-[11px] ml-1">(${Math.round(kcal)} kcal)</span>`;
              }
            }
            updateTotalsDisplay();
          }
        });
      });

      document.querySelectorAll('[data-builder-ing-remove]').forEach(el => {
        el.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-builder-ing-remove'), 10);
          curIngredients.splice(idx, 1);
          refreshRows();
        });
      });
    };

    bindRowHandlers();
    updateTotalsDisplay();

    // Servings minus / plus buttons
    const servingsInput = document.getElementById('recipe-builder-servings');
    document.getElementById('btn-servings-minus')?.addEventListener('click', () => {
      let cur = parseFloat(servingsInput?.value) || 1;
      if (cur > 0.5) {
        cur -= 0.5;
        if (servingsInput) servingsInput.value = cur;
        updateTotalsDisplay();
      }
    });

    document.getElementById('btn-servings-plus')?.addEventListener('click', () => {
      let cur = parseFloat(servingsInput?.value) || 1;
      cur += 0.5;
      if (servingsInput) servingsInput.value = cur;
      updateTotalsDisplay();
    });

    servingsInput?.addEventListener('input', updateTotalsDisplay);

    document.getElementById('btn-builder-add-ing')?.addEventListener('click', () => {
      const firstIng = allIngredients[0];
      curIngredients.push({
        ingredientId: firstIng?.id || '',
        name: firstIng?.name || '',
        quantity: 100
      });
      refreshRows();
    });

    document.getElementById('btn-builder-save')?.addEventListener('click', () => {
      const name = document.getElementById('recipe-builder-name')?.value.trim();
      const cat = document.getElementById('recipe-builder-cat')?.value;
      const finalServings = parseFloat(document.getElementById('recipe-builder-servings')?.value) || 1;
      const profVal = document.getElementById('recipe-builder-profile')?.value || 'comune';
      const isCustomRecipe = profVal !== 'comune';
      const selectedProfileId = isCustomRecipe ? profVal : null;

      if (!name) {
        this.showToast('Te rugăm să completezi numele rețetei.', 'warning');
        return;
      }
      if (curIngredients.length === 0) {
        this.showToast('Adaugă cel puțin un ingredient în rețetă.', 'warning');
        return;
      }

      if (isEdit) {
        window.store.updateRecipe(existingRecipe.id, {
          name,
          category: cat,
          servings: finalServings,
          ingredients: curIngredients,
          isCustom: isCustomRecipe,
          profileId: selectedProfileId
        });
        if (isCustomRecipe && selectedProfileId) {
          window.store.setActiveProfile(selectedProfileId);
          this.recipeMainTab = 'proprii';
          localStorage.setItem('nutri_recipe_tab', 'proprii');
          this.updateHeaderProfile();
        } else if (!isCustomRecipe) {
          this.recipeMainTab = 'comune';
          localStorage.setItem('nutri_recipe_tab', 'comune');
        }
        this.showToast(`Rețeta "${name}" a fost actualizată!`, 'success');
      } else {
        window.store.addRecipe({
          name,
          category: cat,
          servings: finalServings,
          ingredients: curIngredients,
          isCustom: isCustomRecipe,
          profileId: selectedProfileId
        });
        if (isCustomRecipe && selectedProfileId) {
          window.store.setActiveProfile(selectedProfileId);
          this.recipeMainTab = 'proprii';
          localStorage.setItem('nutri_recipe_tab', 'proprii');
          this.updateHeaderProfile();
        } else {
          this.recipeMainTab = 'comune';
          localStorage.setItem('nutri_recipe_tab', 'comune');
        }
        this.showToast(`Rețeta "${name}" a fost salvată!`, 'success');
      }

      this.closeModal();
      this.renderCurrentView();
    });

    document.getElementById('btn-builder-save-as-custom')?.addEventListener('click', () => {
      const name = document.getElementById('recipe-builder-name')?.value.trim();
      const cat = document.getElementById('recipe-builder-cat')?.value;
      const finalServings = parseFloat(document.getElementById('recipe-builder-servings')?.value) || 1;
      const profVal = document.getElementById('recipe-builder-profile')?.value;
      const targetP = (profVal && profVal !== 'comune') ? profVal : activeProfileId;

      if (!name) {
        this.showToast('Te rugăm să completezi numele rețetei.', 'warning');
        return;
      }
      if (curIngredients.length === 0) {
        this.showToast('Adaugă cel puțin un ingredient în rețetă.', 'warning');
        return;
      }

      const customName = name.includes('(Proprie)') ? name : `${name} (Proprie)`;
      window.store.addRecipe({
        name: customName,
        category: cat,
        servings: finalServings,
        ingredients: curIngredients,
        isCustom: true,
        profileId: targetP
      });
      window.store.setActiveProfile(targetP);
      this.recipeMainTab = 'proprii';
      localStorage.setItem('nutri_recipe_tab', 'proprii');
      this.updateHeaderProfile();
      this.showToast(`Rețeta "${customName}" a fost salvată ca rețetă proprie!`, 'success');
      this.closeModal();
      this.renderCurrentView();
    });

    if (isEdit) {
      document.getElementById('btn-builder-delete')?.addEventListener('click', () => {
        this.showConfirmModal({
          title: 'Șterge Rețeta',
          message: `Ești sigur că vrei să ștergi definitiv rețeta "${existingRecipe.name}"?`,
          confirmText: 'Șterge rețeta',
          isDanger: true,
          onConfirm: () => {
            window.store.deleteRecipe(existingRecipe.id);
            this.closeModal();
            this.renderCurrentView();
            this.showToast(`Rețeta "${existingRecipe.name}" a fost ștearsă.`, 'info');
          }
        });
      });
    }
  }

  // --- Modal: Ingredient Add / Edit ---
  openIngredientModal(existingIng = null) {
    const isEdit = !!existingIng;
    const categories = window.INITIAL_DATA.categories?.filter(c => c !== 'Toate') || ['Ingrediente'];

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">${isEdit ? 'Editează Ingredient' : 'Adaugă Ingredient Nou'}</h3>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div class="space-y-1 sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Nume Ingredient</label>
            <input type="text" id="ing-form-name" value="${existingIng?.name || ''}" placeholder="ex: Piept de pui dezosat" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Categorie</label>
            <select id="ing-form-cat" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac truncate">
              ${categories.map(c => `
                <option value="${c}" ${existingIng?.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Cod Bare EAN (opțional)</label>
            <input type="text" id="ing-form-ean" value="${existingIng?.ean || ''}" placeholder="ex: 5941014001234" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
          </div>
        </div>

        <!-- Package size & price -> Price per 100g -->
        <div class="bg-emerald-500/10 dark:bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/20 space-y-3">
          <div class="text-xs font-extrabold text-emerald-800 dark:text-emerald-300">Preț de Achiziție & Pachet</div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Gramaj Pachet (g/ml)</label>
              <input type="number" step="10" id="ing-form-qty" value="${existingIng?.packageQuantity || 1000}" class="w-full bg-white dark:bg-[#1f2330] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Preț Pachet (RON)</label>
              <input type="number" step="0.1" id="ing-form-price" value="${existingIng?.packagePrice || ''}" placeholder="28.00" class="w-full bg-white dark:bg-[#1f2330] border border-emerald-500/30 rounded-xl px-3 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
            <div class="space-y-1 col-span-2 sm:col-span-1">
              <label class="block text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Preț Calculat / 100g</label>
              <div id="ing-form-calc-100g" class="bg-emerald-500/20 dark:bg-emerald-500/30 rounded-xl py-2 px-2.5 text-center text-xs font-black text-emerald-800 dark:text-emerald-300">
                ${existingIng ? existingIng.pricePer100g.toFixed(2) : '0.00'} RON
              </div>
            </div>
          </div>
        </div>

        <!-- Nutrition per 100g -->
        <div class="space-y-2.5">
          <div class="text-xs font-bold text-slate-700 dark:text-white/80">Valori Nutriționale raportate la 100g:</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="space-y-1">
              <label class="block text-[11px] text-brand-dark dark:text-brand-lilac font-bold">Calorii (kcal)</label>
              <input type="number" step="1" id="ing-form-cals" value="${existingIng?.calories || ''}" placeholder="165" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-rose-500 font-bold">Proteine (g)</label>
              <input type="number" step="0.1" id="ing-form-prot" value="${existingIng?.protein || ''}" placeholder="31.0" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-amber-500 font-bold">Carbohidrați (g)</label>
              <input type="number" step="0.1" id="ing-form-carbs" value="${existingIng?.carbs || '0'}" placeholder="0.0" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-sky-500 font-bold">Grăsimi (g)</label>
              <input type="number" step="0.1" id="ing-form-fat" value="${existingIng?.fat || ''}" placeholder="3.6" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-xl px-2.5 py-2 text-xs font-bold text-center text-slate-800 dark:text-white">
            </div>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-ing-form-save" class="btn-pill btn-pill-primary text-xs">
          ${isEdit ? 'Salvează Modificările' : 'Adaugă Ingredient'}
        </button>
      </div>
    `;

    this.openModal(html);

    // Live calc price per 100g
    const qtyIn = document.getElementById('ing-form-qty');
    const priceIn = document.getElementById('ing-form-price');
    const calcEl = document.getElementById('ing-form-calc-100g');

    const updateCalc = () => {
      const q = parseFloat(qtyIn?.value) || 0;
      const p = parseFloat(priceIn?.value) || 0;
      const res = q > 0 ? (p / q) * 100 : 0;
      if (calcEl) calcEl.textContent = res.toFixed(2) + ' RON';
    };

    qtyIn?.addEventListener('input', updateCalc);
    priceIn?.addEventListener('input', updateCalc);

    document.getElementById('btn-ing-form-save')?.addEventListener('click', () => {
      const name = document.getElementById('ing-form-name')?.value.trim();
      const cat = document.getElementById('ing-form-cat')?.value;
      const ean = document.getElementById('ing-form-ean')?.value.trim();
      const pkgQty = parseFloat(qtyIn?.value) || 100;
      const pkgPrice = parseFloat(priceIn?.value) || 0;
      const calories = parseFloat(document.getElementById('ing-form-cals')?.value) || 0;
      const protein = parseFloat(document.getElementById('ing-form-prot')?.value) || 0;
      const carbs = parseFloat(document.getElementById('ing-form-carbs')?.value) || 0;
      const fat = parseFloat(document.getElementById('ing-form-fat')?.value) || 0;

      if (!name) {
        this.showToast('Te rugăm să completezi numele ingredientului.', 'warning');
        return;
      }

      if (isEdit) {
        window.store.updateIngredient(existingIng.id, {
          name, category: cat, ean, packageQuantity: pkgQty, packagePrice: pkgPrice, calories, protein, carbs, fat
        });
        this.showToast(`Ingredientul "${name}" a fost actualizat!`, 'success');
      } else {
        window.store.addIngredient({
          name, category: cat, ean, packageQuantity: pkgQty, packagePrice: pkgPrice, calories, protein, carbs, fat
        });
        this.showToast(`Ingredientul "${name}" a fost adăugat cu succes!`, 'success');
      }

      this.closeModal();
    });
  }

  // --- Modal: Quick Plan Recipe ---
  openQuickPlanRecipeModal(recipeId) {
    const raw = window.store.getRecipeById(recipeId);
    if (!raw) return;
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const meals = ['Mic Dejun', 'Prânz', 'Snack', 'Cină'];

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="min-w-0 pr-2">
          <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Planifică Rețeta</h3>
          <p class="text-xs text-brand-dark dark:text-brand-lilac font-bold truncate max-w-[240px]">${raw.name}</p>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5">
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Alege Ziua</label>
          <select id="quick-plan-day" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
            ${days.map(d => `<option value="${d}" ${d === this.activeDay ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Alege Masa</label>
          <select id="quick-plan-meal" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
            ${meals.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
        <div class="space-y-1.5">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Număr Porții</label>
          <input type="number" step="0.5" id="quick-plan-servings" value="1.0" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-center text-slate-800 dark:text-white">
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-save-quick-plan" class="btn-pill btn-pill-primary text-xs">
          Adaugă în Planificator
        </button>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-md' });

    document.getElementById('btn-save-quick-plan')?.addEventListener('click', () => {
      const day = document.getElementById('quick-plan-day')?.value;
      const meal = document.getElementById('quick-plan-meal')?.value;
      const servings = parseFloat(document.getElementById('quick-plan-servings')?.value) || 1.0;
      window.store.addPlanItem(day, meal, recipeId, servings);
      this.showToast(`Rețeta "${raw.name}" a fost adăugată la ${meal} pentru ziua de ${day}!`, 'success');
      this.closeModal();
      this.switchTab('planner');
    });
  }

  // --- Modal: Copy Day Plan ---
  openCopyDayModal() {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].filter(d => d !== this.activeDay);

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Copiază Planul Zilei (${this.activeDay})</h3>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
        <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Copiază preparatele în ziua:</label>
        <select id="copy-target-day" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
          ${days.map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-execute-copy-day" class="btn-pill btn-pill-primary text-xs">
          Copiază Planul
        </button>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-md' });

    document.getElementById('btn-execute-copy-day')?.addEventListener('click', () => {
      const target = document.getElementById('copy-target-day')?.value;
      if (target) {
        window.store.copyDayPlan(this.activeDay, target);
        this.showToast(`Planul din ziua de ${this.activeDay} a fost copiat în ${target}!`, 'success');
        this.closeModal();
      }
    });
  }

  // --- Modal: Copy Meal to Another Day / Meal ---
  openCopyMealModal(sourceDay, sourceMeal) {
    const dayData = window.store.calculateDay(sourceDay);
    const mealItems = dayData.items.filter(i => i.meal === sourceMeal);
    if (mealItems.length === 0) {
      this.showToast('Nu există preparate în această masă pentru a fi copiate.', 'warning');
      return;
    }

    const allDays = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const allMeals = [
      { id: 'Mic Dejun', label: 'Mic Dejun' },
      { id: 'Prânz', label: 'Prânz' },
      { id: 'Snack', label: 'Gustare / Snack' },
      { id: 'Cină', label: 'Cină' }
    ];

    const curIdx = allDays.indexOf(sourceDay);
    const defaultTargetDay = curIdx < allDays.length - 1 ? allDays[curIdx + 1] : allDays[0];

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div>
          <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Copiază Masa: ${sourceMeal}</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Din ziua de <span class="font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">${sourceDay}</span> (${mealItems.length} ${mealItems.length === 1 ? 'preparat' : 'preparate'})</p>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- Preview of dishes in source meal -->
        <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 space-y-2">
          <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Preparate incluse:</div>
          <div class="space-y-1.5 max-h-36 overflow-y-auto">
            ${mealItems.map(it => `
              <div class="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-white dark:bg-[#121319] border border-[#E5E0F5] dark:border-white/10">
                <span class="font-bold text-slate-800 dark:text-white truncate">${it.recipeName}</span>
                <span class="text-slate-500 text-[11px] font-medium whitespace-nowrap">${it.isIngredient ? (it.portions * 100) + 'g' : it.portions + ' porții'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Target Day & Target Meal Selection -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Ziua Destinație</label>
            <select id="copy-meal-target-day" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
              ${allDays.map(d => `<option value="${d}" ${d === defaultTargetDay ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Masa Destinație</label>
            <select id="copy-meal-target-meal" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
              ${allMeals.map(m => `<option value="${m.id}" ${m.id === sourceMeal ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Copy Mode: Append vs Overwrite -->
        <div class="space-y-2 pt-1">
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Opțiune copiere</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label class="flex items-center gap-2.5 p-3 rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 cursor-pointer hover:border-brand-lilac transition">
              <input type="radio" name="copy-meal-mode" value="append" checked class="text-[#6D4AE8] focus:ring-[#6D4AE8]">
              <div class="text-xs">
                <div class="font-bold text-slate-800 dark:text-white">Adaugă</div>
                <div class="text-[10.5px] text-slate-500">Păstrează ce există deja</div>
              </div>
            </label>
            <label class="flex items-center gap-2.5 p-3 rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 cursor-pointer hover:border-brand-lilac transition">
              <input type="radio" name="copy-meal-mode" value="overwrite" class="text-[#6D4AE8] focus:ring-[#6D4AE8]">
              <div class="text-xs">
                <div class="font-bold text-slate-800 dark:text-white">Înlocuiește</div>
                <div class="text-[10.5px] text-slate-500">Golește masa destinație</div>
              </div>
            </label>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-execute-copy-meal" class="btn-pill btn-pill-primary text-xs shadow-sm">
          Copiază Masa
        </button>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-md' });

    document.getElementById('btn-execute-copy-meal')?.addEventListener('click', () => {
      const targetDay = document.getElementById('copy-meal-target-day')?.value;
      const targetMeal = document.getElementById('copy-meal-target-meal')?.value;
      const overwrite = document.querySelector('input[name="copy-meal-mode"]:checked')?.value === 'overwrite';

      if (targetDay && targetMeal) {
        window.store.copyMeal(sourceDay, sourceMeal, targetDay, targetMeal, overwrite);
        this.closeModal();
        this.showToast(`Masa "${sourceMeal}" din ${sourceDay} a fost copiată la ${targetMeal} (${targetDay})!`, 'success');
      }
    });
  }

  // --- Modal: Copy Single Plan Item to Another Day / Meal ---
  openCopyPlanItemModal(sourceDay, itemId) {
    const dayData = window.store.calculateDay(sourceDay);
    const item = dayData.items.find(i => i.id === itemId);
    if (!item) return;

    const allDays = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const allMeals = [
      { id: 'Mic Dejun', label: 'Mic Dejun' },
      { id: 'Prânz', label: 'Prânz' },
      { id: 'Snack', label: 'Gustare / Snack' },
      { id: 'Cină', label: 'Cină' }
    ];

    const curIdx = allDays.indexOf(sourceDay);
    const defaultTargetDay = curIdx < allDays.length - 1 ? allDays[curIdx + 1] : allDays[0];

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div>
          <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Copiază Preparatul</h3>
          <p class="text-xs text-[#6D4AE8] dark:text-[#C4B5FD] font-bold mt-0.5 truncate max-w-[240px]">${item.recipeName}</p>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10 flex items-center justify-between text-xs">
          <div>
            <div class="font-extrabold text-slate-900 dark:text-white">${item.recipeName}</div>
            <div class="text-slate-500 text-[11px] mt-0.5">Din ${sourceDay} • ${item.meal}</div>
          </div>
          <span class="font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/10 px-2.5 py-1 rounded-xl border border-[#E5E0F5] dark:border-white/10">
            ${item.isIngredient ? (item.portions * 100) + 'g' : item.portions + ' porții'}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Ziua Destinație</label>
            <select id="copy-item-target-day" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
              ${allDays.map(d => `<option value="${d}" ${d === defaultTargetDay ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Masa Destinație</label>
            <select id="copy-item-target-meal" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac">
              ${allMeals.map(m => `<option value="${m.id}" ${m.id === item.meal ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end gap-2.5 bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
        <button id="btn-execute-copy-plan-item" class="btn-pill btn-pill-primary text-xs shadow-sm">
          Copiază Preparatul
        </button>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-md' });

    document.getElementById('btn-execute-copy-plan-item')?.addEventListener('click', () => {
      const targetDay = document.getElementById('copy-item-target-day')?.value;
      const targetMeal = document.getElementById('copy-item-target-meal')?.value;

      if (targetDay && targetMeal) {
        window.store.copyPlanItem(sourceDay, itemId, targetDay, targetMeal);
        this.closeModal();
        this.showToast(`"${item.recipeName}" a fost copiat la ${targetMeal} (${targetDay})!`, 'success');
      }
    });
  }

  // --- PROFILE MANAGEMENT & POPUP MODAL ---
  updateHeaderProfile() {
    if (!window.store || typeof window.store.getActiveProfile !== 'function') return;
    const profile = window.store.getActiveProfile();
    if (!profile) return;

    const avatarCircle = document.getElementById('header-avatar-circle');
    const nameEl = document.getElementById('header-user-name');
    const subEl = document.getElementById('header-user-sub');

    if (avatarCircle) {
      if (profile.photo && profile.photo.trim() !== '') {
        avatarCircle.innerHTML = `<img src="${profile.photo}" alt="${profile.name}" class="w-full h-full object-cover">`;
      } else {
        const initials = profile.name ? profile.name.trim().slice(0, 2).toUpperCase() : 'NP';
        avatarCircle.innerHTML = `<span class="text-xs sm:text-sm font-black tracking-tight text-white dark:text-[#121319]">${initials}</span>`;
      }
    }

    if (nameEl) {
      nameEl.textContent = `${profile.name || 'Profil'}`;
    }

    if (subEl) {
      if (this.currentTab === 'total') {
        subEl.textContent = 'Vizualizare: Profil Total 📊';
      } else {
        const parts = [];
        if (profile.weight) parts.push(`${profile.weight} kg`);
        if (profile.calories) parts.push(`${Math.round(profile.calories)} kcal`);
        subEl.textContent = parts.length > 0 ? parts.join(' • ') : 'NutriPlanner';
      }
    }
  }

  compressImageToThumbnail(file, maxDimension = 180) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith('image/')) {
        resolve('');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const width = img.naturalWidth || img.width;
          const height = img.naturalHeight || img.height;
          const minDim = Math.min(width, height);
          const sx = (width - minDim) / 2;
          const sy = (height - minDim) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = maxDimension;
          canvas.height = maxDimension;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxDimension, maxDimension);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => resolve('');
        img.src = e.target.result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  createEmojiAvatar(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#EDE9FE';
    ctx.fillRect(0, 0, 160, 160);
    ctx.font = '84px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 80, 86);
    return canvas.toDataURL('image/jpeg', 0.85);
  }

  openProfileModal(mode = 'view', profileId = null) {
    const profiles = window.store.getProfiles();
    const activeProfile = window.store.getActiveProfile();
    const isEdit = mode === 'edit';

    if (mode === 'view') {
      const p = activeProfile;
      const hM = p.height ? (p.height / 100) : null;
      const bmi = (p.weight && hM) ? (p.weight / (hM * hM)).toFixed(1) : null;
      let bmiCategory = 'Optim';
      let bmiColor = 'text-emerald-600 dark:text-emerald-400';
      if (bmi) {
        const b = parseFloat(bmi);
        if (b < 18.5) { bmiCategory = 'Subponderal'; bmiColor = 'text-amber-500'; }
        else if (b < 25) { bmiCategory = 'Normal'; bmiColor = 'text-emerald-500'; }
        else if (b < 30) { bmiCategory = 'Supraponderal'; bmiColor = 'text-amber-500'; }
        else { bmiCategory = 'Obezitate'; bmiColor = 'text-rose-500'; }
      }

      const totalMacroCals = (p.protein * 4) + (p.carbs * 4) + (p.fat * 9);
      const baseCals = totalMacroCals > 0 ? totalMacroCals : (p.calories || 2000);
      const protPct = Math.round((p.protein * 4 / baseCals) * 100);
      const carbsPct = Math.round((p.carbs * 4 / baseCals) * 100);
      const fatPct = Math.round((p.fat * 9 / baseCals) * 100);

      const html = `
        <!-- Fixed Header -->
        <div class="flex-shrink-0 p-3.5 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center font-bold flex-shrink-0">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
            <div class="min-w-0">
              <h3 class="font-extrabold text-sm sm:text-lg text-slate-900 dark:text-white leading-snug truncate">Profiluri & Obiective</h3>
              <p class="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">Comută profilul activ sau configurează datele biometrice</p>
            </div>
          </div>
          <button data-modal-close="true" class="p-1.5 sm:p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition flex-shrink-0 ml-2" title="Închide">
            <svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
          ${this.currentTab === 'total' ? `
            <div class="p-3.5 rounded-2xl bg-gradient-to-r from-brand-lilac/25 via-[#6D4AE8]/15 to-brand-pink/20 border-2 border-[#6D4AE8]/40 flex items-center justify-between gap-3 shadow-xs">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl bg-[#6D4AE8] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-2xs">📊</div>
                <div class="min-w-0">
                  <div class="text-xs font-black text-slate-900 dark:text-white truncate">Ești în vizualizarea „Profil Total”</div>
                  <div class="text-[11px] text-slate-600 dark:text-slate-300 truncate">Alege un profil pentru a reveni la planificatorul individual</div>
                </div>
              </div>
              <button id="btn-modal-exit-total" type="button" class="btn-pill btn-pill-dark text-xs !py-1.5 !px-3 font-extrabold flex items-center gap-1.5 whitespace-nowrap shadow-xs cursor-pointer hover:scale-[1.02] transition">
                <span>Planificator</span>
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
              </button>
            </div>
          ` : ''}

          <!-- Active Profile Hero Card -->
          <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-3.5 sm:p-4 rounded-3xl shadow-sm space-y-3">
            <div class="flex items-center justify-between gap-2.5">
              <div class="flex items-center gap-3 min-w-0 flex-1">
                <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-gradient-to-tr from-[#B8A9FD] via-[#FFB259] to-[#FF6FA4] p-0.5 shadow-md flex-shrink-0">
                  <div class="w-full h-full rounded-full bg-[#121319] dark:bg-white flex items-center justify-center overflow-hidden">
                    ${p.photo ? `
                      <img src="${p.photo}" alt="${p.name}" class="w-full h-full object-cover">
                    ` : `
                      <span class="text-base sm:text-lg font-black text-white dark:text-[#121319]">${p.name ? p.name.slice(0, 2).toUpperCase() : 'NP'}</span>
                    `}
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <h4 class="text-base sm:text-lg font-extrabold font-display text-slate-900 dark:text-white truncate">${p.name}</h4>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex-shrink-0">Activ ✓</span>
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                    <span>${p.gender === 'feminin' ? '♀ Feminin' : '♂ Masculin'}</span>
                    <span>•</span>
                    <span class="font-extrabold text-[#6D4AE8] dark:text-[#C4B5FD]">${Math.round(p.calories)} kcal/zi</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-shrink-0">
                <button data-open-profile-plan="${p.id}" class="btn-pill btn-pill-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5 font-bold whitespace-nowrap shadow-xs cursor-pointer hover:scale-[1.02] transition" title="Deschide planificatorul pentru acest profil">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>Deschide Plan</span>
                </button>
                <button id="btn-edit-active-profile" class="btn-pill btn-pill-outline text-xs !py-1.5 !px-2.5 flex items-center gap-1 font-bold flex-shrink-0 whitespace-nowrap shadow-2xs cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10" title="Editează profilul activ">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  <span class="hidden sm:inline">Editează</span>
                </button>
              </div>
            </div>

            <!-- Biometrics & BMI -->
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-white/5 text-center">
              <div class="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                <div class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Greutate</div>
                <div class="text-xs sm:text-base font-extrabold text-slate-800 dark:text-white mt-0.5">${p.weight || '--'} <span class="text-[10px] font-bold text-slate-400">kg</span></div>
              </div>
              <div class="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                <div class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Înălțime</div>
                <div class="text-xs sm:text-base font-extrabold text-slate-800 dark:text-white mt-0.5">${p.height || '--'} <span class="text-[10px] font-bold text-slate-400">cm</span></div>
              </div>
              <div class="p-2 sm:p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                <div class="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Indice BMI</div>
                <div class="text-xs sm:text-base font-extrabold ${bmi ? bmiColor : 'text-slate-800 dark:text-white'} mt-0.5">
                  ${bmi || '--'}
                </div>
                ${bmi ? `<div class="text-[9px] font-bold ${bmiColor}">${bmiCategory}</div>` : ''}
              </div>
            </div>

            <!-- Macro Targets -->
            <div class="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
              <div class="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-white/80">
                <span class="uppercase tracking-wider">Ținte Zilnice Active</span>
                <span class="text-[#6D4AE8] dark:text-[#C4B5FD] font-extrabold">${p.calories} kcal / zi</span>
              </div>
              <div class="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
                <div class="p-1.5 sm:p-2 rounded-2xl bg-purple-50/70 dark:bg-purple-900/15 border border-purple-100 dark:border-purple-800/30">
                  <div class="text-[9px] sm:text-[10px] font-bold text-purple-700 dark:text-purple-300">Calorii</div>
                  <div class="text-xs sm:text-sm font-extrabold text-purple-900 dark:text-purple-100 mt-0.5">${Math.round(p.calories)}</div>
                  <div class="text-[8px] sm:text-[9px] text-purple-400">kcal</div>
                </div>
                <div class="p-1.5 sm:p-2 rounded-2xl bg-rose-50/70 dark:bg-rose-900/15 border border-rose-100 dark:border-rose-800/30">
                  <div class="text-[9px] sm:text-[10px] font-bold text-rose-700 dark:text-rose-300">Proteine</div>
                  <div class="text-xs sm:text-sm font-extrabold text-rose-900 dark:text-rose-100 mt-0.5">${Math.round(p.protein)}g</div>
                  <div class="text-[8px] sm:text-[9px] text-rose-400 font-bold">${protPct}%</div>
                </div>
                <div class="p-1.5 sm:p-2 rounded-2xl bg-amber-50/70 dark:bg-amber-900/15 border border-amber-100 dark:border-amber-800/30">
                  <div class="text-[9px] sm:text-[10px] font-bold text-amber-700 dark:text-amber-300">Carbi</div>
                  <div class="text-xs sm:text-sm font-extrabold text-amber-900 dark:text-amber-100 mt-0.5">${Math.round(p.carbs)}g</div>
                  <div class="text-[8px] sm:text-[9px] text-amber-400 font-bold">${carbsPct}%</div>
                </div>
                <div class="p-1.5 sm:p-2 rounded-2xl bg-sky-50/70 dark:bg-sky-900/15 border border-sky-100 dark:border-sky-800/30">
                  <div class="text-[9px] sm:text-[10px] font-bold text-sky-700 dark:text-sky-300">Grăsimi</div>
                  <div class="text-xs sm:text-sm font-extrabold text-sky-900 dark:text-sky-100 mt-0.5">${Math.round(p.fat)}g</div>
                  <div class="text-[8px] sm:text-[9px] text-sky-400 font-bold">${fatPct}%</div>
                </div>
              </div>

              <!-- Macro Share Bar -->
              <div class="w-full h-2 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10 mt-1">
                <div class="bg-[#FF6FA4]" style="width: ${protPct}%" title="Proteine: ${protPct}%"></div>
                <div class="bg-[#FFB259]" style="width: ${carbsPct}%" title="Carbi: ${carbsPct}%"></div>
                <div class="bg-[#82CBEF]" style="width: ${fatPct}%" title="Grăsimi: ${fatPct}%"></div>
              </div>
            </div>
          </div>

          <!-- All Profiles Switcher List -->
          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Toate Profilurile Tale (${profiles.length})
              </h4>
              <button id="btn-create-new-profile" class="btn-pill btn-pill-primary text-xs !py-1.5 !px-3 flex items-center gap-1.5 font-bold shadow-xs whitespace-nowrap flex-shrink-0">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                <span>Profil Nou</span>
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-2">
              ${profiles.map(item => {
                const isActive = item.id === activeProfile.id;
                return `
                  <div class="p-3 rounded-2xl border ${
                    isActive 
                      ? 'border-[#6D4AE8] bg-[#6D4AE8]/5 dark:bg-[#6D4AE8]/10 ring-1 ring-[#6D4AE8]/30' 
                      : 'border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924] hover:border-slate-300 dark:hover:border-white/20'
                  } flex items-center justify-between gap-2.5 shadow-2xs transition">
                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                      <div class="w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                        ${item.photo ? `
                          <img src="${item.photo}" alt="${item.name}" class="w-full h-full object-cover">
                        ` : `
                          <span class="text-xs font-black text-slate-700 dark:text-white">${item.name ? item.name.slice(0, 2).toUpperCase() : 'NP'}</span>
                        `}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-extrabold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <span class="truncate">${item.name}</span>
                          ${isActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black flex-shrink-0">Activ</span>' : ''}
                        </div>
                        <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          ${item.weight ? item.weight + ' kg • ' : ''}${Math.round(item.calories)} kcal
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1 flex-shrink-0">
                      ${isActive ? `
                        <button data-open-profile-plan="${item.id}" class="btn-pill btn-pill-primary text-[11px] py-1 px-2.5 font-bold shadow-xs cursor-pointer hover:scale-[1.02] transition">
                          Deschide Plan
                        </button>
                      ` : `
                        <button data-switch-profile="${item.id}" class="btn-pill btn-pill-outline text-[11px] py-1 px-2.5 font-bold hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer shadow-2xs">
                          Comută
                        </button>
                      `}
                      <button data-edit-profile="${item.id}" class="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer" title="Editează">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Consolidated Total Profile Shortcut -->
          <div class="p-3.5 bg-gradient-to-r from-brand-lilac/15 via-[#6D4AE8]/10 to-brand-pink/15 rounded-2xl border border-brand-lilac/30 flex items-center justify-between gap-3 shadow-2xs">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-9 h-9 rounded-xl bg-[#6D4AE8] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                  <span>Profil de Total & Costuri</span>
                  <span class="text-[9px] px-1.5 py-0.2 rounded-full bg-[#6D4AE8]/20 text-[#6D4AE8] dark:text-[#C4B5FD] font-black uppercase">Consolidat</span>
                </div>
                <div class="text-[10.5px] text-slate-600 dark:text-slate-300 truncate">
                  Vezi toate rețetele per profil și totalul costurilor calculate
                </div>
              </div>
            </div>
            <button id="btn-open-total-profile-from-modal" type="button" class="btn-pill btn-pill-primary text-xs !py-1.5 !px-3 font-bold whitespace-nowrap shadow-xs flex-shrink-0">
              Deschide 📊
            </button>
          </div>

          <!-- Cloud Sync Card in Profile Modal -->
          <div class="p-3 bg-brand-lilac/10 dark:bg-brand-lilac/15 rounded-2xl border border-brand-lilac/30 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-xl bg-brand-lilac/25 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-extrabold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                  <span>Sincronizare Cloud & Cont</span>
                </div>
                <div class="text-[10.5px] text-slate-500 dark:text-white/60 truncate">
                  ${window.cloudSync?.user ? `Conectat: ${window.cloudSync.user.email || 'Activ'}` : 'Neconectat (date salvate local pe acest dispozitiv)'}
                </div>
              </div>
            </div>
            <button id="btn-profile-open-sync" type="button" class="btn-pill btn-pill-outline text-xs py-1.5 px-3 font-bold border-brand-lilac/40 text-[#6D4AE8] dark:text-[#C4B5FD] hover:bg-brand-lilac/20 flex-shrink-0 whitespace-nowrap cursor-pointer">
              ${window.cloudSync?.user ? 'Setări Sync' : 'Activează'}
            </button>
          </div>
        </div>

        <!-- Fixed Footer -->
        <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-[#181924]">
          <div class="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
            Rețetele proprii se asociază profilului activ
          </div>
          <button data-modal-close="true" class="btn-pill btn-pill-dark text-xs !py-1.5 !px-4 font-bold flex-shrink-0">
            Închide
          </button>
        </div>
      `;

      this.openModal(html, { position: 'center', maxWidth: 'max-w-xl' });

      // Event handlers for view mode
      document.getElementById('btn-open-total-profile-from-modal')?.addEventListener('click', () => {
        this.closeModal();
        this.switchTab('total');
      });

      document.getElementById('btn-edit-active-profile')?.addEventListener('click', () => {
        this.openProfileModal('edit', activeProfile.id);
      });

      document.getElementById('btn-create-new-profile')?.addEventListener('click', () => {
        this.openProfileModal('create');
      });

      document.getElementById('btn-profile-open-sync')?.addEventListener('click', () => {
        this.openCloudSyncModal();
      });

      // Exit total view banner button
      document.getElementById('btn-modal-exit-total')?.addEventListener('click', () => {
        this.closeModal();
        this.switchTab('planner');
      });

      // Open profile plan directly and return to planner
      document.querySelectorAll('[data-open-profile-plan]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-open-profile-plan');
          const switched = window.store.setActiveProfile(id);
          if (switched) {
            this.dailyCalorieTarget = switched.calories;
            this.updateHeaderProfile();
          }
          this.closeModal();
          this.switchTab('planner');
        });
      });

      document.querySelectorAll('[data-switch-profile]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-switch-profile');
          const switched = window.store.setActiveProfile(id);
          if (switched) {
            this.dailyCalorieTarget = switched.calories;
            this.updateHeaderProfile();
            this.showToast(`Profil activ schimbat pe "${switched.name}"!`, 'success');
            // If currently on the consolidated Profil Total view, switch back to planner view!
            if (this.currentTab === 'total') {
              this.closeModal();
              this.switchTab('planner');
            } else {
              this.renderCurrentView();
              this.openProfileModal('view');
            }
          }
        });
      });

      document.querySelectorAll('[data-edit-profile]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const id = e.currentTarget.getAttribute('data-edit-profile');
          this.openProfileModal('edit', id);
        });
      });

      return;
    }

    // CREATE or EDIT mode
    const targetProfile = isEdit ? (profiles.find(p => p.id === profileId) || activeProfile) : null;
    let tempPhoto = targetProfile ? (targetProfile.photo || '') : '';
    let tempGender = targetProfile ? (targetProfile.gender || 'masculin') : 'masculin';

    const defaultCals = targetProfile ? targetProfile.calories : 2000;
    const defaultProt = targetProfile ? targetProfile.protein : 140;
    const defaultCarbs = targetProfile ? targetProfile.carbs : 220;
    const defaultFat = targetProfile ? targetProfile.fat : 65;

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2.5">
          <button id="btn-prof-back-to-view" class="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition" title="Înapoi">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white leading-snug">
              ${isEdit ? `Editează Profil: ${targetProfile.name}` : 'Creează Profil Nou'}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Configurează datele biometrice și necesarul de macronutrienți</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Form Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5">
        <!-- 1. Profile Avatar & Photo Selector -->
        <div class="bg-[#FAF9FD] dark:bg-white/5 p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-3">
          <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Poză de Profil (opțional)</label>
          <div class="flex items-center gap-4">
            <div id="prof-avatar-preview" class="w-16 h-16 rounded-full overflow-hidden bg-slate-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0 border-2 border-brand-lilac/40 shadow-sm">
              ${tempPhoto ? `
                <img src="${tempPhoto}" alt="Avatar" class="w-full h-full object-cover">
              ` : `
                <span id="prof-avatar-fallback-text" class="text-xl font-black text-slate-700 dark:text-white">
                  ${targetProfile?.name ? targetProfile.name.slice(0, 2).toUpperCase() : '👤'}
                </span>
              `}
            </div>
            <div class="space-y-1.5 flex-1 min-w-0">
              <input type="file" id="prof-file-input" accept="image/*" class="hidden">
              <div class="flex items-center gap-2 flex-wrap">
                <button type="button" id="btn-prof-upload-photo" class="btn-pill btn-pill-outline text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <span>Încarcă Poză</span>
                </button>
                <button type="button" id="btn-prof-clear-photo" class="text-xs text-rose-500 hover:text-rose-600 font-bold px-2 py-1">
                  Șterge poza
                </button>
              </div>
              <p class="text-[11px] text-slate-400">Dimensiune recomandată pătrată. Poza este redimensionată automat.</p>
            </div>
          </div>

          <!-- Quick Emoji Presets -->
          <div class="pt-2 border-t border-slate-200/60 dark:border-white/5">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Sau alege un avatar rapid:</div>
            <div class="flex items-center gap-2 flex-wrap">
              ${['👨', '👩', '🏋️', '🥗', '🥑', '⚡', '🏃‍♂️', '🎯'].map(emoji => `
                <button type="button" data-prof-emoji="${emoji}" class="w-9 h-9 rounded-xl bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 hover:border-brand-lilac hover:scale-105 active:scale-95 text-lg flex items-center justify-center transition shadow-2xs">
                  ${emoji}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- 2. Nume Profil -->
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Nume Profil <span class="text-rose-500">*</span></label>
          <input type="text" id="prof-input-name" value="${targetProfile?.name || ''}" placeholder="Ex: Cătălin, Elena, Alex..." class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
        </div>

        <!-- 3. Sex Toggle -->
        <div class="space-y-1.5">
          <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Sex Biologic</label>
          <div class="grid grid-cols-2 gap-2">
            <button type="button" id="btn-gender-male" class="p-2.5 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition ${
              tempGender === 'masculin'
                ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] border-transparent shadow-sm'
                : 'bg-white dark:bg-[#181924] border-[#E5E0F5] dark:border-white/10 text-slate-700 dark:text-slate-300'
            }">
              <span>♂ Masculin</span>
            </button>
            <button type="button" id="btn-gender-female" class="p-2.5 rounded-2xl border font-extrabold text-xs flex items-center justify-center gap-2 transition ${
              tempGender === 'feminin'
                ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] border-transparent shadow-sm'
                : 'bg-white dark:bg-[#181924] border-[#E5E0F5] dark:border-white/10 text-slate-700 dark:text-slate-300'
            }">
              <span>♀ Feminin</span>
            </button>
          </div>
        </div>

        <!-- 4. Biometrie (Greutate & Înălțime) -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Greutate (kg)</label>
            <div class="relative">
              <input type="number" step="0.5" min="30" max="300" id="prof-input-weight" value="${targetProfile?.weight || 75}" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl pl-4 pr-10 py-2.5 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
              <span class="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">kg</span>
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Înălțime (cm)</label>
            <div class="relative">
              <input type="number" step="1" min="100" max="250" id="prof-input-height" value="${targetProfile?.height || 178}" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl pl-4 pr-10 py-2.5 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
              <span class="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">cm</span>
            </div>
          </div>
        </div>

        <!-- Smart Calculator Button (Mifflin-St Jeor) -->
        <div class="p-3.5 rounded-2xl bg-gradient-to-r from-brand-lilac/15 to-[#FFB259]/15 border border-brand-lilac/30 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>⚡ Calculează Automat Recomandarea</span>
            </div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mifflin-St Jeor TDEE & macro proporționale pentru greutatea ta</div>
          </div>
          <button type="button" id="btn-prof-autocalc" class="btn-pill btn-pill-primary text-xs py-1.5 px-3 font-extrabold shadow-xs flex-shrink-0">
            Calculează
          </button>
        </div>

        <!-- 5. Ținte Calorii & Macronutrienți -->
        <div class="bg-white dark:bg-[#181924] p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-4 shadow-xs">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-extrabold text-slate-800 dark:text-white">Necesar Caloric Zilnic (kcal)</label>
              <span id="prof-cals-display" class="text-xs font-extrabold text-[#6D4AE8] dark:text-[#C4B5FD]">${defaultCals} kcal</span>
            </div>
            <div class="relative">
              <input type="number" step="25" min="500" max="6000" id="prof-input-cals" value="${defaultCals}" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
              <span class="absolute right-4 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">kcal / zi</span>
            </div>
          </div>

          <!-- 3 Macros Inputs -->
          <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5">
            <label class="block text-xs font-extrabold text-slate-700 dark:text-white/80">Macronutrienți Zilnici (g):</label>
            <div class="grid grid-cols-3 gap-2.5">
              <!-- Protein -->
              <div class="space-y-1 bg-rose-50/70 dark:bg-rose-900/15 p-2.5 rounded-2xl border border-rose-200/70 dark:border-rose-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  <span>Proteine</span>
                  <span id="prof-prot-pct" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="5" min="10" max="500" id="prof-input-prot" value="${defaultProt}" class="w-full bg-white dark:bg-[#121319] border border-rose-300/70 dark:border-rose-500/30 rounded-xl px-2 py-1.5 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>

              <!-- Carbs -->
              <div class="space-y-1 bg-amber-50/70 dark:bg-amber-900/15 p-2.5 rounded-2xl border border-amber-200/70 dark:border-amber-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  <span>Carbi</span>
                  <span id="prof-carbs-pct" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="5" min="10" max="800" id="prof-input-carbs" value="${defaultCarbs}" class="w-full bg-white dark:bg-[#121319] border border-amber-300/70 dark:border-amber-500/30 rounded-xl px-2 py-1.5 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>

              <!-- Fat -->
              <div class="space-y-1 bg-sky-50/70 dark:bg-sky-900/15 p-2.5 rounded-2xl border border-sky-200/70 dark:border-sky-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-sky-800 dark:text-sky-300">
                  <span>Grăsimi</span>
                  <span id="prof-fat-pct" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="2" min="10" max="300" id="prof-input-fat" value="${defaultFat}" class="w-full bg-white dark:bg-[#121319] border border-sky-300/70 dark:border-sky-500/30 rounded-xl px-2 py-1.5 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2 top-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>
            </div>

            <!-- Live Calculation Helper -->
            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 font-medium">
              <span>Total calorii din macro:</span>
              <span id="prof-macro-sum-cals" class="font-extrabold text-slate-800 dark:text-white">-- kcal</span>
            </div>
            <div class="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10 mt-1">
              <div id="prof-bar-prot" class="bg-[#FF6FA4]" style="width: 30%"></div>
              <div id="prof-bar-carbs" class="bg-[#FFB259]" style="width: 45%"></div>
              <div id="prof-bar-fat" class="bg-[#82CBEF]" style="width: 25%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-[#181924]">
        <div>
          ${isEdit && profiles.length > 1 ? `
            <button type="button" id="btn-prof-delete" class="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline">
              Șterge Profilul
            </button>
          ` : `
            <button type="button" id="btn-prof-cancel" class="btn-pill btn-pill-outline text-xs">Anulează</button>
          `}
        </div>
        <div class="flex items-center gap-2">
          <button type="button" id="btn-prof-save" class="btn-pill btn-pill-primary text-xs shadow-sm">
            ${isEdit ? 'Salvează Modificările' : 'Creează & Activează Profilul'}
          </button>
        </div>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-lg' });

    // Inputs & Elements
    const nameInput = document.getElementById('prof-input-name');
    const weightInput = document.getElementById('prof-input-weight');
    const heightInput = document.getElementById('prof-input-height');
    const calsInput = document.getElementById('prof-input-cals');
    const protInput = document.getElementById('prof-input-prot');
    const carbsInput = document.getElementById('prof-input-carbs');
    const fatInput = document.getElementById('prof-input-fat');

    const previewContainer = document.getElementById('prof-avatar-preview');
    const fileInput = document.getElementById('prof-file-input');

    const updatePreviewAvatar = () => {
      if (!previewContainer) return;
      if (tempPhoto) {
        previewContainer.innerHTML = `<img src="${tempPhoto}" alt="Avatar" class="w-full h-full object-cover">`;
      } else {
        const initial = nameInput?.value.trim() ? nameInput.value.trim().slice(0, 2).toUpperCase() : '👤';
        previewContainer.innerHTML = `<span class="text-xl font-black text-slate-700 dark:text-white">${initial}</span>`;
      }
    };

    nameInput?.addEventListener('input', () => {
      if (!tempPhoto) updatePreviewAvatar();
    });

    // File input handler
    document.getElementById('btn-prof-upload-photo')?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (file) {
        const compressed = await this.compressImageToThumbnail(file, 160);
        if (compressed) {
          tempPhoto = compressed;
          updatePreviewAvatar();
          this.showToast('Poză de profil încărcată!', 'success');
        }
      }
    });

    document.getElementById('btn-prof-clear-photo')?.addEventListener('click', () => {
      tempPhoto = '';
      if (fileInput) fileInput.value = '';
      updatePreviewAvatar();
    });

    // Quick emojis
    document.querySelectorAll('[data-prof-emoji]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emoji = e.currentTarget.getAttribute('data-prof-emoji');
        tempPhoto = this.createEmojiAvatar(emoji);
        updatePreviewAvatar();
      });
    });

    // Gender toggles
    const btnMale = document.getElementById('btn-gender-male');
    const btnFemale = document.getElementById('btn-gender-female');
    const setGender = (g) => {
      tempGender = g;
      if (g === 'masculin') {
        btnMale?.classList.add('bg-[#121319]', 'dark:bg-white', 'text-white', 'dark:text-[#121319]', 'border-transparent', 'shadow-sm');
        btnMale?.classList.remove('bg-white', 'dark:bg-[#181924]', 'border-[#E5E0F5]', 'dark:border-white/10', 'text-slate-700', 'dark:text-slate-300');

        btnFemale?.classList.remove('bg-[#121319]', 'dark:bg-white', 'text-white', 'dark:text-[#121319]', 'border-transparent', 'shadow-sm');
        btnFemale?.classList.add('bg-white', 'dark:bg-[#181924]', 'border-[#E5E0F5]', 'dark:border-white/10', 'text-slate-700', 'dark:text-slate-300');
      } else {
        btnFemale?.classList.add('bg-[#121319]', 'dark:bg-white', 'text-white', 'dark:text-[#121319]', 'border-transparent', 'shadow-sm');
        btnFemale?.classList.remove('bg-white', 'dark:bg-[#181924]', 'border-[#E5E0F5]', 'dark:border-white/10', 'text-slate-700', 'dark:text-slate-300');

        btnMale?.classList.remove('bg-[#121319]', 'dark:bg-white', 'text-white', 'dark:text-[#121319]', 'border-transparent', 'shadow-sm');
        btnMale?.classList.add('bg-white', 'dark:bg-[#181924]', 'border-[#E5E0F5]', 'dark:border-white/10', 'text-slate-700', 'dark:text-slate-300');
      }
    };
    btnMale?.addEventListener('click', () => setGender('masculin'));
    btnFemale?.addEventListener('click', () => setGender('feminin'));

    // Live Macro calculations
    const updateCalculations = () => {
      const cals = parseFloat(calsInput?.value) || 0;
      const prot = parseFloat(protInput?.value) || 0;
      const carbs = parseFloat(carbsInput?.value) || 0;
      const fat = parseFloat(fatInput?.value) || 0;

      const macroCals = Math.round(prot * 4 + carbs * 4 + fat * 9);
      const calsDisplay = document.getElementById('prof-cals-display');
      const sumCalsEl = document.getElementById('prof-macro-sum-cals');
      const protPctEl = document.getElementById('prof-prot-pct');
      const carbsPctEl = document.getElementById('prof-carbs-pct');
      const fatPctEl = document.getElementById('prof-fat-pct');

      const barProt = document.getElementById('prof-bar-prot');
      const barCarbs = document.getElementById('prof-bar-carbs');
      const barFat = document.getElementById('prof-bar-fat');

      if (calsDisplay) calsDisplay.textContent = `${cals} kcal`;
      if (sumCalsEl) sumCalsEl.textContent = `${macroCals} kcal`;

      const base = macroCals > 0 ? macroCals : (cals || 1);
      const pPct = Math.round((prot * 4 / base) * 100);
      const cPct = Math.round((carbs * 4 / base) * 100);
      const fPct = Math.round((fat * 9 / base) * 100);

      if (protPctEl) protPctEl.textContent = `${pPct}%`;
      if (carbsPctEl) carbsPctEl.textContent = `${cPct}%`;
      if (fatPctEl) fatPctEl.textContent = `${fPct}%`;

      if (barProt) barProt.style.width = `${pPct}%`;
      if (barCarbs) barCarbs.style.width = `${cPct}%`;
      if (barFat) barFat.style.width = `${fPct}%`;
    };

    calsInput?.addEventListener('input', updateCalculations);
    protInput?.addEventListener('input', updateCalculations);
    carbsInput?.addEventListener('input', updateCalculations);
    fatInput?.addEventListener('input', updateCalculations);

    // Smart Auto-Calc (Mifflin-St Jeor)
    document.getElementById('btn-prof-autocalc')?.addEventListener('click', () => {
      const w = parseFloat(weightInput?.value) || 75;
      const h = parseFloat(heightInput?.value) || 178;
      const isMale = tempGender === 'masculin';

      // BMR:
      const bmr = isMale ? (10 * w + 6.25 * h - 5 * 30 + 5) : (10 * w + 6.25 * h - 5 * 30 - 161);
      // TDEE:
      const tdee = Math.round((bmr * 1.35) / 25) * 25;
      // Protein: ~2.0g/kg
      const pG = Math.round(w * 2.0);
      // Fat: ~0.85g/kg
      const fG = Math.round(w * 0.85);
      // Carbs: remainder
      const cG = Math.max(50, Math.round((tdee - (pG * 4 + fG * 9)) / 4));

      if (calsInput) calsInput.value = tdee;
      if (protInput) protInput.value = pG;
      if (carbsInput) carbsInput.value = cG;
      if (fatInput) fatInput.value = fG;

      updateCalculations();
      this.showToast(`Necesar calculat: ${tdee} kcal (${pG}g P, ${cG}g C, ${fG}g G)`, 'info');
    });

    // Back to view / Cancel
    document.getElementById('btn-prof-back-to-view')?.addEventListener('click', () => {
      this.openProfileModal('view');
    });
    document.getElementById('btn-prof-cancel')?.addEventListener('click', () => {
      this.openProfileModal('view');
    });

    // Delete profile
    document.getElementById('btn-prof-delete')?.addEventListener('click', () => {
      if (!isEdit || !targetProfile) return;
      this.showConfirmModal({
        title: 'Șterge Profilul',
        message: `Ești sigur că vrei să ștergi definitiv profilul "${targetProfile.name}"?`,
        confirmText: 'Șterge profilul',
        isDanger: true,
        onConfirm: () => {
          window.store.deleteProfile(targetProfile.id);
          this.updateHeaderProfile();
          this.showToast(`Profilul "${targetProfile.name}" a fost șters.`, 'info');
          this.renderCurrentView();
          this.openProfileModal('view');
        }
      });
    });

    // Save profile
    document.getElementById('btn-prof-save')?.addEventListener('click', () => {
      const name = nameInput?.value.trim();
      if (!name) {
        this.showToast('Te rugăm să introduci un nume pentru profil.', 'warning');
        nameInput?.focus();
        return;
      }

      const weight = parseFloat(weightInput?.value) || 0;
      const height = parseFloat(heightInput?.value) || 0;
      const calories = parseFloat(calsInput?.value) || 2000;
      const protein = parseFloat(protInput?.value) || 140;
      const carbs = parseFloat(carbsInput?.value) || 220;
      const fat = parseFloat(fatInput?.value) || 65;

      const profilePayload = {
        name,
        photo: tempPhoto,
        gender: tempGender,
        weight,
        height,
        calories,
        protein,
        carbs,
        fat
      };

      if (isEdit && targetProfile) {
        window.store.updateProfile(targetProfile.id, profilePayload);
        this.showToast(`Profilul "${name}" a fost actualizat!`, 'success');
      } else {
        const created = window.store.addProfile(profilePayload);
        this.showToast(`Profilul "${name}" a fost creat și setat ca activ!`, 'success');
      }

      this.dailyCalorieTarget = calories;
      this.updateHeaderProfile();
      this.renderCurrentView();
      this.openProfileModal('view');
    });

    updateCalculations();
  }

  // --- Modal: Settings (Caloric & Macronutrient Targets) ---
  openSettingsModal() {
    const targets = window.store.getTargets();

    const html = `
      <!-- Fixed Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-2xl bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center font-bold flex-shrink-0">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
          </div>
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white leading-snug">Setări & Ținte Nutriționale</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Configurează necesarul zilnic de calorii și macronutrienți</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Scrollable Body -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
        <!-- Quick Presets -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-white/80 mb-2">Preseturi rapide de obiective:</label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button type="button" data-preset-cals="1700" data-preset-prot="140" data-preset-carbs="160" data-preset-fat="55" class="preset-target-btn p-2.5 text-left rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 hover:border-brand-lilac hover:bg-brand-lilac/5 transition">
              <div class="text-[11px] font-extrabold text-slate-800 dark:text-white">Slăbire / Deficit</div>
              <div class="text-[10px] text-slate-500 mt-0.5">1700 kcal • 140g P</div>
            </button>
            <button type="button" data-preset-cals="2000" data-preset-prot="135" data-preset-carbs="230" data-preset-fat="60" class="preset-target-btn p-2.5 text-left rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 hover:border-brand-lilac hover:bg-brand-lilac/5 transition">
              <div class="text-[11px] font-extrabold text-slate-800 dark:text-white">Echilibrat</div>
              <div class="text-[10px] text-slate-500 mt-0.5">2000 kcal • 135g P</div>
            </button>
            <button type="button" data-preset-cals="2500" data-preset-prot="160" data-preset-carbs="310" data-preset-fat="70" class="preset-target-btn p-2.5 text-left rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 hover:border-brand-lilac hover:bg-brand-lilac/5 transition">
              <div class="text-[11px] font-extrabold text-slate-800 dark:text-white">Masă Musculară</div>
              <div class="text-[10px] text-slate-500 mt-0.5">2500 kcal • 160g P</div>
            </button>
            <button type="button" data-preset-cals="1800" data-preset-prot="130" data-preset-carbs="50" data-preset-fat="120" class="preset-target-btn p-2.5 text-left rounded-2xl border border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-white/5 hover:border-brand-lilac hover:bg-brand-lilac/5 transition">
              <div class="text-[11px] font-extrabold text-slate-800 dark:text-white">Low Carb / Keto</div>
              <div class="text-[10px] text-slate-500 mt-0.5">1800 kcal • 50g C</div>
            </button>
          </div>
        </div>

        <!-- Input Fields (Calories & 3 Macros) -->
        <div class="bg-white dark:bg-[#181924] p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-4 shadow-xs">
          <!-- Calorie Target -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-slate-800 dark:text-white">Necesar Caloric Zilnic (kcal)</label>
              <span class="text-[11px] font-extrabold text-[#6D4AE8] dark:text-[#C4B5FD]" id="settings-cals-val">${targets.calories} kcal</span>
            </div>
            <div class="relative">
              <input type="number" step="25" min="500" max="6000" id="settings-input-cals" value="${targets.calories}" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none focus:border-brand-lilac">
              <span class="absolute right-4 top-2.5 text-xs font-bold text-slate-400 pointer-events-none">kcal / zi</span>
            </div>
          </div>

          <!-- 3 Macronutrients -->
          <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-white/5">
            <div class="text-xs font-extrabold text-slate-700 dark:text-white/80">Necesar Macronutrienți per Zi:</div>
            
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <!-- Protein -->
              <div class="space-y-1 bg-rose-50/60 dark:bg-rose-500/10 p-3 rounded-2xl border border-rose-200/60 dark:border-rose-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-rose-700 dark:text-rose-300">
                  <span>Proteine</span>
                  <span id="settings-prot-cal-percent" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="5" min="20" max="400" id="settings-input-prot" value="${targets.protein}" class="w-full bg-white dark:bg-[#121319] border border-rose-300/70 dark:border-rose-500/30 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>

              <!-- Carbs -->
              <div class="space-y-1 bg-amber-50/60 dark:bg-amber-500/10 p-3 rounded-2xl border border-amber-200/60 dark:border-amber-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  <span>Carbohidrați</span>
                  <span id="settings-carbs-cal-percent" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="5" min="10" max="600" id="settings-input-carbs" value="${targets.carbs}" class="w-full bg-white dark:bg-[#121319] border border-amber-300/70 dark:border-amber-500/30 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>

              <!-- Fat -->
              <div class="space-y-1 bg-sky-50/60 dark:bg-sky-500/10 p-3 rounded-2xl border border-sky-200/60 dark:border-sky-500/20">
                <div class="flex items-center justify-between text-[11px] font-bold text-sky-800 dark:text-sky-300">
                  <span>Grăsimi</span>
                  <span id="settings-fat-cal-percent" class="text-[10px] opacity-80">--%</span>
                </div>
                <div class="relative">
                  <input type="number" step="5" min="10" max="250" id="settings-input-fat" value="${targets.fat}" class="w-full bg-white dark:bg-[#121319] border border-sky-300/70 dark:border-sky-500/30 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-900 dark:text-white text-center focus:outline-none">
                  <span class="absolute right-2.5 top-2 text-[10px] font-bold text-slate-400 pointer-events-none">g</span>
                </div>
              </div>
            </div>

            <!-- Real-time Macro Sum vs Target Calories feedback -->
            <div id="settings-macro-sum-banner" class="p-3 rounded-2xl text-xs flex items-center justify-between bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <span class="text-slate-600 dark:text-slate-300 font-medium">Suma caloriilor din macro (4P + 4C + 9G):</span>
              <div class="flex items-center gap-2">
                <span id="settings-macro-sum-cals" class="font-extrabold text-slate-900 dark:text-white">-- kcal</span>
                <button type="button" id="btn-sync-macro-cals" class="text-[10.5px] font-bold text-[#6D4AE8] dark:text-[#C4B5FD] hover:underline" title="Setează caloriile țintă egale cu suma macro">Sincronizează</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-[#181924]">
        <button type="button" id="btn-reset-targets-default" class="text-xs font-bold text-slate-500 hover:text-rose-600 underline">
          Resetează la 2000 kcal
        </button>
        <div class="flex items-center gap-2">
          <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">Anulează</button>
          <button id="btn-save-settings-targets" class="btn-pill btn-pill-primary text-xs shadow-sm">
            Salvează Țintele
          </button>
        </div>
      </div>
    `;

    this.openModal(html, { position: 'center', maxWidth: 'max-w-lg' });

    const calsInput = document.getElementById('settings-input-cals');
    const protInput = document.getElementById('settings-input-prot');
    const carbsInput = document.getElementById('settings-input-carbs');
    const fatInput = document.getElementById('settings-input-fat');

    const calsVal = document.getElementById('settings-cals-val');
    const sumCalsEl = document.getElementById('settings-macro-sum-cals');
    const protPctEl = document.getElementById('settings-prot-cal-percent');
    const carbsPctEl = document.getElementById('settings-carbs-cal-percent');
    const fatPctEl = document.getElementById('settings-fat-cal-percent');
    const syncBtn = document.getElementById('btn-sync-macro-cals');

    const updateCalculations = () => {
      const cals = parseFloat(calsInput?.value) || 0;
      const prot = parseFloat(protInput?.value) || 0;
      const carbs = parseFloat(carbsInput?.value) || 0;
      const fat = parseFloat(fatInput?.value) || 0;

      const macroCals = Math.round(prot * 4 + carbs * 4 + fat * 9);
      if (calsVal) calsVal.textContent = `${cals} kcal`;
      if (sumCalsEl) sumCalsEl.textContent = `${macroCals} kcal`;

      const base = macroCals > 0 ? macroCals : (cals || 1);
      if (protPctEl) protPctEl.textContent = `${Math.round((prot * 4 / base) * 100)}%`;
      if (carbsPctEl) carbsPctEl.textContent = `${Math.round((carbs * 4 / base) * 100)}%`;
      if (fatPctEl) fatPctEl.textContent = `${Math.round((fat * 9 / base) * 100)}%`;
    };

    calsInput?.addEventListener('input', updateCalculations);
    protInput?.addEventListener('input', updateCalculations);
    carbsInput?.addEventListener('input', updateCalculations);
    fatInput?.addEventListener('input', updateCalculations);

    syncBtn?.addEventListener('click', () => {
      const prot = parseFloat(protInput?.value) || 0;
      const carbs = parseFloat(carbsInput?.value) || 0;
      const fat = parseFloat(fatInput?.value) || 0;
      const macroCals = Math.round(prot * 4 + carbs * 4 + fat * 9);
      if (calsInput) calsInput.value = macroCals;
      updateCalculations();
    });

    // Preset buttons
    document.querySelectorAll('.preset-target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.getAttribute('data-preset-cals');
        const p = btn.getAttribute('data-preset-prot');
        const cb = btn.getAttribute('data-preset-carbs');
        const f = btn.getAttribute('data-preset-fat');

        if (calsInput) calsInput.value = c;
        if (protInput) protInput.value = p;
        if (carbsInput) carbsInput.value = cb;
        if (fatInput) fatInput.value = f;

        updateCalculations();
      });
    });

    // Reset default
    document.getElementById('btn-reset-targets-default')?.addEventListener('click', () => {
      if (calsInput) calsInput.value = 2000;
      if (protInput) protInput.value = 140;
      if (carbsInput) carbsInput.value = 220;
      if (fatInput) fatInput.value = 65;
      updateCalculations();
    });

    // Save
    document.getElementById('btn-save-settings-targets')?.addEventListener('click', () => {
      const calories = parseFloat(calsInput?.value) || 2000;
      const protein = parseFloat(protInput?.value) || 140;
      const carbs = parseFloat(carbsInput?.value) || 220;
      const fat = parseFloat(fatInput?.value) || 65;

      window.store.updateTargets({ calories, protein, carbs, fat });
      this.dailyCalorieTarget = calories;
      this.closeModal();
      this.showToast('Țintele calorice și macronutrienții au fost actualizate!', 'success');
      this.renderCurrentView();
    });

    updateCalculations();
  }

  // --- Header Cloud Sync Status Pill ---
  updateHeaderSyncStatus() {
    const btn = document.getElementById('btn-open-cloud-sync');
    if (!btn || !window.cloudSync) return;

    if (window.cloudSync.user) {
      const email = window.cloudSync.user.email || window.cloudSync.user.displayName || 'Conectat';
      const shortEmail = email.length > 14 ? email.slice(0, 11) + '...' : email;
      btn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[#70D6A3]/15 text-[#2E8B5B] dark:text-[#70D6A3] border border-[#70D6A3]/30 shadow-2xs hover:bg-[#70D6A3]/25 transition flex-shrink-0 cursor-pointer';
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#70D6A3] animate-pulse"></span><span id="header-sync-status-text">${shortEmail}</span>`;
      btn.title = `Conectat și sincronizat: ${email}. Apasă pentru detalii sync.`;
    } else if (window.cloudSync.config) {
      btn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs hover:bg-amber-500/25 transition flex-shrink-0 cursor-pointer';
      btn.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span><span id="header-sync-status-text">Autentificare</span>`;
      btn.title = 'Firebase configurat. Apasă pentru autentificare.';
    } else {
      btn.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 shadow-2xs hover:border-[#6D4AE8] transition flex-shrink-0 cursor-pointer';
      btn.innerHTML = `<svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg><span id="header-sync-status-text">Cont & Sync</span>`;
      btn.title = 'Apasă pentru a activa contul și sincronizarea pe mobil/desktop.';
    }
  }

  // --- Modal: Cont NutriPlanner & Sincronizare Cloud (Firebase Firestore) ---
  openCloudSyncModal() {
    if (!window.cloudSync) {
      this.showToast('Modulul de sincronizare nu este disponibil.', 'warning');
      return;
    }

    const sync = window.cloudSync;
    const isConfigured = !!sync.config;
    const user = sync.user;
    let authMode = 'login'; // 'login' | 'signup'

    const renderModalContent = () => {
      let bodyHtml = '';

      if (user) {
        // --- State A: Logged In & Realtime Active ---
        const lastSyncStr = sync.lastSyncedAt 
          ? sync.lastSyncedAt.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : 'Acum câteva momente';

        bodyHtml = `
          <div class="space-y-4">
            <!-- Account Status Card -->
            <div class="p-4 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-3xl space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-sm flex-shrink-0">
                    ${user.photoURL ? `<img src="${user.photoURL}" class="w-full h-full object-cover rounded-2xl">` : (user.email ? user.email.charAt(0).toUpperCase() : 'U')}
                  </div>
                  <div class="min-w-0">
                    <div class="font-extrabold text-sm text-slate-900 dark:text-white truncate">${user.displayName || 'Utilizator NutriPlanner'}</div>
                    <div class="text-xs text-slate-500 dark:text-white/70 truncate">${user.email || 'Autentificat'}</div>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 flex-shrink-0">
                  Conectat
                </span>
              </div>

              <div class="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs">
                <span class="text-slate-600 dark:text-white/70 flex items-center gap-1.5 font-medium">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Sincronizare în timp real: <strong class="text-emerald-700 dark:text-emerald-300">Activă</strong>
                </span>
                <span class="text-slate-400 dark:text-white/50 text-[11px]">Sync: ${lastSyncStr}</span>
              </div>
            </div>

            <!-- Sync Explanatory Info -->
            <div class="p-3.5 bg-slate-50 dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl space-y-1.5 text-xs text-slate-600 dark:text-white/80">
              <div class="font-bold flex items-center gap-1.5 text-slate-800 dark:text-white">
                <span>🔄</span>
                <span>Cum funcționează sincronizarea:</span>
              </div>
              <p class="leading-relaxed">
                Orice rețetă nouă, ingredient, modificare de porții sau meniu săptămânal adăugat pe <strong>telefon</strong> sau <strong>desktop</strong> este salvat instantaneu în baza ta de date Cloud Firestore și apare pe celălalt dispozitiv în timp real!
              </p>
            </div>

            <!-- Action Buttons: Sync Now, Mobile Connect Link, Sign Out -->
            <div class="space-y-2 pt-1">
              <button id="btn-sync-force-now" class="w-full py-2.5 px-4 bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-black rounded-2xl hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                <span>Forțează Sincronizarea Acum</span>
              </button>

              <button id="btn-sync-copy-mobile-link" class="w-full py-2.5 px-4 bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] border border-brand-lilac/30 text-xs font-bold rounded-2xl hover:bg-brand-lilac/25 transition flex items-center justify-center gap-2 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                <span>Copiază Linkul de Conectare pentru Telefon</span>
              </button>

              <button id="btn-sync-do-signout" class="w-full py-2 px-4 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold rounded-2xl transition flex items-center justify-center gap-2 cursor-pointer">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                <span>Deconectează-te de pe acest dispozitiv</span>
              </button>
            </div>
          </div>
        `;
      } else if (isConfigured) {
        // --- State B: Firebase Configured, Needs Login/Signup ---
        bodyHtml = `
          <div class="space-y-4">
            <!-- Mode Switcher Tabs (Autentificare vs Înregistrare) -->
            <div class="flex items-center p-1 bg-slate-100 dark:bg-white/5 rounded-2xl border border-[#E5E0F5] dark:border-white/10">
              <button type="button" id="tab-sync-login" class="flex-1 py-2 text-xs font-extrabold rounded-xl transition ${authMode === 'login' ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                Autentificare
              </button>
              <button type="button" id="tab-sync-signup" class="flex-1 py-2 text-xs font-extrabold rounded-xl transition ${authMode === 'signup' ? 'bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}">
                Creează Cont Nou
              </button>
            </div>

            <!-- Google One-Click Button -->
            <div>
              <button type="button" id="btn-sync-google-auth" class="w-full py-2.5 px-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center gap-2.5 font-bold text-xs sm:text-sm text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition shadow-2xs cursor-pointer">
                <svg class="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continuă cu Google</span>
              </button>
            </div>

            <div class="flex items-center gap-2 text-slate-400 text-xs my-2">
              <span class="flex-1 h-px bg-slate-200 dark:bg-white/10"></span>
              <span class="text-[11px] font-semibold">sau cu email</span>
              <span class="flex-1 h-px bg-slate-200 dark:bg-white/10"></span>
            </div>

            <!-- Email & Password Form -->
            <form id="form-sync-auth" class="space-y-3">
              ${authMode === 'signup' ? `
                <div class="space-y-1">
                  <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Numele Tău</label>
                  <input type="text" id="sync-input-name" placeholder="ex: Cătălin" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac" required>
                </div>
              ` : ''}

              <div class="space-y-1">
                <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Adresă de Email</label>
                <input type="email" id="sync-input-email" placeholder="nume@exemplu.ro" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac" required>
              </div>

              <div class="space-y-1">
                <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Parolă</label>
                <input type="password" id="sync-input-password" placeholder="••••••••" minlength="6" class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac" required>
              </div>

              <button type="submit" id="btn-sync-submit-auth" class="w-full py-2.5 px-4 bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-black rounded-2xl hover:opacity-95 transition shadow-sm mt-2 flex items-center justify-center gap-2 cursor-pointer">
                <span>${authMode === 'login' ? 'Intră în Cont' : 'Creează Contul și Sincronizează'}</span>
              </button>
            </form>

            <div class="pt-2 text-center">
              <button type="button" id="btn-sync-reconfig" class="text-[11px] font-bold text-slate-400 hover:text-slate-700 dark:hover:text-white underline cursor-pointer">
                ⚙️ Schimbă configurația Firebase
              </button>
            </div>
          </div>
        `;
      } else {
        // --- State C: Firebase Not Yet Configured ---
        bodyHtml = `
          <div class="space-y-4">
            <div class="p-4 bg-brand-lilac/10 dark:bg-brand-lilac/15 border border-brand-lilac/30 rounded-3xl space-y-2 text-xs">
              <div class="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>🔥</span>
                <span>Conectare Firebase / Google Cloud Firestore</span>
              </div>
              <p class="text-slate-600 dark:text-white/70 leading-relaxed">
                Pentru a sincroniza rețetele și planul alimentar între telefon și calculator, introdu configurația proiectului tău Firebase (gratuit pe <a href="https://console.firebase.google.com" target="_blank" class="underline font-bold text-[#6D4AE8] dark:text-[#C4B5FD]">console.firebase.google.com</a>):
              </p>
              <ol class="list-decimal list-inside space-y-1 text-slate-600 dark:text-white/80 pt-1 font-medium text-[11.5px]">
                <li>Mergi în <strong>Project Settings</strong> (General) &gt; <em>Your apps</em> &gt; <em>Web app</em>.</li>
                <li>Copiază blocul <code>const firebaseConfig = { ... }</code>.</li>
                <li>Lipește-l în căsuța de mai jos și apasă <strong>Conectează</strong>!</li>
              </ol>
            </div>

            <div class="space-y-1.5">
              <label class="block text-xs font-bold text-slate-700 dark:text-white/80">Lipește configurația Firebase (JSON sau cod JS):</label>
              <textarea id="sync-input-config-paste" rows="5" placeholder='{\n  "apiKey": "AIzaSy...",\n  "authDomain": "proiectul-tau.firebaseapp.com",\n  "projectId": "proiectul-tau",\n  "storageBucket": "proiectul-tau.appspot.com",\n  "messagingSenderId": "...",\n  "appId": "..."\n}' class="w-full bg-[#FAF9FD] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl p-3 text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-brand-lilac resize-none"></textarea>
            </div>

            <button type="button" id="btn-sync-save-config" class="w-full py-2.5 px-4 bg-[#121319] dark:bg-white text-white dark:text-[#121319] text-xs font-black rounded-2xl hover:opacity-95 transition shadow-sm flex items-center justify-center gap-2 cursor-pointer">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              <span>Conectează Proiectul Firebase</span>
            </button>
          </div>
        `;
      }

      return `
        <!-- Fixed Header -->
        <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#FFB259] via-[#FF6FA4] to-[#6D4AE8] text-white flex items-center justify-center font-bold flex-shrink-0 shadow-sm">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
            </div>
            <div>
              <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white leading-tight">Cont & Sincronizare Cloud</h3>
              <p class="text-xs text-slate-500 dark:text-white/60">Sincronizează datele pe mobil și desktop în timp real</p>
            </div>
          </div>
          <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Scrollable Body -->
        <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6" id="sync-modal-body">
          ${bodyHtml}
        </div>
      `;
    };

    const attachModalHandlers = () => {
      // Tab switcher (login vs signup)
      document.getElementById('tab-sync-login')?.addEventListener('click', () => {
        authMode = 'login';
        this.openModal(renderModalContent());
        attachModalHandlers();
      });
      document.getElementById('tab-sync-signup')?.addEventListener('click', () => {
        authMode = 'signup';
        this.openModal(renderModalContent());
        attachModalHandlers();
      });

      // Google Auth button
      document.getElementById('btn-sync-google-auth')?.addEventListener('click', async () => {
        try {
          this.showToast('Se deschide autentificarea Google...', 'info');
          await sync.signInWithGoogle();
          this.closeModal();
          this.showToast('Autentificat cu succes prin Google!', 'success');
        } catch (err) {
          console.error(err);
          let msg = err.message || 'Eroare la autentificarea Google.';
          if (err.code === 'auth/unauthorized-domain') {
            const host = window.location.hostname || 'domeniul tău';
            msg = `Domeniul "${host}" nu este autorizat în Firebase pentru Google Sign-In. Adaugă-l în Firebase Console > Authentication > Settings > Authorized domains, sau autentifică-te mai jos direct cu Email și Parolă!`;
          } else if (err.code === 'auth/popup-closed-by-user') {
            msg = 'Fereastra de autentificare Google a fost închisă.';
          }
          this.showToast(msg, 'warning');
        }
      });

      // Email / Password Form Submit
      document.getElementById('form-sync-auth')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('sync-input-email')?.value.trim();
        const pass = document.getElementById('sync-input-password')?.value;
        const name = document.getElementById('sync-input-name')?.value.trim();

        if (!email || !pass) return;

        try {
          if (authMode === 'login') {
            await sync.signInWithEmail(email, pass);
            this.closeModal();
            this.showToast(`Bine ai revenit, ${email}! Sincronizarea este activă.`, 'success');
          } else {
            await sync.signUpWithEmail(email, pass, name);
            this.closeModal();
            this.showToast(`Cont creat cu succes pentru ${email}!`, 'success');
          }
        } catch (err) {
          console.error(err);
          let msg = err.message || 'Eroare la autentificare.';
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
            msg = 'Email sau parolă incorectă.';
          } else if (err.code === 'auth/email-already-in-use') {
            msg = 'Acest email este deja înregistrat. Te rugăm să te autentifici.';
          } else if (err.code === 'auth/weak-password') {
            msg = 'Parola este prea scurtă (minim 6 caractere).';
          }
          this.showToast(msg, 'warning');
        }
      });

      // Force Sync Now button
      document.getElementById('btn-sync-force-now')?.addEventListener('click', async () => {
        this.showToast('Se trimit datele către Cloud Firestore...', 'info');
        await sync.uploadCurrentState(true);
        this.showToast('Sincronizare finalizată cu succes!', 'success');
        this.openModal(renderModalContent());
        attachModalHandlers();
      });

      // Copy Mobile Connect Link button
      document.getElementById('btn-sync-copy-mobile-link')?.addEventListener('click', () => {
        if (!sync.config) return;
        const encodedCfg = btoa(encodeURIComponent(JSON.stringify(sync.config)));
        const mobileUrl = `${window.location.origin}${window.location.pathname}?sync_cfg=${encodedCfg}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(mobileUrl);
          this.showToast('Linkul de conectare a fost copiat în clipboard! Trimite-l pe telefon (WhatsApp/Email) și deschide-l.', 'success');
        } else {
          prompt('Copiază acest link și deschide-l pe telefon:', mobileUrl);
        }
      });

      // Sign Out button
      document.getElementById('btn-sync-do-signout')?.addEventListener('click', async () => {
        await sync.signOut();
        this.showToast('Te-ai deconectat cu succes.', 'info');
        this.openModal(renderModalContent());
        attachModalHandlers();
      });

      // Reconfigure Firebase button
      document.getElementById('btn-sync-reconfig')?.addEventListener('click', () => {
        sync.saveConfig(null);
        this.openModal(renderModalContent());
        attachModalHandlers();
      });

      // Save Firebase Config Paste
      document.getElementById('btn-sync-save-config')?.addEventListener('click', () => {
        const raw = document.getElementById('sync-input-config-paste')?.value.trim();
        if (!raw) {
          this.showToast('Te rugăm să lipești configurația Firebase.', 'warning');
          return;
        }

        let parsedConfig = null;
        try {
          // Attempt standard JSON parse
          parsedConfig = JSON.parse(raw);
        } catch (e) {
          // Extract keys using smart regex if user pasted JS snippet `const firebaseConfig = { ... }`
          try {
            const extractKey = (key) => {
              const match = raw.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, 'i'));
              return match ? match[1] : '';
            };
            parsedConfig = {
              apiKey: extractKey('apiKey'),
              authDomain: extractKey('authDomain'),
              projectId: extractKey('projectId'),
              storageBucket: extractKey('storageBucket'),
              messagingSenderId: extractKey('messagingSenderId'),
              appId: extractKey('appId')
            };
          } catch (err) {
            console.error('Regex parse error:', err);
          }
        }

        if (!parsedConfig || !parsedConfig.apiKey || !parsedConfig.projectId) {
          this.showToast('Nu s-au putut extrage cheile Firebase. Verifică dacă textul conține apiKey și projectId.', 'warning');
          return;
        }

        const success = sync.initFirebase(parsedConfig);
        if (success) {
          this.showToast('Proiectul Firebase a fost conectat cu succes!', 'success');
          this.openModal(renderModalContent());
          attachModalHandlers();
        } else {
          this.showToast('Eroare la conectarea Firebase. Verifică datele introduse.', 'warning');
        }
      });
    };

    this.openModal(renderModalContent());
    attachModalHandlers();
  }

  // --- Modal: Asistent NutriChef AI (Creează Rețete & Căutare Valori Online) ---
  openAssistantModal(initialTab = 'recipe', prefillData = null) {
    let currentTab = initialTab || 'recipe';
    let currentServings = 2;
    let currentGoal = 'balanced';
    let currentMealType = 'Prânz';
    let currentGeneratedRecipe = null;

    const pantry = window.store ? window.store.data.ingredients.slice(0, 16) : [];

    const html = `
      <!-- Fixed Modal Header -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#A390F5] via-[#8872F0] to-[#FF6FA4] text-white flex items-center justify-center font-bold flex-shrink-0 shadow-md">
            <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white leading-snug">Asistent NutriChef AI</h3>
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD]">Inteligent</span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400">Rețete din ingrediente & căutare valori de pe net</p>
          </div>
        </div>
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Assistant Navigation Sub-Tabs -->
      <div class="flex-shrink-0 px-4 pt-3 pb-2.5 border-b border-[#E5E0F5] dark:border-white/10 bg-[#FAF9FD] dark:bg-[#151620] flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar">
        <button id="asst-nav-recipe" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${currentTab === 'recipe' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          <span>🍳 Creează Rețetă</span>
        </button>
        <button id="asst-nav-online" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${currentTab === 'online' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <span>🔍 Căutare Valori Online</span>
        </button>
        <button id="asst-nav-settings" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${currentTab === 'settings' ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
          <span>⚙️ Cheie AI</span>
        </button>
      </div>

      <!-- Scrollable Modal Content -->
      <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
        
        <!-- ================= TAB 1: RECIPE CREATOR ================= -->
        <div id="asst-pane-recipe" class="${currentTab === 'recipe' ? 'block' : 'hidden'} space-y-4">
          <!-- Input Form Bento Box -->
          <div class="bg-[#FAF9FD] dark:bg-white/5 p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-3.5">
            <div>
              <label class="block text-xs font-bold text-slate-800 dark:text-white mb-1">
                Ingrediente de la care pornim:
              </label>
              <textarea id="asst-recipe-input" rows="2" placeholder="Scrie ingredientele tale, ex: faina 60g, oua 3 buc, lapte 250ml, piept de pui..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20 shadow-xs resize-none"></textarea>
            </div>

            <!-- Photo Import Button & Status Bar -->
            <div class="flex items-center justify-between gap-2 flex-wrap pt-0.5">
              <label for="asst-photo-input" class="cursor-pointer btn-pill btn-pill-white text-[11px] sm:text-xs py-1.5 px-3 shadow-2xs flex items-center gap-1.5 hover:border-[#A390F5] transition" title="Încarcă o poză cu o rețetă sau ingrediente">
                <svg class="w-4 h-4 text-[#6D4AE8] dark:text-[#C4B5FD]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="4" stroke-width="2"/></svg>
                <span class="font-extrabold text-slate-700 dark:text-slate-200">📸 Încarcă Poză Rețetă</span>
                <input type="file" id="asst-photo-input" accept="image/*" class="hidden">
              </label>
              <span class="text-[11px] text-slate-400">Recunoaște gramaje: <em>faina 60g, oua 3 buc</em> etc.</span>
            </div>

            <!-- Photo Processing Status Banner (hidden by default) -->
            <div id="asst-photo-status-banner" class="hidden bg-brand-lilac/10 border border-[#A390F5]/30 rounded-2xl p-3 flex items-center gap-3">
              <div class="w-6 h-6 border-2 border-[#6D4AE8] border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-bold text-[#6D4AE8] dark:text-[#C4B5FD]" id="asst-photo-status-title">Analiză imagine...</div>
                <div class="text-[10px] text-slate-500 truncate" id="asst-photo-status-desc">Extragere ingrediente și calcul rețetă</div>
              </div>
            </div>

            <!-- Quick Add from Pantry Chips -->
            <div>
              <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Apasă rapid pentru a adăuga din cămară:</div>
              <div class="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                ${pantry.map(ing => `
                  <button type="button" data-asst-pantry-chip="${ing.name}" class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white dark:bg-white/10 border border-[#E5E0F5] dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-[#A390F5] hover:text-[#6D4AE8] dark:hover:text-[#C4B5FD] transition">
                    + ${ing.name}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Controls: Portions, Meal Type, Goal -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200/60 dark:border-white/10">
              <!-- Custom Portions -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Număr Porții (Custom):</label>
                <div class="flex items-center gap-1.5">
                  <button type="button" id="btn-asst-servings-dec" class="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center font-black text-sm hover:bg-slate-100 dark:hover:bg-white/15 transition active:scale-95" title="Scade o porție">
                    −
                  </button>
                  <input type="number" id="asst-custom-servings-input" min="1" max="99" value="${currentServings}" class="w-14 sm:w-16 text-center font-black text-xs sm:text-sm bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-xl py-1.5 text-slate-900 dark:text-white focus:outline-none focus:border-[#A390F5] shadow-xs">
                  <button type="button" id="btn-asst-servings-inc" class="w-8 h-8 rounded-xl bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white flex items-center justify-center font-black text-sm hover:bg-slate-100 dark:hover:bg-white/15 transition active:scale-95" title="Adaugă o porție">
                    +
                  </button>
                  <!-- Presets -->
                  <div class="flex items-center gap-1 ml-auto">
                    ${[1, 2, 4, 6, 8].map(p => `
                      <button type="button" data-asst-preset-servings="${p}" class="px-2 py-1 rounded-lg text-[10px] font-bold transition ${p === currentServings ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319]' : 'bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400'}">
                        ${p}p
                      </button>
                    `).join('')}
                  </div>
                </div>
              </div>

              <!-- Meal Type -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Tip Masă:</label>
                <select id="asst-meal-type-select" class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-[#A390F5]">
                  <option value="Prânz" ${currentMealType === 'Prânz' ? 'selected' : ''}>Prânz</option>
                  <option value="Cină" ${currentMealType === 'Cină' ? 'selected' : ''}>Cină</option>
                  <option value="Mic Dejun" ${currentMealType === 'Mic Dejun' ? 'selected' : ''}>Mic Dejun</option>
                  <option value="Snacks" ${currentMealType === 'Snacks' ? 'selected' : ''}>Snacks / Gustare</option>
                </select>
              </div>

              <!-- Nutritional Goal -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Obiectiv Nutrițional:</label>
                <select id="asst-goal-select" class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-[#A390F5]">
                  <option value="balanced">Echilibrat & Sățios</option>
                  <option value="high_protein">High Protein 💪 (Sală / Masă)</option>
                  <option value="low_calorie">Slăbire (Deficit Caloric)</option>
                  <option value="keto">Low Carb / Keto</option>
                  <option value="budget">Buget Redus 💰</option>
                  <option value="quick">Rapid sub 20 min ⏱️</option>
                </select>
              </div>
            </div>

            <!-- Generate Button (overflow-safe with compact loading text) -->
            <button id="btn-asst-generate-recipe" type="button" class="w-full btn-pill btn-pill-primary min-h-[46px] py-2.5 px-4 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-md overflow-hidden">
              <svg class="w-4 h-4 animate-pulse text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span class="truncate max-w-full text-center">Generează Rețetă Inteligentă</span>
            </button>
          </div>

          <!-- Recipe Result Container -->
          <div id="asst-recipe-result-container" class="space-y-4">
            <div class="p-6 text-center rounded-3xl border border-dashed border-[#E5E0F5] dark:border-white/10 bg-slate-50/50 dark:bg-white/2">
              <div class="w-12 h-12 rounded-full bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center mx-auto mb-2.5">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </div>
              <h4 class="font-extrabold text-sm text-slate-800 dark:text-white">Ce gătim bun azi?</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Scrie ingredientele dorite (ex: <em>faina 60g, oua 3 buc</em>) sau încarcă o poză, iar asistentul îți va calcula automat gramajele per porție, costul și macronutrienții.</p>
            </div>
          </div>
        </div>

        <!-- ================= TAB 2: ONLINE PRODUCT SEARCH ================= -->
        <div id="asst-pane-online" class="${currentTab === 'online' ? 'block' : 'hidden'} space-y-4">
          <!-- Search Input Box -->
          <div class="bg-[#FAF9FD] dark:bg-white/5 p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-3">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <input type="text" id="asst-online-search-input" placeholder="Caută orice produs (ex: iaurt grecesc Olympus, ton bucăți, piept pui, brânză Pilos)..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full pl-11 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] shadow-xs">
                <svg class="w-4 h-4 text-slate-400 absolute left-4 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </div>
              <button id="btn-asst-do-online-search" type="button" class="btn-pill btn-pill-primary py-2.5 px-4 text-xs font-extrabold shadow flex items-center gap-1.5 whitespace-nowrap">
                <span>Caută</span>
              </button>
            </div>

            <!-- Quick Search Chips -->
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] font-bold text-slate-400">Sugestii rapide:</span>
              ${['Iaurt grecesc 10%', 'Piept de pui', 'Somon proaspăt', 'Brânză Pilos', 'Ton în suc propriu', 'Paste Barilla', 'Fulgi ovăz'].map(s => `
                <button type="button" data-asst-quick-search="${s}" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-white/10 border border-[#E5E0F5] dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#A390F5] hover:text-[#6D4AE8] transition">
                  ${s}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Online Search Results Container -->
          <div id="asst-online-results-container" class="space-y-3">
            <div class="p-8 text-center text-slate-400 text-xs">
              Introdu un produs sau alege o sugestie pentru a scoate de pe internet gramajul, prețul estimat și valorile nutriționale oficiale per 100g.
            </div>
          </div>
        </div>

        <!-- ================= TAB 3: SETTINGS & GEMINI KEY ================= -->
        <div id="asst-pane-settings" class="${currentTab === 'settings' ? 'block' : 'hidden'} space-y-4">
          <div class="bg-[#FAF9FD] dark:bg-white/5 p-5 rounded-3xl border border-[#E5E0F5] dark:border-white/10 space-y-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-brand-lilac/20 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center font-bold flex-shrink-0">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3" stroke-width="2"/></svg>
              </div>
              <div>
                <h4 class="font-extrabold text-sm sm:text-base text-slate-800 dark:text-white">Motor AI Culinar & Cheie Generativă</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400">Funcționează instant offline sau cu Gemini API</p>
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">Cheie Google Gemini API (Opțional):</label>
              <input type="password" id="asst-gemini-key-input" value="${window.nutriAssistant.geminiApiKey || ''}" placeholder="AIzaSy..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-2xl px-4 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-[#A390F5]">
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 <strong>Notă:</strong> Dacă nu introduci nicio cheie, asistentul folosește automat <em>motorul integrat de sinteză culinară</em> și baza de date a pieței din România, funcționând 100% gratuit și instantaneu.
              </p>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button id="btn-save-asst-settings" type="button" class="btn-pill btn-pill-dark text-xs py-2 px-4 shadow">
                Salvează Cheia
              </button>
            </div>
          </div>
        </div>

      </div>
    `;

    this.openModal(html, { position: 'top', height: 'h-[92dvh] sm:h-[720px]', maxWidth: 'max-w-3xl' });

    // --- Tab Switching Logic ---
    const navRecipe = document.getElementById('asst-nav-recipe');
    const navOnline = document.getElementById('asst-nav-online');
    const navSettings = document.getElementById('asst-nav-settings');
    const paneRecipe = document.getElementById('asst-pane-recipe');
    const paneOnline = document.getElementById('asst-pane-online');
    const paneSettings = document.getElementById('asst-pane-settings');

    const switchAssistantTab = (tab) => {
      currentTab = tab;
      [navRecipe, navOnline, navSettings].forEach(btn => {
        btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400';
      });
      [paneRecipe, paneOnline, paneSettings].forEach(p => p.classList.add('hidden'));

      if (tab === 'recipe') {
        navRecipe.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm';
        paneRecipe.classList.remove('hidden');
      } else if (tab === 'online') {
        navOnline.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm';
        paneOnline.classList.remove('hidden');
        document.getElementById('asst-online-search-input')?.focus();
      } else if (tab === 'settings') {
        navSettings.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm';
        paneSettings.classList.remove('hidden');
      }
    };

    navRecipe?.addEventListener('click', () => switchAssistantTab('recipe'));
    navOnline?.addEventListener('click', () => switchAssistantTab('online'));
    navSettings?.addEventListener('click', () => switchAssistantTab('settings'));

    // --- Tab 1: Recipe Generator Wireup ---
    const recipeInput = document.getElementById('asst-recipe-input');
    const resultContainer = document.getElementById('asst-recipe-result-container');
    const servingsInput = document.getElementById('asst-custom-servings-input');

    // Pantry chips click
    document.querySelectorAll('[data-asst-pantry-chip]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const val = e.currentTarget.getAttribute('data-asst-pantry-chip');
        if (recipeInput) {
          const current = recipeInput.value.trim();
          recipeInput.value = current ? `${current}, ${val}` : val;
          recipeInput.focus();
        }
      });
    });

    // Custom Servings Control (+ / - / direct input / presets)
    const updateServings = (newVal) => {
      const parsed = Math.max(1, Math.min(99, parseInt(newVal) || 1));
      currentServings = parsed;
      if (servingsInput) servingsInput.value = parsed;

      // Update preset buttons styling
      document.querySelectorAll('[data-asst-preset-servings]').forEach(b => {
        const p = parseInt(b.getAttribute('data-asst-preset-servings'));
        if (p === currentServings) {
          b.className = 'px-2 py-1 rounded-lg text-[10px] font-bold transition bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs';
        } else {
          b.className = 'px-2 py-1 rounded-lg text-[10px] font-bold transition bg-white dark:bg-white/5 border border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400';
        }
      });

      // If a recipe is currently rendered, live-recalculate it with the new servings
      if (currentGeneratedRecipe) {
        currentGeneratedRecipe.servings = currentServings;
        window.nutriAssistant.recalculateRecipe(currentGeneratedRecipe);
        renderRecipeResult(currentGeneratedRecipe);
      }
    };

    document.getElementById('btn-asst-servings-dec')?.addEventListener('click', () => {
      updateServings(currentServings - 1);
    });

    document.getElementById('btn-asst-servings-inc')?.addEventListener('click', () => {
      updateServings(currentServings + 1);
    });

    servingsInput?.addEventListener('change', (e) => {
      updateServings(e.target.value);
    });

    document.querySelectorAll('[data-asst-preset-servings]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = parseInt(e.currentTarget.getAttribute('data-asst-preset-servings')) || 2;
        updateServings(p);
      });
    });

    // Photo Import Handler (Camera or Image Upload)
    const photoInput = document.getElementById('asst-photo-input');
    const photoBanner = document.getElementById('asst-photo-status-banner');
    const photoTitle = document.getElementById('asst-photo-status-title');
    const photoDesc = document.getElementById('asst-photo-status-desc');

    photoInput?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (photoBanner) photoBanner.classList.remove('hidden');
      const updateProgress = (pct, text) => {
        if (photoTitle) photoTitle.textContent = text;
        if (photoDesc) photoDesc.textContent = `Progres: ${pct}% • Identificare ingrediente`;
      };

      try {
        const res = await window.nutriAssistant.extractRecipeFromImage(file, updateProgress);
        if (photoBanner) photoBanner.classList.add('hidden');

        if (res && res.recipe) {
          if (recipeInput && res.rawIngredientText) {
            recipeInput.value = res.rawIngredientText;
          }
          currentGeneratedRecipe = res.recipe;
          renderRecipeResult(res.recipe);
          this.showToast('Rețeta și ingredientele au fost extrase din imagine!', 'success');
        }
      } catch (err) {
        console.error('Photo recipe extraction error:', err);
        if (photoBanner) photoBanner.classList.add('hidden');
        this.showToast('Nu s-a putut citi imaginea. Te rugăm să încerci o altă poză!', 'error');
      } finally {
        photoInput.value = '';
      }
    });

    // Meal Type & Goal select
    document.getElementById('asst-meal-type-select')?.addEventListener('change', (e) => {
      currentMealType = e.target.value;
    });
    document.getElementById('asst-goal-select')?.addEventListener('change', (e) => {
      currentGoal = e.target.value;
    });

    // Generate Recipe Button (Compact loading text to prevent overflow)
    const generateBtn = document.getElementById('btn-asst-generate-recipe');
    generateBtn?.addEventListener('click', async () => {
      const text = recipeInput?.value.trim();
      if (!text) {
        this.showToast('Te rugăm să introduci cel puțin un ingredient!', 'warning');
        return;
      }

      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white flex-shrink-0" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span class="truncate max-w-full text-center">Calculez rețeta și nutrienții...</span>
      `;

      try {
        const recipe = await window.nutriAssistant.generateRecipe({
          ingredients: text,
          servings: currentServings,
          mealType: currentMealType,
          goal: currentGoal
        });

        currentGeneratedRecipe = recipe;
        renderRecipeResult(recipe);
      } catch (err) {
        console.error('Recipe generation error:', err);
        this.showToast('A apărut o eroare la generare. Încearcă din nou!', 'error');
      } finally {
        generateBtn.disabled = false;
        generateBtn.innerHTML = `
          <svg class="w-4 h-4 animate-pulse text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span class="truncate max-w-full text-center">Generează Rețetă Inteligentă</span>
        `;
      }
    });

    const renderRecipeResult = (recipe) => {
      if (!resultContainer) return;

      resultContainer.innerHTML = `
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-4 sm:p-5 space-y-4 shadow-md">
          
          <!-- Recipe Header & Editable Name -->
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <span class="pill-badge pill-badge-translucent">${recipe.category}</span>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">⏱️ ${recipe.prepTime}</span>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">• Dificultate: ${recipe.difficulty}</span>
              </div>
              <div class="flex items-center gap-2">
                <button id="btn-asst-save-recipe" type="button" class="btn-pill btn-pill-dark text-xs py-1.5 px-3.5 shadow flex items-center gap-1.5 whitespace-nowrap">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                  <span>Salvează în Rețetar</span>
                </button>
                <button id="btn-asst-add-to-plan" type="button" class="btn-pill btn-pill-primary text-xs py-1.5 px-3.5 shadow flex items-center gap-1.5 whitespace-nowrap">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                  <span>+ În Plan (${this.activeDay})</span>
                </button>
              </div>
            </div>

            <!-- Editable Recipe Name Input -->
            <div>
              <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Nume Rețetă (Editabil):</label>
              <input type="text" id="asst-recipe-edit-name" value="${recipe.name}" class="w-full bg-slate-50 dark:bg-[#121319] border border-[#E5E0F5] dark:border-white/10 rounded-xl px-3.5 py-2 font-black text-base sm:text-lg text-slate-900 dark:text-white focus:outline-none focus:border-[#A390F5] shadow-xs" placeholder="Numele rețetei...">
            </div>
            ${recipe.chefTips ? `<p class="text-xs text-brand-lilac-dark dark:text-[#C4B5FD] font-semibold">✨ ${recipe.chefTips}</p>` : ''}
          </div>

          <!-- Nutritional & Cost Bento Grid (Live Recalculated) -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center" id="asst-recipe-macro-bento">
            <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
              <div class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Cost / Porție</div>
              <div class="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">${recipe.perServing.cost.toFixed(2)} <span class="text-xs">RON</span></div>
              <div class="text-[10px] text-emerald-600/70 mt-0.5">Total: ${recipe.totals.cost.toFixed(2)} RON</div>
            </div>
            <div class="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-500/20">
              <div class="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Calorii</div>
              <div class="text-base sm:text-lg font-black text-[#6D4AE8] dark:text-[#C4B5FD] mt-0.5">${recipe.perServing.calories} <span class="text-xs">kcal</span></div>
              <div class="text-[10px] text-indigo-500/70 mt-0.5">Total: ${recipe.totals.calories} kcal</div>
            </div>
            <div class="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20">
              <div class="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase">Proteine</div>
              <div class="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">${recipe.perServing.protein} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-rose-500/70 mt-0.5">Total: ${recipe.totals.protein}g</div>
            </div>
            <div class="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20">
              <div class="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Carbohidrați</div>
              <div class="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">${recipe.perServing.carbs} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-amber-500/70 mt-0.5">Total: ${recipe.totals.carbs}g</div>
            </div>
            <div class="bg-sky-50 dark:bg-sky-500/10 p-2.5 rounded-2xl border border-sky-500/20 col-span-2 sm:col-span-1">
              <div class="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase">Grăsimi</div>
              <div class="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400 mt-0.5">${recipe.perServing.fat} <span class="text-xs">g</span></div>
              <div class="text-[10px] text-sky-500/70 mt-0.5">Total: ${recipe.totals.fat}g</div>
            </div>
          </div>

          <!-- Fully Editable Ingredients List with Grammages -->
          <div class="space-y-2.5">
            <div class="text-xs font-extrabold text-slate-800 dark:text-white flex items-center justify-between">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span>Ingrediente & Gramaje Exacte:</span>
                <span class="text-[10px] font-bold text-[#6D4AE8] dark:text-[#C4B5FD] bg-[#6D4AE8]/10 px-2 py-0.5 rounded-full">Poți edita orice cantitate</span>
              </div>
              <span class="text-[11px] font-bold text-slate-400" id="asst-servings-badge">${recipe.servings} ${recipe.servings === 1 ? 'porție' : 'porții'}</span>
            </div>

            <div id="asst-ingredients-table" class="divide-y divide-slate-100 dark:divide-white/5 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden">
              ${recipe.ingredients.map((ing, idx) => `
                <div class="p-2.5 sm:p-3 flex items-center justify-between gap-2 text-xs" data-ing-row="${idx}">
                  <div class="flex-1 min-w-0">
                    <div class="font-extrabold text-slate-800 dark:text-white truncate">${ing.name}</div>
                    <div class="text-[11px] text-slate-400">(${ing.gramsPerServing}g / porție • ${ing.costTotal.toFixed(2)} RON)</div>
                  </div>
                  <div class="flex items-center gap-1.5 flex-shrink-0">
                    <input type="number" min="1" step="5" data-asst-edit-qty="${idx}" value="${ing.totalGrams}" class="w-16 sm:w-20 px-2 py-1 text-center font-black text-xs sm:text-sm bg-white dark:bg-[#121319] border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[#A390F5] shadow-2xs">
                    <span class="text-xs font-bold text-slate-500 dark:text-slate-400">g total</span>
                    <button type="button" data-asst-delete-ing="${idx}" class="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition ml-1" title="Șterge ingredient">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Add New Ingredient Row -->
            <div class="flex items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-white/3 rounded-xl border border-dashed border-slate-200 dark:border-white/10 w-full max-w-full box-border overflow-hidden">
              <input type="text" id="asst-add-new-ing-input" placeholder="Adaugă ingredient nou (ex: 50g nuci, 3 oua)..." class="flex-1 min-w-0 bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5]">
              <button type="button" id="btn-asst-add-ing-row" class="btn-pill btn-pill-white text-xs py-1.5 px-2.5 sm:px-3 font-bold shadow-xs whitespace-nowrap flex-shrink-0 flex items-center gap-1 hover:border-[#A390F5]">
                <svg class="w-3.5 h-3.5 text-[#6D4AE8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                <span>Adaugă</span>
              </button>
            </div>
          </div>

          <!-- Step by Step Instructions -->
          <div class="space-y-2">
            <div class="text-xs font-extrabold text-slate-800 dark:text-white">Mod de Preparare Pas cu Pas:</div>
            <div class="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-[#FAF9FD] dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10">
              ${recipe.instructions.map(step => `
                <p class="py-0.5">${step}</p>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Live Title Sync
      document.getElementById('asst-recipe-edit-name')?.addEventListener('input', (e) => {
        recipe.name = e.target.value;
      });

      // Live Ingredient Quantity Edit Listeners
      document.querySelectorAll('[data-asst-edit-qty]').forEach(inp => {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-asst-edit-qty'));
          const newQty = Math.max(1, parseFloat(e.target.value) || 0);
          if (recipe.ingredients[idx]) {
            recipe.ingredients[idx].quantityGrams = newQty;
            recipe.ingredients[idx].totalGrams = newQty;
            window.nutriAssistant.recalculateRecipe(recipe);

            // Update row text
            const row = document.querySelector(`[data-ing-row="${idx}"]`);
            if (row) {
              const sub = row.querySelector('.text-\\[11px\\]');
              if (sub) {
                sub.textContent = `(${recipe.ingredients[idx].gramsPerServing}g / porție • ${recipe.ingredients[idx].costTotal.toFixed(2)} RON)`;
              }
            }

            // Update macro bento
            const bento = document.getElementById('asst-recipe-macro-bento');
            if (bento) {
              bento.innerHTML = `
                <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-500/20">
                  <div class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">Cost / Porție</div>
                  <div class="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5">${recipe.perServing.cost.toFixed(2)} <span class="text-xs">RON</span></div>
                  <div class="text-[10px] text-emerald-600/70 mt-0.5">Total: ${recipe.totals.cost.toFixed(2)} RON</div>
                </div>
                <div class="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-500/20">
                  <div class="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 uppercase">Calorii</div>
                  <div class="text-base sm:text-lg font-black text-[#6D4AE8] dark:text-[#C4B5FD] mt-0.5">${recipe.perServing.calories} <span class="text-xs">kcal</span></div>
                  <div class="text-[10px] text-indigo-500/70 mt-0.5">Total: ${recipe.totals.calories} kcal</div>
                </div>
                <div class="bg-rose-50 dark:bg-rose-500/10 p-2.5 rounded-2xl border border-rose-500/20">
                  <div class="text-[10px] font-bold text-rose-800 dark:text-rose-300 uppercase">Proteine</div>
                  <div class="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">${recipe.perServing.protein} <span class="text-xs">g</span></div>
                  <div class="text-[10px] text-rose-500/70 mt-0.5">Total: ${recipe.totals.protein}g</div>
                </div>
                <div class="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-2xl border border-amber-500/20">
                  <div class="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">Carbohidrați</div>
                  <div class="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">${recipe.perServing.carbs} <span class="text-xs">g</span></div>
                  <div class="text-[10px] text-amber-500/70 mt-0.5">Total: ${recipe.totals.carbs}g</div>
                </div>
                <div class="bg-sky-50 dark:bg-sky-500/10 p-2.5 rounded-2xl border border-sky-500/20 col-span-2 sm:col-span-1">
                  <div class="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase">Grăsimi</div>
                  <div class="text-base sm:text-lg font-black text-sky-600 dark:text-sky-400 mt-0.5">${recipe.perServing.fat} <span class="text-xs">g</span></div>
                  <div class="text-[10px] text-sky-500/70 mt-0.5">Total: ${recipe.totals.fat}g</div>
                </div>
              `;
            }
          }
        });
      });

      // Delete Ingredient Listeners
      document.querySelectorAll('[data-asst-delete-ing]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.currentTarget.getAttribute('data-asst-delete-ing'));
          if (recipe.ingredients.length <= 1) {
            this.showToast('Rețeta trebuie să aibă cel puțin un ingredient!', 'warning');
            return;
          }
          recipe.ingredients.splice(idx, 1);
          window.nutriAssistant.recalculateRecipe(recipe);
          renderRecipeResult(recipe);
          this.showToast('Ingredient eliminat din rețetă.', 'info');
        });
      });

      // Add New Ingredient Row Listener
      const newIngInput = document.getElementById('asst-add-new-ing-input');
      const addIngBtn = document.getElementById('btn-asst-add-ing-row');
      const handleAddNewIng = () => {
        const val = newIngInput?.value.trim();
        if (!val) return;

        const parsedToken = window.nutriAssistant.parseIngredientToken(val, recipe.servings);
        if (!parsedToken) return;

        let matched = window.store ? window.store.findIngredientByName(parsedToken.name) : null;
        let est = window.nutriAssistant.estimateMarketData(parsedToken.name);

        const ingName = matched ? matched.name : parsedToken.name;
        const totalQty = parsedToken.explicitGrams !== null ? parsedToken.explicitGrams : Math.round(100 * recipe.servings);

        recipe.ingredients.push({
          name: ingName,
          quantityGrams: totalQty,
          totalGrams: totalQty,
          gramsPerServing: Math.max(1, Math.round(totalQty / recipe.servings)),
          calories100g: matched ? matched.calories : est.calories,
          protein100g: matched ? matched.protein : est.protein,
          carbs100g: matched ? matched.carbs : est.carbs,
          fat100g: matched ? matched.fat : est.fat,
          pricePer100g: matched ? matched.pricePer100g : est.pricePer100g,
          category: matched ? matched.category : est.category,
          existingId: matched ? matched.id : null
        });

        window.nutriAssistant.recalculateRecipe(recipe);
        renderRecipeResult(recipe);
        this.showToast(`Adăugat: ${ingName} (${totalQty}g)`, 'success');
      };

      addIngBtn?.addEventListener('click', handleAddNewIng);
      newIngInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleAddNewIng();
        }
      });

      // Save to store button click
      document.getElementById('btn-asst-save-recipe')?.addEventListener('click', (e) => {
        const editName = document.getElementById('asst-recipe-edit-name')?.value.trim();
        if (editName) recipe.name = editName;

        const saved = window.nutriAssistant.saveRecipeToStore(recipe);
        if (saved) {
          e.currentTarget.disabled = true;
          e.currentTarget.className = 'btn-pill bg-emerald-600 text-white text-xs py-1.5 px-3.5 shadow whitespace-nowrap cursor-default flex items-center gap-1.5';
          e.currentTarget.innerHTML = `<span>✓ Salvat în Rețetar</span>`;
          this.showToast(`Rețeta "${saved.name}" a fost salvată în Rețetar!`, 'success');
        }
      });

      // Add to current day plan
      document.getElementById('btn-asst-add-to-plan')?.addEventListener('click', (e) => {
        const editName = document.getElementById('asst-recipe-edit-name')?.value.trim();
        if (editName) recipe.name = editName;

        let saved = window.store.getRecipes().find(r => r.name === recipe.name);
        if (!saved) {
          saved = window.nutriAssistant.saveRecipeToStore(recipe);
        }
        if (saved) {
          window.store.addPlanItem(this.activeDay, recipe.category || 'Prânz', saved.id, 1.0);
          e.currentTarget.disabled = true;
          e.currentTarget.className = 'btn-pill bg-emerald-600 text-white text-xs py-1.5 px-3.5 shadow whitespace-nowrap cursor-default flex items-center gap-1.5';
          e.currentTarget.innerHTML = `<span>✓ Adăugat la ${this.activeDay}</span>`;
          this.showToast(`Adăugat cu succes în planul de ${this.activeDay}!`, 'success');
        }
      });
    };


    // --- Tab 2: Online Search Wireup ---
    const onlineInput = document.getElementById('asst-online-search-input');
    const onlineSearchBtn = document.getElementById('btn-asst-do-online-search');
    const onlineResultsContainer = document.getElementById('asst-online-results-container');

    const executeOnlineSearch = async (query) => {
      if (!query || !query.trim()) return;
      if (!onlineResultsContainer) return;

      onlineResultsContainer.innerHTML = `
        <div class="p-8 text-center space-y-3">
          <svg class="w-8 h-8 animate-spin text-[#6D4AE8] mx-auto" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <div class="text-xs font-extrabold text-slate-800 dark:text-white">Căutăm pe internet gramaje, prețuri și valori nutriționale...</div>
          <div class="text-[11px] text-slate-400">Interogare Open Food Facts & Baza de piață România</div>
        </div>
      `;

      try {
        const results = await window.nutriAssistant.searchOnlineProducts(query);
        renderOnlineResults(results);
      } catch (err) {
        console.error('Online search error:', err);
        onlineResultsContainer.innerHTML = `
          <div class="p-6 text-center text-rose-500 text-xs">
            Nu s-au putut prelua rezultatele. Te rugăm să verifici conexiunea la internet sau să încerci alt termen.
          </div>
        `;
      }
    };

    onlineSearchBtn?.addEventListener('click', () => {
      executeOnlineSearch(onlineInput?.value);
    });
    onlineInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeOnlineSearch(onlineInput.value);
      }
    });

    document.querySelectorAll('[data-asst-quick-search]').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const term = e.currentTarget.getAttribute('data-asst-quick-search');
        if (onlineInput) onlineInput.value = term;
        executeOnlineSearch(term);
      });
    });

    const renderOnlineResults = (results) => {
      if (!onlineResultsContainer) return;

      if (!results || results.length === 0) {
        onlineResultsContainer.innerHTML = `
          <div class="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-white/5 rounded-2xl">
            Nu am găsit produse pentru căutarea efectuată. Încearcă un termen mai simplu (ex: "iaurt", "pui", "orez").
          </div>
        `;
        return;
      }

      onlineResultsContainer.innerHTML = `
        <div class="space-y-3">
          <div class="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
            <span>Rezultate găsite (${results.length}):</span>
            <span class="text-[10px]">Valori oficiale per 100g</span>
          </div>

          <div class="grid grid-cols-1 gap-3">
            ${results.map((prod, idx) => `
              <div class="bg-white dark:bg-[#181924] p-4 rounded-3xl border border-[#E5E0F5] dark:border-white/10 shadow-xs space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-center gap-3">
                    ${prod.imageUrl ? `
                      <img src="${prod.imageUrl}" alt="${prod.name}" class="w-12 h-12 object-contain rounded-xl border border-slate-100 dark:border-white/10 bg-white p-0.5 flex-shrink-0" onerror="this.style.display='none'">
                    ` : `
                      <div class="w-12 h-12 rounded-xl bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center font-bold text-lg flex-shrink-0">
                        🛒
                      </div>
                    `}
                    <div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="pill-badge pill-badge-translucent text-[10px]">${prod.category}</span>
                        ${prod.brand ? `<span class="text-[10px] font-bold text-slate-400">${prod.brand}</span>` : ''}
                        ${prod.ean ? `<span class="text-[9px] font-mono bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-slate-500">EAN: ${prod.ean}</span>` : ''}
                      </div>
                      <h5 class="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">${prod.name}</h5>
                    </div>
                  </div>

                  <!-- Gramaj Pachet -->
                  <div class="text-right flex-shrink-0">
                    <span class="text-xs font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-full">
                      Pachet: ${prod.packageQuantity}g
                    </span>
                  </div>
                </div>

                <!-- Price & Macronutrient Bar -->
                <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center pt-2 border-t border-slate-100 dark:border-white/5">
                  <div class="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 col-span-2 sm:col-span-1">
                    <div class="text-[10px] font-bold text-emerald-800 dark:text-emerald-300">Preț Pachet</div>
                    <div class="flex items-center justify-center gap-1 mt-0.5">
                      <input type="number" step="0.5" id="asst-edit-price-${idx}" value="${prod.packagePrice}" class="w-14 text-center font-black text-xs sm:text-sm bg-white dark:bg-[#181924] border border-emerald-500/30 rounded-lg py-0.5 text-emerald-700 dark:text-emerald-400">
                      <span class="text-xs font-bold text-emerald-700">RON</span>
                    </div>
                  </div>
                  <div class="bg-indigo-50 dark:bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20">
                    <div class="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">Calorii / 100g</div>
                    <div class="text-xs sm:text-sm font-black text-[#6D4AE8] dark:text-[#C4B5FD] mt-0.5">${prod.calories} kcal</div>
                  </div>
                  <div class="bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl border border-rose-500/20">
                    <div class="text-[10px] font-bold text-rose-700 dark:text-rose-300">Proteine</div>
                    <div class="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 mt-0.5">${prod.protein}g</div>
                  </div>
                  <div class="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    <div class="text-[10px] font-bold text-amber-700 dark:text-amber-300">Carbi</div>
                    <div class="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">${prod.carbs}g</div>
                  </div>
                  <div class="bg-sky-50 dark:bg-sky-500/10 p-2 rounded-xl border border-sky-500/20">
                    <div class="text-[10px] font-bold text-sky-700 dark:text-sky-300">Grăsimi</div>
                    <div class="text-xs sm:text-sm font-black text-sky-600 dark:text-sky-400 mt-0.5">${prod.fat}g</div>
                  </div>
                </div>

                <!-- Action Buttons: Perfectly Centered & Responsive -->
                <div class="flex items-center justify-center gap-2 pt-2.5 border-t border-slate-100 dark:border-white/5 w-full">
                  <button type="button" data-asst-add-to-recipe="${idx}" class="flex-1 sm:flex-initial sm:min-w-[150px] btn-pill btn-pill-white text-xs py-2 px-2.5 shadow-2xs flex items-center justify-center gap-1.5 min-w-0 transition">
                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    <span class="truncate">Folosește în Rețetă</span>
                  </button>
                  <button type="button" data-asst-save-db="${idx}" class="flex-1 sm:flex-initial sm:min-w-[150px] btn-pill btn-pill-dark text-xs py-2 px-2.5 shadow flex items-center justify-center gap-1.5 min-w-0 transition">
                    <svg class="w-3.5 h-3.5 text-[#70D6A3] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"/></svg>
                    <span class="truncate">Salvează în Cămară</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      // Wire save to DB
      results.forEach((prod, idx) => {
        const saveBtn = document.querySelector(`[data-asst-save-db="${idx}"]`);
        saveBtn?.addEventListener('click', () => {
          const editedPriceInput = document.getElementById(`asst-edit-price-${idx}`);
          const finalPrice = editedPriceInput ? (parseFloat(editedPriceInput.value) || prod.packagePrice) : prod.packagePrice;

          const savedIng = window.store.addIngredient({
            name: prod.name,
            category: prod.category,
            packageQuantity: prod.packageQuantity,
            packagePrice: finalPrice,
            calories: prod.calories,
            protein: prod.protein,
            carbs: prod.carbs,
            fat: prod.fat,
            ean: prod.ean
          });

          if (savedIng) {
            saveBtn.disabled = true;
            saveBtn.className = 'flex-1 sm:flex-initial sm:min-w-[150px] btn-pill bg-emerald-600 text-white text-xs py-2 px-2.5 shadow cursor-default flex items-center justify-center gap-1.5 min-w-0';
            saveBtn.innerHTML = `<span>✓ Salvat în Cămară</span>`;
            this.showToast(`"${prod.name}" a fost adăugat în baza de ingrediente!`, 'success');
          }
        });

        const useInRecipeBtn = document.querySelector(`[data-asst-add-to-recipe="${idx}"]`);
        useInRecipeBtn?.addEventListener('click', () => {
          switchAssistantTab('recipe');
          if (recipeInput) {
            const current = recipeInput.value.trim();
            recipeInput.value = current ? `${current}, ${prod.name}` : prod.name;
            recipeInput.focus();
          }
        });
      });
    };

    // --- Tab 3: Settings Wireup ---
    document.getElementById('btn-save-asst-settings')?.addEventListener('click', () => {
      const keyInput = document.getElementById('asst-gemini-key-input');
      const val = keyInput?.value.trim() || '';
      window.nutriAssistant.geminiApiKey = val;
      localStorage.setItem('nutri_gemini_key', val);
      this.showToast(val ? 'Cheia Gemini API a fost salvată!' : 'Cheia a fost ștearsă (folosește motorul integrat).', 'success');
    });
  }
}


// Bootstrap app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NutriApp();
});
