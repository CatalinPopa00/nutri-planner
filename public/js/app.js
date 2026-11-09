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
    this.dailyCalorieTarget = 2000;

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
    const activeDayData = weekData.days[this.activeDay] || { items: [], totals: { cost: 0, calories: 0, protein: 0, carbs: 0, fat: 0 } };

    const calPercent = Math.min(100, Math.round((activeDayData.totals.calories / this.dailyCalorieTarget) * 100));

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

        <!-- Date Selector Vertical Capsule Strip (Screenshots 1 & 3) -->
        <div>
          <div class="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar py-2 px-1">
            ${dayDefinitions.map(d => {
              const isSelected = this.activeDay === d.id;
              const dayTotals = weekData.days[d.id]?.totals || { cost: 0, calories: 0 };
              return `
                <button data-day-btn="${d.id}" class="day-capsule ${isSelected ? 'active' : ''}" title="${d.id}: ${dayTotals.cost > 0 ? `${dayTotals.cost.toFixed(1)} RON` : 'Liber'}">
                  <span class="day-capsule-name">${d.short}</span>
                  <span class="day-capsule-dot"></span>
                  <span class="day-capsule-num">${d.dateNum}</span>
                </button>
              `;
            }).join('')}
            <button data-day-btn="ALL" class="day-capsule day-capsule-all ${this.activeDay === 'ALL' ? 'active' : ''}">
              <span class="day-capsule-name">Toată Săpt.</span>
              <span class="day-capsule-dot"></span>
              <span class="text-[11px] font-extrabold mt-1">7 Zile</span>
            </button>
          </div>
        </div>

        <!-- Single Day View or Overview Table -->
        ${this.activeDay === 'ALL' ? this.renderAllDaysOverview(weekData) : this.renderSingleDayView(this.activeDay, activeDayData, calPercent)}
      </div>
    `;
  }

  renderSingleDayView(day, dayData, calPercent) {
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
          <div class="flex items-center gap-2">
            <button id="btn-copy-day" class="btn-pill btn-pill-white text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
              Copiază ziua
            </button>
            <button id="btn-clear-day" class="btn-pill btn-pill-white text-xs text-rose-600 hover:text-rose-700">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Golește
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
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Proteine</div>
              <div class="text-base sm:text-lg font-extrabold text-[#E02868] dark:text-[#FFA4CD] mt-0.5">${dayData.totals.protein.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Carbi</div>
              <div class="text-base sm:text-lg font-extrabold text-[#D97706] dark:text-[#FFC480] mt-0.5">${dayData.totals.carbs.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
            <div class="bg-slate-50 dark:bg-white/5 rounded-2xl p-3 border border-slate-100 dark:border-white/5 col-span-2 sm:col-span-1">
              <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Grăsimi</div>
              <div class="text-base sm:text-lg font-extrabold text-[#0284C7] dark:text-[#98DDFE] mt-0.5">${dayData.totals.fat.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
          </div>

          <!-- Calorie Target Progress Bar -->
          <div class="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
            <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span class="font-medium">Țintă calorică zilnică</span>
              <span class="font-bold text-slate-800 dark:text-white">${Math.round(dayData.totals.calories)} / ${this.dailyCalorieTarget} kcal (${calPercent}%)</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5">
              <div class="h-full rounded-full transition-all duration-300 ${calPercent > 100 ? 'bg-amber-400' : 'bg-gradient-to-r from-[#A390F5] to-[#70D6A3]'}" style="width: ${calPercent}%"></div>
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

                    <div class="flex items-center gap-2">
                      <div class="hidden sm:block">
                        ${meal.iconSvg}
                      </div>
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
                            <div class="font-extrabold text-sm text-slate-900 dark:text-white truncate leading-snug">${item.recipeName}</div>
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

                          <!-- Portions control & Delete -->
                          <div class="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-black/5 dark:border-white/10 flex-shrink-0">
                            <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/10 rounded-full p-1">
                              <button data-portion-minus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="Scade 0.5 porții">
                                −
                              </button>
                              <span class="text-xs font-extrabold text-slate-800 dark:text-white px-2 min-w-[2.4rem] text-center">${item.portions}</span>
                              <button data-portion-plus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded-full bg-white dark:bg-[#121319] text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold shadow-xs transition" title="Crește 0.5 porții">
                                +
                              </button>
                            </div>
                            <button data-delete-plan-item="${item.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition" title="Șterge din plan">
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
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

  bindPlannerEvents() {
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
          <button id="btn-create-recipe" class="btn-pill btn-pill-dark text-xs sm:text-sm shadow">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
            <span>Creează Rețetă Nouă</span>
          </button>
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
          <div class="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center sm:gap-2.5">
            <button id="btn-open-scanner-shortcut" class="btn-pill btn-pill-white text-[12px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-4 whitespace-nowrap justify-center w-full sm:w-auto shadow-2xs">
              <svg class="w-3.5 h-3.5 text-[#A390F5] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
              <span>Scanare EAN/Bon</span>
            </button>
            <button id="btn-add-ingredient-manual" class="btn-pill btn-pill-dark text-[12px] sm:text-sm py-2 sm:py-2.5 px-2.5 sm:px-4 whitespace-nowrap justify-center w-full sm:w-auto shadow">
              <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
              <span>+ Adaugă Manual</span>
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
        <!-- Sub-Tabs Selector Capsule -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-1.5 flex items-center gap-2 max-w-md mx-auto shadow-sm">
          <button id="subtab-ean" class="flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            this.scanSubTab === 'ean'
              ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
            Scanare Cod EAN
          </button>
          <button id="subtab-receipt" class="flex-1 py-2.5 px-4 rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            this.scanSubTab === 'receipt'
              ? 'bg-[#121319] dark:bg-white text-white dark:text-[#121319] shadow-sm'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Bon Fiscal (OCR)
          </button>
        </div>

        ${this.scanSubTab === 'ean' ? this.renderEanScanner() : this.renderReceiptScanner()}
      </div>
    `;
  }

  renderEanScanner() {
    const samples = window.INITIAL_DATA.sampleBarcodes || [];

    return `
      <div class="space-y-5">
        <!-- Live Camera Viewfinder Box -->
        <div class="bg-[#121319] rounded-3xl p-5 text-white shadow-xl overflow-hidden relative border border-white/10">
          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-bold text-[#70D6A3] flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-[#70D6A3] animate-ping"></span>
              Cameră Scanare Barcode
            </span>
            <button id="btn-toggle-camera" class="btn-pill btn-pill-lilac text-xs py-1.5 px-3.5">
              Pornește Camera
            </button>
          </div>

          <!-- Video viewport -->
          <div id="camera-container" class="relative w-full h-52 sm:h-64 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-white/10">
            <video id="barcode-video" class="w-full h-full object-cover hidden" playsinline></video>
            
            <!-- Default camera placeholder -->
            <div id="camera-placeholder" class="text-center p-4">
              <svg class="w-12 h-12 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <p class="text-xs text-slate-400">Apasă pe "Pornește Camera" sau introdu manual codul EAN mai jos.</p>
            </div>

            <!-- Animated Reticle when active -->
            <div id="scanner-overlay" class="hidden absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-64 h-36 border-2 border-[#70D6A3]/80 rounded-2xl relative overflow-hidden">
                <div class="scanner-line"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual EAN Input Form -->
        <div class="bento-card bento-white border border-[#E5E0F5] dark:border-white/10 p-5 sm:p-6 shadow-sm space-y-4">
          <label class="block text-xs font-bold text-slate-700 dark:text-slate-200">Introducere Manuală Cod EAN (13 sau 8 cifre)</label>
          <div class="flex gap-2.5">
            <input type="text" id="manual-ean-input" placeholder="ex: 5941014001234" class="flex-1 bg-white dark:bg-[#181924] border border-[#E5E0F5] dark:border-white/10 rounded-full px-5 py-3 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-[#A390F5] focus:ring-2 focus:ring-[#A390F5]/20">
            <button id="btn-search-ean" class="btn-pill btn-pill-dark text-xs sm:text-sm px-5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              Caută
            </button>
          </div>

          <!-- Quick Test Barcode Buttons -->
          <div class="pt-2 border-t border-slate-100 dark:border-white/5">
            <div class="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">Sau testează instant cu produse românești uzuale (Click pentru scan rapid):</div>
            <div class="flex flex-wrap gap-2">
              ${samples.map(s => `
                <button data-quick-ean="${s.ean}" class="text-xs bg-slate-100 hover:bg-[#B8A9FD]/20 dark:bg-white/10 dark:hover:bg-white/15 border border-[#E5E0F5] dark:border-white/10 px-3.5 py-1.5 rounded-full transition text-slate-800 dark:text-slate-200 font-bold">
                  ${s.name}
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
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="font-bold text-slate-800 text-base">Încărcare Bon Fiscal</h2>
              <p class="text-xs text-slate-500 mt-0.5">Platforma extrage automat produsele, gramajul și prețurile plătite</p>
            </div>
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">OCR Automat</span>
          </div>

          <!-- Dual upload buttons for 100% reliable mobile & desktop file picking -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label for="receipt-camera-input" class="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition text-xs sm:text-sm active:scale-98">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span>Fotografiază Bonul (Cameră)</span>
              <input type="file" id="receipt-camera-input" accept="image/*" capture="environment" class="hidden">
            </label>

            <label for="receipt-gallery-input" class="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white font-bold p-3.5 rounded-xl flex items-center justify-center gap-2 shadow-sm transition text-xs sm:text-sm active:scale-98">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              <span>Alege Poză din Galerie / PC</span>
              <input type="file" id="receipt-gallery-input" accept="image/*" class="hidden">
            </label>
          </div>

          <!-- Drag and drop zone -->
          <div id="receipt-dropzone" class="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-4 text-center cursor-pointer transition">
            <svg class="w-7 h-7 text-slate-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <div class="text-xs font-semibold text-slate-700">Sau trage fișierul aici (Drag & Drop)</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Acceptă JPG, PNG, WEBP</div>
          </div>

          <!-- Uploaded image preview card -->
          <div id="receipt-image-preview-card" class="hidden bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
            <img id="receipt-preview-img" src="" class="w-16 h-20 object-cover rounded-lg border border-emerald-200 shadow-xs bg-white">
            <div class="flex-1 min-w-0">
              <div class="text-xs font-bold text-emerald-950 truncate" id="receipt-preview-name">bon_fiscal.jpg</div>
              <div class="text-[11px] text-emerald-700" id="receipt-preview-size">-- KB</div>
              <div class="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                Poză încărcată!
              </div>
            </div>
            <button id="btn-remove-preview" class="p-1 text-slate-400 hover:text-rose-600 rounded">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <!-- Demo Receipts Quick Test Buttons -->
          <div>
            <div class="text-xs font-bold text-slate-700 mb-2">Sau testează instant cu un bon românesc demo:</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button data-load-receipt="receipt_lidl" class="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl text-left transition group">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sm text-slate-800 group-hover:text-emerald-700">Bon Lidl România (74.46 LEI)</span>
                  <span class="text-xs text-emerald-600 font-semibold">Test</span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5">Piept pui 1kg, Iaurt grecesc 1kg, Mix mexican, Ouă, Banane...</div>
              </button>
              <button data-load-receipt="receipt_kaufland" class="p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl text-left transition group">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-sm text-slate-800 group-hover:text-emerald-700">Bon Kaufland România (79.19 LEI)</span>
                  <span class="text-xs text-emerald-600 font-semibold">Test</span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5">Carne tocată 500g, Telemea Delaco 400g, Orez basmati 1kg...</div>
              </button>
            </div>
          </div>

          <!-- Raw text paste toggle -->
          <details class="text-xs text-slate-600">
            <summary class="cursor-pointer font-semibold text-emerald-700 hover:underline">Sau lipește textul bonului fiscal manual</summary>
            <div class="mt-2 space-y-2">
              <textarea id="raw-receipt-textarea" rows="4" placeholder="LIDL DISCOUNT SRL&#10;PIEPT DE PUI 1KG 28.50 A&#10;..." class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono"></textarea>
              <button id="btn-parse-raw-text" class="bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3 py-1.5 rounded-lg text-xs">
                Procesează Textul
              </button>
            </div>
          </details>
        </div>

        <!-- OCR Processing State Indicator -->
        <div id="ocr-progress-container" class="hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div class="flex justify-between text-xs font-semibold text-slate-700">
            <span id="ocr-progress-label">Procesare OCR în curs...</span>
            <span id="ocr-progress-percent">0%</span>
          </div>
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
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
      ? 'items-start pt-3 sm:pt-4 sm:items-center'
      : 'items-center';

    const maxWidthClass = options.maxWidth || 'max-w-2xl';

    modalWrapper.innerHTML = `
      <div class="fixed inset-0 z-50 flex ${positionClass} justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md modal-enter" data-modal-backdrop="true">
        <div class="bg-white dark:bg-[#181924] rounded-3xl ${maxWidthClass} w-full max-h-[88dvh] max-h-[88vh] flex flex-col shadow-2xl border border-[#E5E0F5] dark:border-white/10 text-slate-800 dark:text-white relative overflow-hidden my-auto">
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

  // --- Modal: Add Recipe to Meal ---
  openAddRecipeToMealModal(day, meal) {
    const recipes = window.store.getRecipes();

    const html = `
      <!-- Fixed Header + Search Bar (Never hidden by virtual keyboard) -->
      <div class="flex-shrink-0 p-4 sm:p-5 border-b border-[#E5E0F5] dark:border-white/10 bg-white dark:bg-[#181924]">
        <div class="flex items-center justify-between pb-3">
          <div>
            <h3 class="font-extrabold text-base sm:text-lg text-slate-800 dark:text-white">Adaugă Rețetă la ${meal}</h3>
            <p class="text-xs text-slate-500 dark:text-white/60">Ziua: <span class="font-bold text-brand-dark dark:text-brand-lilac">${day}</span></p>
          </div>
          <button data-modal-close="true" class="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full bg-slate-100 dark:bg-white/10 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="relative">
          <input type="text" id="modal-recipe-search" placeholder="Caută o rețetă..." autocomplete="off" class="w-full bg-[#F4F3FA] dark:bg-white/5 border border-[#E5E0F5] dark:border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/40 focus:outline-none focus:border-brand-lilac">
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
      </div>

      <!-- Scrollable Recipes List (Occupies visible height right above keyboard) -->
      <div class="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-2" id="modal-recipe-list">
        ${recipes.map(raw => {
          const r = window.store.calculateRecipe(raw);
          return `
            <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 active:scale-[0.99] border border-[#E5E0F5] dark:border-white/10 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition shadow-xs hover:shadow-md" data-select-recipe="${r.id}">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">${r.name}</div>
                <div class="text-[11px] sm:text-xs text-slate-500 dark:text-white/60 truncate">${r.category} • ${Math.round(r.perServing.calories)} kcal • ${r.perServing.protein.toFixed(1)}g P</div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">${r.perServing.cost.toFixed(2)} RON</div>
                <div class="text-[10px] text-slate-400 dark:text-white/40">per porție</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.openModal(html, { position: 'top' });

    // Filter recipes in modal
    const searchIn = document.getElementById('modal-recipe-search');
    const listEl = document.getElementById('modal-recipe-list');
    if (searchIn && listEl) {
      searchIn.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = recipes.filter(r => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
        if (filtered.length === 0) {
          listEl.innerHTML = `
            <div class="text-center py-8 text-slate-400 dark:text-white/40 text-xs">
              Nicio rețetă găsită pentru "${q}".
            </div>
          `;
          return;
        }
        listEl.innerHTML = filtered.map(raw => {
          const r = window.store.calculateRecipe(raw);
          return `
            <div class="p-3 bg-[#FAF9FD] dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 active:scale-[0.99] border border-[#E5E0F5] dark:border-white/10 rounded-2xl flex items-center justify-between gap-3 cursor-pointer transition shadow-xs hover:shadow-md" data-select-recipe="${r.id}">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate">${r.name}</div>
                <div class="text-[11px] sm:text-xs text-slate-500 dark:text-white/60 truncate">${r.category} • ${Math.round(r.perServing.calories)} kcal • ${r.perServing.protein.toFixed(1)}g P</div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="font-black text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">${r.perServing.cost.toFixed(2)} RON</div>
                <div class="text-[10px] text-slate-400 dark:text-white/40">per porție</div>
              </div>
            </div>
          `;
        }).join('');
        this.bindModalRecipeSelection(day, meal);
      });
    }

    this.bindModalRecipeSelection(day, meal);
  }

  bindModalRecipeSelection(day, meal) {
    document.querySelectorAll('[data-select-recipe]').forEach(el => {
      el.addEventListener('click', (e) => {
        const recId = e.currentTarget.getAttribute('data-select-recipe');
        window.store.addPlanItem(day, meal, recId, 1.0);
        this.closeModal();
      });
    });
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
}

// Bootstrap app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NutriApp();
});
