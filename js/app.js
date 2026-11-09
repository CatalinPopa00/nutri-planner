// Main Application Controller & UI Logic
class NutriApp {
  constructor() {
    this.currentTab = 'planner'; // 'planner' | 'recipes' | 'ingredients' | 'scan' | 'analytics'
    this.activeDay = 'Luni';
    this.scanSubTab = 'ean'; // 'ean' | 'receipt'
    this.recipeFilterCategory = 'Toate';
    this.recipeSearch = '';
    this.ingFilterCategory = 'Toate';
    this.ingSearch = '';
    this.ingSortBy = 'name';
    this.dailyCalorieTarget = window.store ? window.store.getTargets().calories : 2000;

    this.editingRecipe = null;
    this.editingIngredient = null;
    this.activeModal = null;

    this.init();
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

    this.bindEvents();
    window.store.subscribe(() => {
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
          el.className = 'px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-2 text-[#121319] bg-white dark:bg-white dark:text-[#121319] shadow-sm';
        } else {
          el.className = 'px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-2';
        }
      }
    });

    // Stop camera if leaving scanner
    if (tab !== 'scan' && window.barcodeScanner) {
      window.barcodeScanner.stopCamera();
    }

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
      default:
        main.innerHTML = this.renderPlannerView();
    }
  }

  // ==========================================
  // 1. WEEKLY PLANNER VIEW
  // ==========================================
  renderPlannerView() {
    const weekData = window.store.calculateWeek();
    const dayDefinitions = [
      { id: 'Luni', short: 'Lun', dateNum: '24' },
      { id: 'Marți', short: 'Mar', dateNum: '25' },
      { id: 'Miercuri', short: 'Mie', dateNum: '26' },
      { id: 'Joi', short: 'Joi', dateNum: '27' },
      { id: 'Vineri', short: 'Vin', dateNum: '28' },
      { id: 'Sâmbătă', short: 'Sâm', dateNum: '29' },
      { id: 'Duminică', short: 'Dum', dateNum: '30' }
    ];
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

        <!-- Floating Day Navigator (Shows ONLY current day + Swipe Support) -->
        <div class="sticky top-18 z-30 flex justify-center py-2 pointer-events-none">
          <div id="floating-day-nav" class="pointer-events-auto inline-flex items-center gap-1 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/95 dark:bg-[#181924]/95 backdrop-blur-xl rounded-full shadow-lg border border-[#E5E0F5] dark:border-white/10 select-none transition-all">
            <!-- Prev Day Arrow (<) -->
            <button id="btn-day-prev" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition" title="Ziua anterioară (sau swipe spre dreapta)">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/></svg>
            </button>

            <!-- Current Day Name & Badge (Click to open day picker) -->
            <button id="btn-open-day-picker" class="flex items-center gap-2 px-2.5 py-1 rounded-full hover:bg-slate-100 dark:hover:bg-white/5 active:scale-98 transition" title="Apasă pentru selector rapid de zile">
              <span class="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#A390F5] to-[#FF6FA4] animate-pulse"></span>
              <span class="text-sm sm:text-base font-extrabold font-display tracking-tight text-slate-900 dark:text-white">
                ${this.activeDay === 'ALL' ? 'Toată Săptămâna' : (activeDayDef ? activeDayDef.id : this.activeDay)}
              </span>
              ${this.activeDay === 'ALL' ? `
                <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                  7 Zile
                </span>
              ` : `
                <span class="text-[11px] font-bold text-[#6D4AE8] dark:text-[#C4B5FD] bg-brand-lilac/15 px-2 py-0.5 rounded-full">
                  ${activeDayDef ? `${activeDayDef.dateNum} Noi` : ''}
                </span>
              `}
            </button>

            <!-- Next Day Arrow (>) -->
            <button id="btn-day-next" class="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 transition" title="Ziua următoare (sau swipe spre stânga)">
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
                              <span class="font-extrabold text-sm text-slate-900 dark:text-white truncate leading-snug">${item.recipeName}</span>
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

                          <!-- Portions control, Copy item & Delete -->
                          <div class="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/10 flex-shrink-0">
                            <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-full p-1">
                              <button data-portion-minus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="${item.isIngredient ? 'Scade 50g' : 'Scade 0.5 porții'}">
                                −
                              </button>
                              <span class="text-xs font-extrabold text-slate-800 dark:text-white px-2 min-w-[2.4rem] text-center">${item.isIngredient ? (item.portions * 100) + 'g' : item.portions}</span>
                              <button data-portion-plus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="${item.isIngredient ? 'Crește 50g' : 'Crește 0.5 porții'}">
                                +
                              </button>
                            </div>
                            <div class="flex items-center gap-1">
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
    const dayDefinitions = [
      { id: 'Luni', short: 'Lun', dateNum: '24' },
      { id: 'Marți', short: 'Mar', dateNum: '25' },
      { id: 'Miercuri', short: 'Mie', dateNum: '26' },
      { id: 'Joi', short: 'Joi', dateNum: '27' },
      { id: 'Vineri', short: 'Vin', dateNum: '28' },
      { id: 'Sâmbătă', short: 'Sâm', dateNum: '29' },
      { id: 'Duminică', short: 'Dum', dateNum: '30' }
    ];
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
                    <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500">${d.dateNum} Noiembrie</span>
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
      document.getElementById('floating-day-nav')
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

    // Portion plus / minus
    document.querySelectorAll('[data-portion-minus]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-portion-minus');
        const item = (window.store.data.weeklyPlan[this.activeDay] || []).find(i => i.id === itemId);
        if (item && item.servings > 0.5) {
          window.store.updatePlanItemServings(this.activeDay, itemId, item.servings - 0.5);
        }
      });
    });

    document.querySelectorAll('[data-portion-plus]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.currentTarget.getAttribute('data-portion-plus');
        const item = (window.store.data.weeklyPlan[this.activeDay] || []).find(i => i.id === itemId);
        if (item) {
          window.store.updatePlanItemServings(this.activeDay, itemId, item.servings + 0.5);
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
    const recipes = window.store.getRecipes(this.recipeFilterCategory, this.recipeSearch);

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
          <div class="flex items-center gap-2 flex-wrap">
            <button id="btn-open-assistant-recipes" class="btn-pill btn-pill-primary text-xs sm:text-sm shadow flex items-center gap-2">
              <svg class="w-4 h-4 animate-pulse text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Asistent AI Rețete</span>
            </button>
            <button id="btn-create-recipe" class="btn-pill btn-pill-dark text-xs sm:text-sm shadow">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
              <span>+ Rețetă Manuală</span>
            </button>
          </div>
        </div>

        <!-- Search & Filter Category Pills -->
        <div class="space-y-3">
          <div class="relative">
            <input type="text" id="recipe-search-input" value="${this.recipeSearch}" placeholder="Caută rețetă după nume..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full pl-11 pr-5 py-3 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20 shadow-xs transition">
            <svg class="w-4 h-4 text-slate-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            ${categories.map(cat => `
              <button data-recipe-cat="${cat}" class="flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition ${
                this.recipeFilterCategory === cat
                  ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
                  : 'bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#A390F5]'
              }">
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Recipes Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${recipes.length === 0 ? `
            <div class="col-span-full text-center py-12 bento-card bento-white border-2 border-dashed border-[#E5E0F5] dark:border-white/10">
              <svg class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">Nu s-a găsit nicio rețetă.</p>
              <button id="btn-reset-recipes-filter" class="mt-2 text-xs text-[#6D4AE8] dark:text-[#C4B5FD] font-bold hover:underline">Resetează filtrele</button>
            </div>
          ` : recipes.map(rawRecipe => {
            const r = window.store.calculateRecipe(rawRecipe);
            return `
              <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <!-- Card Header -->
                  <div class="p-5 border-b border-slate-100 dark:border-white/5 flex items-start justify-between gap-3">
                    <div>
                      <span class="pill-badge pill-badge-translucent mb-1">
                        ${r.category}
                      </span>
                      <h4 class="font-extrabold font-display text-lg text-slate-900 dark:text-white mt-1 leading-snug">${r.name}</h4>
                      <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        ${r.servings} ${r.servings === 1 ? 'porție' : 'porții'} • ${Math.round(r.totals.weight)}g total
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <div class="pill-badge bg-[#70D6A3]/20 text-[#218352] dark:text-[#70D6A3] font-black text-sm px-3 py-1">
                        ${r.perServing.cost.toFixed(2)} RON
                      </div>
                      <div class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">per porție</div>
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

                <!-- Card Footer Actions -->
                <div class="p-3.5 bg-slate-50/80 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                  <button data-recipe-details="${r.id}" class="btn-pill btn-pill-white text-xs py-1.5 px-3">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Tabel & Cost
                  </button>
                  <div class="flex items-center gap-1.5">
                    <button data-recipe-plan="${r.id}" class="btn-pill btn-pill-dark text-xs py-1.5 px-3" title="Adaugă în planificator">
                      + Planifică
                    </button>
                    <button data-recipe-edit="${r.id}" class="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition" title="Editează">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button data-recipe-delete="${r.id}" class="p-2 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Șterge">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
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

                <!-- Right Side: Servings Stepper & Quick Add Button -->
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <div class="flex items-center bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-xl p-0.5" onclick="event.stopPropagation()">
                    <button type="button" data-meal-minus="${it.id}" class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition">−</button>
                    <span data-meal-servings-text="${it.id}" class="text-xs font-extrabold min-w-[2rem] text-center text-slate-800 dark:text-white">${servings}</span>
                    <button type="button" data-meal-plus="${it.id}" class="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 transition">+</button>
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
          if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return;
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

      // Portion minus
      container?.querySelectorAll('[data-meal-minus]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-meal-minus');
          const cur = servingsMap.get(id) || 1.0;
          const updated = Math.max(0.5, Math.round((cur - 0.5) * 10) / 10);
          servingsMap.set(id, updated);
          if (selectedMap.has(id)) {
            selectedMap.get(id).servings = updated;
          }
          const textEl = container.querySelector(`[data-meal-servings-text="${id}"]`);
          if (textEl) textEl.textContent = updated;
        });
      });

      // Portion plus
      container?.querySelectorAll('[data-meal-plus]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-meal-plus');
          const cur = servingsMap.get(id) || 1.0;
          const updated = Math.round((cur + 0.5) * 10) / 10;
          servingsMap.set(id, updated);
          if (selectedMap.has(id)) {
            selectedMap.get(id).servings = updated;
          }
          const textEl = container.querySelector(`[data-meal-servings-text="${id}"]`);
          if (textEl) textEl.textContent = updated;
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
        <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
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

      <!-- Fixed Footer -->
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex justify-end bg-white dark:bg-[#181924]">
        <button data-modal-close="true" class="btn-pill btn-pill-outline text-xs">
          Închide
        </button>
      </div>
    `;

    this.openModal(html);
  }

  // --- Modal: Recipe Builder (Create / Edit) ---
  openRecipeBuilderModal(existingRecipe = null) {
    const isEdit = !!existingRecipe;
    const allIngredients = window.store.getIngredients();
    const categories = window.INITIAL_DATA.recipeCategories?.filter(c => c !== 'Toate') || ['Mese Mari', 'Snacks / Mic Dejun'];

    // Temporary list of recipe ingredients
    let curIngredients = existingRecipe
      ? JSON.parse(JSON.stringify(existingRecipe.ingredients || []))
      : [
          { ingredientId: allIngredients[0]?.id || '', name: allIngredients[0]?.name || '', quantity: 200 }
        ];

    let servings = existingRecipe?.servings || 1;

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

        <!-- 2-Column Grid: Categorie & Număr Porții -->
        <div class="grid grid-cols-2 gap-3">
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
      <div class="flex-shrink-0 p-3 sm:p-4 border-t border-[#E5E0F5] dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#181924]">
        <div class="min-w-0 pr-2">
          <div class="text-[10px] text-slate-400 dark:text-white/40 uppercase font-bold">Total estimat</div>
          <div id="builder-total-cost" class="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 truncate">
            0.00 RON
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button data-modal-close="true" class="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition">
            Anulează
          </button>
          <button id="btn-builder-save" class="btn-pill btn-pill-primary text-xs py-2 px-3.5 sm:px-4 shadow-sm">
            ${isEdit ? 'Salvează' : 'Creează'}
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
          ingredients: curIngredients
        });
        this.showToast(`Rețeta "${name}" a fost actualizată!`, 'success');
      } else {
        window.store.addRecipe({
          name,
          category: cat,
          servings: finalServings,
          ingredients: curIngredients
        });
        this.showToast(`Rețeta "${name}" a fost salvată cu succes!`, 'success');
      }

      this.closeModal();
    });
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
              <textarea id="asst-recipe-input" rows="2" placeholder="Scrie ingredientele tale, ex: piept de pui, orez basmati, ciuperci, smântână de gătit..." class="w-full bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-2xl p-3 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20 shadow-xs resize-none"></textarea>
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
              <!-- Portions -->
              <div>
                <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Număr Porții:</label>
                <div class="flex items-center gap-1" id="asst-portions-group">
                  ${[1, 2, 3, 4, 6].map(p => `
                    <button type="button" data-asst-servings="${p}" class="flex-1 py-1.5 rounded-xl text-xs font-bold transition ${p === currentServings ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs' : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'}">
                      ${p}
                    </button>
                  `).join('')}
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

            <!-- Generate Button -->
            <button id="btn-asst-generate-recipe" type="button" class="w-full btn-pill btn-pill-primary py-3 text-sm font-extrabold flex items-center justify-center gap-2 shadow-md">
              <svg class="w-4 h-4 animate-pulse text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              <span>Generează Rețetă Inteligentă</span>
            </button>
          </div>

          <!-- Recipe Result Container -->
          <div id="asst-recipe-result-container" class="space-y-4">
            <div class="p-6 text-center rounded-3xl border border-dashed border-[#E5E0F5] dark:border-white/10 bg-slate-50/50 dark:bg-white/2">
              <div class="w-12 h-12 rounded-full bg-brand-lilac/15 text-[#6D4AE8] dark:text-[#C4B5FD] flex items-center justify-center mx-auto mb-2.5">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </div>
              <h4 class="font-extrabold text-sm text-slate-800 dark:text-white">Ce gătim bun azi?</h4>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Scrie mai sus ce ingrediente ai la dispoziție sau alege din cămară, iar asistentul îți va calcula automat gramajele per porție, costul și toți macronutrienții.</p>
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

    // Portion buttons
    document.querySelectorAll('[data-asst-servings]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentServings = parseInt(e.currentTarget.getAttribute('data-asst-servings')) || 2;
        document.querySelectorAll('[data-asst-servings]').forEach(b => {
          b.className = 'flex-1 py-1.5 rounded-xl text-xs font-bold transition bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400';
        });
        e.currentTarget.className = 'flex-1 py-1.5 rounded-xl text-xs font-bold transition bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-xs';
      });
    });

    // Meal Type & Goal select
    document.getElementById('asst-meal-type-select')?.addEventListener('change', (e) => {
      currentMealType = e.target.value;
    });
    document.getElementById('asst-goal-select')?.addEventListener('change', (e) => {
      currentGoal = e.target.value;
    });

    // Generate Recipe Button
    const generateBtn = document.getElementById('btn-asst-generate-recipe');
    generateBtn?.addEventListener('click', async () => {
      const text = recipeInput?.value.trim();
      if (!text) {
        this.showToast('Te rugăm să introduci cel puțin un ingredient!', 'warning');
        return;
      }

      generateBtn.disabled = true;
      generateBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span>NutriChef calculează rețeta, gramajele și costul...</span>
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
          <svg class="w-4 h-4 animate-pulse text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <span>Generează Rețetă Inteligentă</span>
        `;
      }
    });

    const renderRecipeResult = (recipe) => {
      if (!resultContainer) return;

      resultContainer.innerHTML = `
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 space-y-4 shadow-md">
          <!-- Recipe Header & Badges -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="pill-badge pill-badge-translucent">${recipe.category}</span>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">⏱️ ${recipe.prepTime}</span>
                <span class="text-xs font-bold text-slate-500 dark:text-slate-400">• Dificultate: ${recipe.difficulty}</span>
              </div>
              <h4 class="text-lg sm:text-xl font-black font-display text-slate-900 dark:text-white tracking-tight">${recipe.name}</h4>
              ${recipe.chefTips ? `<p class="text-xs text-brand-lilac-dark dark:text-[#C4B5FD] font-semibold mt-1">✨ ${recipe.chefTips}</p>` : ''}
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <button id="btn-asst-save-recipe" type="button" class="btn-pill btn-pill-dark text-xs py-2 px-3.5 shadow flex items-center gap-1.5 whitespace-nowrap">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                <span>Salvează în Rețetar</span>
              </button>
              <button id="btn-asst-add-to-plan" type="button" class="btn-pill btn-pill-primary text-xs py-2 px-3.5 shadow flex items-center gap-1.5 whitespace-nowrap">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                <span>+ În Plan (${this.activeDay})</span>
              </button>
            </div>
          </div>

          <!-- Nutritional & Cost Bento Grid (Per Portion & Total) -->
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
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

          <!-- Ingredients List with Grammages -->
          <div class="space-y-2">
            <div class="text-xs font-extrabold text-slate-800 dark:text-white flex items-center justify-between">
              <span>Ingrediente & Gramaje Exacte:</span>
              <span class="text-[11px] font-bold text-slate-400">${recipe.servings} ${recipe.servings === 1 ? 'porție' : 'porții'}</span>
            </div>
            <div class="divide-y divide-slate-100 dark:divide-white/5 bg-[#FAF9FD] dark:bg-white/5 rounded-2xl border border-slate-200/60 dark:border-white/10 overflow-hidden">
              ${recipe.ingredients.map(ing => `
                <div class="p-3 flex items-center justify-between text-xs">
                  <div>
                    <span class="font-extrabold text-slate-800 dark:text-white">${ing.name}</span>
                    <span class="text-[11px] text-slate-400 ml-1.5">(${ing.gramsPerServing}g / porție)</span>
                  </div>
                  <div class="text-right">
                    <span class="font-black text-[#6D4AE8] dark:text-[#C4B5FD]">${ing.totalGrams}g total</span>
                    <span class="text-[11px] text-emerald-600 font-bold ml-1.5">${ing.costTotal.toFixed(2)} RON</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Step by Step Instructions -->
          <div class="space-y-2">
            <div class="text-xs font-extrabold text-slate-800 dark:text-white">Mod de Preparare Pas cu Pas:</div>
            <div class="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-[#FAF9FD] dark:bg-white/5 p-4 rounded-2xl border border-slate-200/60 dark:border-white/10">
              ${recipe.instructions.map(step => `
                <p class="py-1">${step}</p>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Save to store button click
      document.getElementById('btn-asst-save-recipe')?.addEventListener('click', (e) => {
        const saved = window.nutriAssistant.saveRecipeToStore(currentGeneratedRecipe);
        if (saved) {
          e.currentTarget.disabled = true;
          e.currentTarget.className = 'btn-pill bg-emerald-600 text-white text-xs py-2 px-3.5 shadow whitespace-nowrap cursor-default';
          e.currentTarget.innerHTML = `<span>✓ Salvat în Rețetar</span>`;
          this.showToast(`Rețeta "${saved.name}" a fost salvată în Rețetar!`, 'success');
        }
      });

      // Add to current day plan
      document.getElementById('btn-asst-add-to-plan')?.addEventListener('click', (e) => {
        let saved = window.store.getRecipes().find(r => r.name === currentGeneratedRecipe.name);
        if (!saved) {
          saved = window.nutriAssistant.saveRecipeToStore(currentGeneratedRecipe);
        }
        if (saved) {
          window.store.addPlanItem(this.activeDay, currentGeneratedRecipe.category || 'Prânz', saved.id, 1.0);
          e.currentTarget.disabled = true;
          e.currentTarget.className = 'btn-pill bg-emerald-600 text-white text-xs py-2 px-3.5 shadow whitespace-nowrap cursor-default';
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

                <!-- Action Buttons -->
                <div class="flex items-center justify-end gap-2 pt-1">
                  <button type="button" data-asst-add-to-recipe="${idx}" class="btn-pill btn-pill-white text-xs py-1.5 px-3 shadow-2xs flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    <span>Folosește în Rețetă</span>
                  </button>
                  <button type="button" data-asst-save-db="${idx}" class="btn-pill btn-pill-dark text-xs py-1.5 px-3.5 shadow flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-[#70D6A3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7"/></svg>
                    <span>Salvează în Ingrediente</span>
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
            saveBtn.className = 'btn-pill bg-emerald-600 text-white text-xs py-1.5 px-3 shadow cursor-default';
            saveBtn.innerHTML = `<span>✓ Salvat</span>`;
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
