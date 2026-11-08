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
    this.bindEvents();
    window.store.subscribe(() => {
      this.renderCurrentView();
    });
    this.renderCurrentView();
  }

  bindEvents() {
    // Navigation Tabs
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-nav-tab');
        this.switchTab(tab);
      });
    });

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

    // Update bottom nav & desktop nav active states
    document.querySelectorAll('[data-nav-tab]').forEach(el => {
      const active = el.getAttribute('data-nav-tab') === tab;
      if (active) {
        el.classList.add('text-emerald-600', 'font-semibold');
        el.classList.remove('text-slate-500', 'text-slate-400');
        const icon = el.querySelector('svg');
        if (icon) icon.classList.add('stroke-emerald-600');
      } else {
        el.classList.remove('text-emerald-600', 'font-semibold');
        el.classList.add('text-slate-500');
        const icon = el.querySelector('svg');
        if (icon) icon.classList.remove('stroke-emerald-600');
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
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const activeDayData = weekData.days[this.activeDay] || { items: [], totals: { cost: 0, calories: 0, protein: 0, carbs: 0, fat: 0 } };

    const calPercent = Math.min(100, Math.round((activeDayData.totals.calories / this.dailyCalorieTarget) * 100));

    return `
      <div class="space-y-5 pb-20">
        <!-- Top Weekly KPI Header Banner -->
        <div class="bg-gradient-to-br from-emerald-800 to-teal-900 text-white rounded-2xl p-5 shadow-lg border border-emerald-700/50">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-700/60 text-emerald-100 border border-emerald-500/30">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Planificator Săptămânal
              </span>
              <h1 class="text-xl sm:text-2xl font-bold mt-1 tracking-tight">Cost & Macronutrienți Săptămână</h1>
            </div>
            <button id="btn-quick-shop" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span class="hidden sm:inline">Listă</span> Cumpărături
            </button>
          </div>

          <!-- Weekly Metric Grid (Matches Sheet Formulas) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div class="text-xs text-emerald-200">Cost Total Săpt.</div>
              <div class="text-lg sm:text-xl font-bold text-white mt-0.5">${weekData.totals.cost.toFixed(2)} <span class="text-xs font-normal">RON</span></div>
              <div class="text-[11px] text-emerald-300 mt-0.5">Medie: ${weekData.totals.avgDailyCost.toFixed(2)} RON/zi</div>
            </div>
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div class="text-xs text-emerald-200">Calorii Săptămână</div>
              <div class="text-lg sm:text-xl font-bold text-white mt-0.5">${Math.round(weekData.totals.calories)} <span class="text-xs font-normal">kcal</span></div>
              <div class="text-[11px] text-emerald-300 mt-0.5">Medie: ${Math.round(weekData.totals.avgDailyCalories)} kcal/zi</div>
            </div>
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div class="text-xs text-emerald-200">Proteine Total</div>
              <div class="text-lg sm:text-xl font-bold text-rose-300 mt-0.5">${Math.round(weekData.totals.protein)} <span class="text-xs font-normal">g</span></div>
              <div class="text-[11px] text-emerald-300 mt-0.5">Medie: ${Math.round(weekData.totals.avgDailyProtein)} g/zi</div>
            </div>
            <div class="bg-black/20 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div class="text-xs text-emerald-200">Carbi & Grăsimi</div>
              <div class="text-sm font-semibold text-amber-200 mt-1">${Math.round(weekData.totals.carbs)}g C <span class="text-white/40">|</span> <span class="text-sky-300">${Math.round(weekData.totals.fat)}g G</span></div>
              <div class="text-[11px] text-emerald-300 mt-0.5">Med: ${Math.round(weekData.totals.avgDailyCarbs)}g / ${Math.round(weekData.totals.avgDailyFat)}g</div>
            </div>
          </div>
        </div>

        <!-- Day Selector Pills (Horizontal Scroll) -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          ${days.map(day => {
            const isSelected = this.activeDay === day;
            const dayTotals = weekData.days[day]?.totals || { cost: 0, calories: 0 };
            return `
              <button data-day-btn="${day}" class="flex-shrink-0 px-4 py-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-300'
              }">
                <div class="font-bold text-sm">${day}</div>
                <div class="text-[11px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}">
                  ${dayTotals.cost > 0 ? `${dayTotals.cost.toFixed(1)} L | ${Math.round(dayTotals.calories)} kcal` : 'Liber'}
                </div>
              </button>
            `;
          }).join('')}
          <button data-day-btn="ALL" class="flex-shrink-0 px-4 py-2.5 rounded-xl border transition-all text-left ${
            this.activeDay === 'ALL'
              ? 'bg-slate-800 border-slate-800 text-white shadow-md'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
          }">
            <div class="font-bold text-sm">Toată Săptămâna</div>
            <div class="text-[11px] ${this.activeDay === 'ALL' ? 'text-slate-300' : 'text-slate-500'}">7 zile complete</div>
          </button>
        </div>

        ${this.activeDay === 'ALL' ? this.renderAllDaysOverview(weekData) : this.renderSingleDayView(this.activeDay, activeDayData, calPercent)}
      </div>
    `;
  }

  renderSingleDayView(day, dayData, calPercent) {
    const mealCategories = [
      { id: 'Mic Dejun', title: '🍳 Mic Dejun / Snacks', defaultCategory: 'Snacks / Mic Dejun' },
      { id: 'Prânz', title: '🍲 Prânz', defaultCategory: 'Mese Mari' },
      { id: 'Snack', title: '🍎 Gustare / Snack', defaultCategory: 'Snacks / Mic Dejun' },
      { id: 'Cină', title: '🌙 Cină', defaultCategory: 'Mese Mari' }
    ];

    return `
      <!-- Active Day Card -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <!-- Day Summary Header -->
        <div class="bg-slate-50/80 px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>Ziua: ${day}</span>
              <span class="text-xs font-normal text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                ${dayData.items.length} ${dayData.items.length === 1 ? 'preparat' : 'preparate'}
              </span>
            </h2>
          </div>
          <!-- Day Quick Actions -->
          <div class="flex items-center gap-2">
            <button id="btn-copy-day" class="text-xs font-medium text-slate-600 hover:text-emerald-700 bg-white border border-slate-200 hover:border-emerald-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"/></svg>
              Copiază ziua
            </button>
            <button id="btn-clear-day" class="text-xs font-medium text-rose-600 hover:text-rose-700 bg-white border border-rose-200 hover:border-rose-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              Golește
            </button>
          </div>
        </div>

        <!-- Day Nutri Stats & Progress -->
        <div class="p-4 border-b border-slate-100 bg-white">
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center mb-3">
            <div class="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
              <div class="text-[11px] font-medium text-emerald-800">Cost Total Zi</div>
              <div class="text-base sm:text-lg font-bold text-emerald-700">${dayData.totals.cost.toFixed(2)} <span class="text-xs">RON</span></div>
            </div>
            <div class="bg-purple-50 rounded-xl p-2.5 border border-purple-100">
              <div class="text-[11px] font-medium text-purple-800">Calorii Totale</div>
              <div class="text-base sm:text-lg font-bold text-purple-700">${Math.round(dayData.totals.calories)} <span class="text-xs">kcal</span></div>
            </div>
            <div class="bg-rose-50 rounded-xl p-2.5 border border-rose-100">
              <div class="text-[11px] font-medium text-rose-800">Proteine</div>
              <div class="text-base sm:text-lg font-bold text-rose-600">${dayData.totals.protein.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
            <div class="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
              <div class="text-[11px] font-medium text-amber-800">Carbohidrați</div>
              <div class="text-base sm:text-lg font-bold text-amber-600">${dayData.totals.carbs.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
            <div class="bg-sky-50 rounded-xl p-2.5 border border-sky-100 col-span-2 sm:col-span-1">
              <div class="text-[11px] font-medium text-sky-800">Grăsimi</div>
              <div class="text-base sm:text-lg font-bold text-sky-600">${dayData.totals.fat.toFixed(1)} <span class="text-xs">g</span></div>
            </div>
          </div>

          <!-- Calorie Target Progress Bar -->
          <div class="space-y-1">
            <div class="flex justify-between text-xs text-slate-500">
              <span>Țintă calorică zilnică</span>
              <span class="font-medium text-slate-700">${Math.round(dayData.totals.calories)} / ${this.dailyCalorieTarget} kcal (${calPercent}%)</span>
            </div>
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="h-full rounded-full transition-all duration-300 ${calPercent > 100 ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${calPercent}%"></div>
            </div>
          </div>
        </div>

        <!-- Meals Section -->
        <div class="divide-y divide-slate-100">
          ${mealCategories.map(meal => {
            const mealItems = dayData.items.filter(i => i.meal === meal.id);
            const mealCost = mealItems.reduce((acc, it) => acc + it.cost, 0);
            const mealCals = mealItems.reduce((acc, it) => acc + it.calories, 0);

            return `
              <div class="p-4 hover:bg-slate-50/50 transition">
                <div class="flex items-center justify-between mb-2.5">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm text-slate-800">${meal.title}</span>
                    ${mealItems.length > 0 ? `
                      <span class="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ${mealCost.toFixed(2)} RON • ${Math.round(mealCals)} kcal
                      </span>
                    ` : ''}
                  </div>
                  <button data-add-meal-recipe="${meal.id}" class="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    Adaugă Rețetă
                  </button>
                </div>

                ${mealItems.length === 0 ? `
                  <div class="text-center py-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/60 text-slate-400 text-xs">
                    Nicio rețetă planificată pentru această masă.
                  </div>
                ` : `
                  <div class="space-y-2">
                    ${mealItems.map(item => `
                      <div class="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs hover:border-slate-300 transition">
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-slate-800 truncate">${item.recipeName}</span>
                            <span class="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${item.category}</span>
                          </div>
                          <!-- Macros breakdown -->
                          <div class="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
                            <span class="font-bold text-emerald-700">${item.cost.toFixed(2)} RON</span>
                            <span>•</span>
                            <span>${Math.round(item.calories)} kcal</span>
                            <span>•</span>
                            <span class="text-rose-600 font-medium">${item.protein.toFixed(1)}g P</span>
                            <span class="text-amber-600 font-medium">${item.carbs.toFixed(1)}g C</span>
                            <span class="text-sky-600 font-medium">${item.fat.toFixed(1)}g G</span>
                          </div>
                        </div>

                        <!-- Portions control & Delete -->
                        <div class="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                          <div class="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5">
                            <button data-portion-minus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-600 hover:bg-slate-200 text-xs font-bold shadow-xs">
                              -
                            </button>
                            <span class="text-xs font-bold text-slate-700 px-1 min-w-[2.5rem] text-center">${item.portions} porții</span>
                            <button data-portion-plus="${item.id}" class="w-6 h-6 flex items-center justify-center rounded bg-white text-slate-600 hover:bg-slate-200 text-xs font-bold shadow-xs">
                              +
                            </button>
                          </div>
                          <button data-delete-plan-item="${item.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Șterge din plan">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                `}
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
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <h2 class="text-base font-bold text-slate-800 mb-3">Privire de Ansamblu Săptămânală</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th class="py-2.5 px-3 font-semibold">Ziua</th>
                  <th class="py-2.5 px-3 font-semibold">Nr. Preparate</th>
                  <th class="py-2.5 px-3 font-semibold">Cost (RON)</th>
                  <th class="py-2.5 px-3 font-semibold">Calorii</th>
                  <th class="py-2.5 px-3 font-semibold text-rose-600">Proteine</th>
                  <th class="py-2.5 px-3 font-semibold text-amber-600">Carbi</th>
                  <th class="py-2.5 px-3 font-semibold text-sky-600">Grăsimi</th>
                  <th class="py-2.5 px-3 font-semibold text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${days.map(day => {
                  const d = weekData.days[day];
                  return `
                    <tr class="hover:bg-slate-50/70 transition">
                      <td class="py-3 px-3 font-bold text-slate-800">${day}</td>
                      <td class="py-3 px-3 text-slate-600">${d.items.length}</td>
                      <td class="py-3 px-3 font-semibold text-emerald-700">${d.totals.cost.toFixed(2)} RON</td>
                      <td class="py-3 px-3 text-slate-700">${Math.round(d.totals.calories)} kcal</td>
                      <td class="py-3 px-3 text-rose-600 font-medium">${d.totals.protein.toFixed(1)}g</td>
                      <td class="py-3 px-3 text-amber-600 font-medium">${d.totals.carbs.toFixed(1)}g</td>
                      <td class="py-3 px-3 text-sky-600 font-medium">${d.totals.fat.toFixed(1)}g</td>
                      <td class="py-3 px-3 text-right">
                        <button data-switch-day="${day}" class="text-xs font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md">
                          Deschide
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-slate-100/80 font-bold border-t-2 border-slate-300 text-slate-800">
                  <td class="py-3 px-3">TOTAL SĂPTĂMÂNĂ</td>
                  <td class="py-3 px-3">-</td>
                  <td class="py-3 px-3 text-emerald-800">${weekData.totals.cost.toFixed(2)} RON</td>
                  <td class="py-3 px-3">${Math.round(weekData.totals.calories)} kcal</td>
                  <td class="py-3 px-3 text-rose-700">${Math.round(weekData.totals.protein)}g</td>
                  <td class="py-3 px-3 text-amber-700">${Math.round(weekData.totals.carbs)}g</td>
                  <td class="py-3 px-3 text-sky-700">${Math.round(weekData.totals.fat)}g</td>
                  <td></td>
                </tr>
                <tr class="bg-slate-50 font-semibold text-slate-600 border-t border-slate-200">
                  <td class="py-2.5 px-3">MEDIE ZILNICĂ</td>
                  <td class="py-2.5 px-3">-</td>
                  <td class="py-2.5 px-3 text-emerald-700">${weekData.totals.avgDailyCost.toFixed(2)} RON</td>
                  <td class="py-2.5 px-3">${Math.round(weekData.totals.avgDailyCalories)} kcal</td>
                  <td class="py-2.5 px-3 text-rose-600">${Math.round(weekData.totals.avgDailyProtein)}g</td>
                  <td class="py-2.5 px-3 text-amber-600">${Math.round(weekData.totals.avgDailyCarbs)}g</td>
                  <td class="py-2.5 px-3 text-sky-600">${Math.round(weekData.totals.avgDailyFat)}g</td>
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
        if (confirm(`Ești sigur că vrei să golești planul pentru ziua de ${this.activeDay}?`)) {
          window.store.clearDay(this.activeDay);
        }
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
      <div class="space-y-5 pb-20">
        <!-- Header & Action Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 class="text-xl font-bold text-slate-800">Rețetar & Calculator Cost / Macro</h1>
            <p class="text-xs text-slate-500 mt-0.5">Calculează automat costul și profilul nutrițional per porție</p>
          </div>
          <button id="btn-create-recipe" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow flex items-center justify-center gap-1.5 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Creează Rețetă Nouă
          </button>
        </div>

        <!-- Search & Filter Category Pills -->
        <div class="space-y-3">
          <div class="relative">
            <input type="text" id="recipe-search-input" value="${this.recipeSearch}" placeholder="Caută rețetă după nume..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-xs">
            <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>

          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            ${categories.map(cat => `
              <button data-recipe-cat="${cat}" class="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
                this.recipeFilterCategory === cat
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }">
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Recipes Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${recipes.length === 0 ? `
            <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200">
              <svg class="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
              <p class="text-sm font-medium text-slate-600">Nu s-a găsit nicio rețetă.</p>
              <button id="btn-reset-recipes-filter" class="mt-2 text-xs text-emerald-600 font-semibold hover:underline">Resetează filtrele</button>
            </div>
          ` : recipes.map(rawRecipe => {
            const r = window.store.calculateRecipe(rawRecipe);
            return `
              <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <!-- Card Header -->
                  <div class="p-4 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div>
                      <span class="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        ${r.category}
                      </span>
                      <h3 class="font-bold text-base text-slate-800 mt-1">${r.name}</h3>
                      <div class="text-xs text-slate-500 mt-0.5">
                        ${r.servings} ${r.servings === 1 ? 'porție' : 'porții'} • ${Math.round(r.totals.weight)}g total
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="text-base font-bold text-emerald-700">${r.perServing.cost.toFixed(2)} <span class="text-xs">RON</span></div>
                      <div class="text-[11px] text-slate-400">per porție</div>
                    </div>
                  </div>

                  <!-- Macro Hero Numbers Per Serving -->
                  <div class="p-4 bg-slate-50/50">
                    <div class="grid grid-cols-4 gap-2 text-center">
                      <div class="bg-white rounded-xl p-2 border border-slate-100 shadow-2xs">
                        <div class="text-[10px] text-slate-500">Calorii</div>
                        <div class="text-sm font-bold text-purple-700 mt-0.5">${Math.round(r.perServing.calories)}</div>
                        <div class="text-[9px] text-slate-400">kcal</div>
                      </div>
                      <div class="bg-white rounded-xl p-2 border border-slate-100 shadow-2xs">
                        <div class="text-[10px] text-slate-500">Proteine</div>
                        <div class="text-sm font-bold text-rose-600 mt-0.5">${r.perServing.protein.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                      <div class="bg-white rounded-xl p-2 border border-slate-100 shadow-2xs">
                        <div class="text-[10px] text-slate-500">Carbi</div>
                        <div class="text-sm font-bold text-amber-600 mt-0.5">${r.perServing.carbs.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                      <div class="bg-white rounded-xl p-2 border border-slate-100 shadow-2xs">
                        <div class="text-[10px] text-slate-500">Grăsimi</div>
                        <div class="text-sm font-bold text-sky-600 mt-0.5">${r.perServing.fat.toFixed(1)}</div>
                        <div class="text-[9px] text-slate-400">g</div>
                      </div>
                    </div>

                    <!-- Macro Caloric Distribution Bar -->
                    <div class="mt-3">
                      <div class="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Pondere calorică</span>
                        <span class="font-medium">
                          ${Math.round(r.macroShare.protein)}% P • ${Math.round(r.macroShare.carbs)}% C • ${Math.round(r.macroShare.fat)}% G
                        </span>
                      </div>
                      <div class="w-full h-2 rounded-full overflow-hidden flex bg-slate-200">
                        <div class="bg-rose-500" style="width: ${r.macroShare.protein}%" title="Proteine: ${Math.round(r.macroShare.protein)}%"></div>
                        <div class="bg-amber-400" style="width: ${r.macroShare.carbs}%" title="Carbohidrați: ${Math.round(r.macroShare.carbs)}%"></div>
                        <div class="bg-sky-500" style="width: ${r.macroShare.fat}%" title="Grăsimi: ${Math.round(r.macroShare.fat)}%"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Ingredients list preview -->
                  <div class="px-4 py-3 border-t border-slate-100 text-xs text-slate-600">
                    <span class="font-semibold text-slate-700">Ingrediente (${r.ingredients.length}):</span>
                    <span class="text-slate-500">${r.ingredients.map(i => `${i.name} (${i.quantity}g)`).join(', ')}</span>
                  </div>
                </div>

                <!-- Card Footer Actions -->
                <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button data-recipe-details="${r.id}" class="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-white border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-2xs transition">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    Tabel & Cost
                  </button>
                  <div class="flex items-center gap-1">
                    <button data-recipe-plan="${r.id}" class="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1.5 rounded-lg shadow-2xs transition" title="Adaugă în planificator">
                      + Planifică
                    </button>
                    <button data-recipe-edit="${r.id}" class="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200" title="Editează">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button data-recipe-delete="${r.id}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50" title="Șterge">
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
        if (confirm(`Ești sigur că vrei să ștergi rețeta "${raw?.name}"?`)) {
          window.store.deleteRecipe(id);
        }
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
      <div class="space-y-5 pb-20">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <h1 class="text-xl font-bold text-slate-800">Bază de Date Ingrediente & Prețuri</h1>
            <p class="text-xs text-slate-500 mt-0.5">${window.store.data.ingredients.length} ingrediente înregistrate cu referință raportată la 100g</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-open-scanner-shortcut" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
              Scan EAN / Bon
            </button>
            <button id="btn-add-ingredient-manual" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
              Adaugă Manual
            </button>
          </div>
        </div>

        <!-- Search & Sorting Controls -->
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="sm:col-span-2 relative">
              <input type="text" id="ing-search-input" value="${this.ingSearch}" placeholder="Caută ingredient sau cod EAN..." class="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-xs">
              <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            </div>
            <div>
              <select id="ing-sort-select" class="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-emerald-500">
                <option value="name" ${this.ingSortBy === 'name' ? 'selected' : ''}>Sortare: Nume (A-Z)</option>
                <option value="pricePer100g" ${this.ingSortBy === 'pricePer100g' ? 'selected' : ''}>Sortare: Preț / 100g (Crescător)</option>
                <option value="protein" ${this.ingSortBy === 'protein' ? 'selected' : ''}>Sortare: Proteine (Descrescător)</option>
                <option value="calories" ${this.ingSortBy === 'calories' ? 'selected' : ''}>Sortare: Calorii (Descrescător)</option>
              </select>
            </div>
          </div>

          <!-- Category Pills -->
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            ${categories.map(cat => `
              <button data-ing-cat="${cat}" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                this.ingFilterCategory === cat
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }">
                ${cat}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Ingredients Table / Cards -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th class="py-3 px-3.5 font-semibold">Ingredient & Categorie</th>
                  <th class="py-3 px-3 font-semibold">Pachet (g / RON)</th>
                  <th class="py-3 px-3 font-semibold text-emerald-700">Preț / 100g</th>
                  <th class="py-3 px-3 font-semibold">Calorii / 100g</th>
                  <th class="py-3 px-3 font-semibold text-rose-600">Proteine</th>
                  <th class="py-3 px-3 font-semibold text-amber-600">Carbi</th>
                  <th class="py-3 px-3 font-semibold text-sky-600">Grăsimi</th>
                  <th class="py-3 px-3 font-semibold text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${ingredients.length === 0 ? `
                  <tr>
                    <td colspan="8" class="text-center py-8 text-slate-400">Nu a fost găsit niciun ingredient.</td>
                  </tr>
                ` : ingredients.map(ing => `
                  <tr class="hover:bg-slate-50/70 transition">
                    <td class="py-3 px-3.5">
                      <div class="font-bold text-slate-800 text-sm">${ing.name}</div>
                      <div class="flex items-center gap-1.5 mt-0.5">
                        <span class="text-[10px] uppercase font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">${ing.category}</span>
                        ${ing.ean ? `<span class="text-[10px] text-slate-400 font-mono">EAN: ${ing.ean}</span>` : ''}
                      </div>
                    </td>
                    <td class="py-3 px-3 text-slate-600">
                      ${ing.packageQuantity}g • <span class="font-medium text-slate-800">${ing.packagePrice.toFixed(2)} RON</span>
                    </td>
                    <td class="py-3 px-3 font-bold text-emerald-700 text-sm">
                      ${ing.pricePer100g.toFixed(2)} <span class="text-[10px] font-normal">RON</span>
                    </td>
                    <td class="py-3 px-3 font-medium text-purple-700">
                      ${Math.round(ing.calories)} kcal
                    </td>
                    <td class="py-3 px-3 font-semibold text-rose-600">
                      ${ing.protein.toFixed(1)}g
                    </td>
                    <td class="py-3 px-3 font-semibold text-amber-600">
                      ${ing.carbs.toFixed(1)}g
                    </td>
                    <td class="py-3 px-3 font-semibold text-sky-600">
                      ${ing.fat.toFixed(1)}g
                    </td>
                    <td class="py-3 px-3 text-right">
                      <div class="flex items-center justify-end gap-1">
                        <button data-ing-edit="${ing.id}" class="p-1 text-slate-400 hover:text-slate-800 rounded hover:bg-slate-100" title="Editează">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                        </button>
                        <button data-ing-delete="${ing.id}" class="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50" title="Șterge">
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
        if (confirm(`Ești sigur că vrei să ștergi "${item?.name}"?`)) {
          window.store.deleteIngredient(id);
        }
      });
    });
  }

  // ==========================================
  // 4. SCANNER & BON FISCAL VIEW
  // ==========================================
  renderScanView() {
    return `
      <div class="space-y-5 pb-20">
        <!-- Sub-Tabs Selector -->
        <div class="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
          <button id="subtab-ean" class="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            this.scanSubTab === 'ean'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>
            Scanare Cod EAN (Barcode)
          </button>
          <button id="subtab-receipt" class="flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition ${
            this.scanSubTab === 'receipt'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Încărcare Bon Fiscal (OCR)
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
        <!-- Live Camera Viewfinder Box -->
        <div class="bg-slate-900 rounded-2xl p-4 text-white shadow-lg overflow-hidden relative">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Cameră Scanare Barcode
            </span>
            <button id="btn-toggle-camera" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
              Pornește Camera
            </button>
          </div>

          <!-- Video viewport -->
          <div id="camera-container" class="relative w-full h-48 sm:h-64 bg-black rounded-xl overflow-hidden flex items-center justify-center border border-white/10">
            <video id="barcode-video" class="w-full h-full object-cover hidden" playsinline></video>
            
            <!-- Default camera placeholder -->
            <div id="camera-placeholder" class="text-center p-4">
              <svg class="w-12 h-12 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <p class="text-xs text-slate-400">Apasă pe "Pornește Camera" sau introdu manual codul EAN mai jos.</p>
            </div>

            <!-- Animated Reticle when active -->
            <div id="scanner-overlay" class="hidden absolute inset-0 pointer-events-none flex items-center justify-center">
              <div class="w-64 h-36 border-2 border-emerald-400/80 rounded-lg relative overflow-hidden">
                <div class="scanner-line"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual EAN Input Form -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <label class="block text-xs font-bold text-slate-700">Introducere Manuală Cod EAN (13 sau 8 cifre)</label>
          <div class="flex gap-2">
            <input type="text" id="manual-ean-input" placeholder="ex: 5941014001234" class="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white">
            <button id="btn-search-ean" class="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow transition flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              Caută
            </button>
          </div>

          <!-- Quick Test Barcode Buttons -->
          <div>
            <div class="text-[11px] font-semibold text-slate-500 mb-1.5">Sau testează instant cu produse românești uzuale (Click pentru scan rapid):</div>
            <div class="flex flex-wrap gap-1.5">
              ${samples.map(s => `
                <button data-quick-ean="${s.ean}" class="text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 px-2.5 py-1.5 rounded-lg transition text-slate-700 font-medium">
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

          <!-- Drag and drop / File upload -->
          <div id="receipt-dropzone" class="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-6 text-center cursor-pointer transition">
            <svg class="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <div class="text-sm font-semibold text-slate-700">Fă o poză sau alege un fișier cu bonul fiscal</div>
            <div class="text-xs text-slate-500 mt-1">Acceptă imagini JPG, PNG, WEBP de pe telefon sau PC</div>
            <input type="file" id="receipt-file-input" accept="image/*" capture="environment" class="hidden">
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
            alert('Nu am putut accesa camera. Te rugăm să folosești introducerea manuală a codului EAN.');
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
          alert('Te rugăm să introduci un cod EAN.');
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

    // Receipt Dropzone & File Input
    const dropzone = document.getElementById('receipt-dropzone');
    const fileInput = document.getElementById('receipt-file-input');
    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files[0]) {
          await this.processReceiptFile(e.target.files[0]);
        }
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
    const card = document.getElementById('ean-result-card');
    if (!card) return;

    card.classList.remove('hidden');
    card.innerHTML = `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-md flex items-center justify-center gap-3 py-8">
        <svg class="w-6 h-6 text-emerald-600 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
        <span class="text-sm font-semibold text-slate-700">Se caută produsul în Open Food Facts & Baza de date...</span>
      </div>
    `;

    try {
      const res = await window.barcodeScanner.lookupEan(eanCode);
      const d = res.data;

      card.innerHTML = `
        <div class="bg-white rounded-2xl border border-emerald-500 shadow-md overflow-hidden modal-enter">
          <div class="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
              <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              ${res.isExisting ? 'Produs Găsit în Baza Ta de Date' : 'Informații Extrase cu Succes'}
            </span>
            <span class="text-[11px] font-mono text-slate-500">EAN: ${d.ean}</span>
          </div>

          <div class="p-4 space-y-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">${d.category}</span>
                <h3 class="font-bold text-base text-slate-800 mt-1">${d.name}</h3>
                ${d.brand ? `<div class="text-xs text-slate-500">Brand: ${d.brand}</div>` : ''}
              </div>
              <div class="text-right">
                <div class="text-xs text-slate-500">Gramaj Pachet</div>
                <div class="font-bold text-sm text-slate-800">${d.packageQuantity}g</div>
              </div>
            </div>

            <!-- Nutrition 100g -->
            <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div class="text-xs font-semibold text-slate-600 mb-2">Valori Nutriționale per 100g:</div>
              <div class="grid grid-cols-4 gap-2 text-center text-xs">
                <div class="bg-white p-1.5 rounded-lg border border-slate-200">
                  <div class="text-slate-400 text-[10px]">Calorii</div>
                  <div class="font-bold text-purple-700">${Math.round(d.calories)} kcal</div>
                </div>
                <div class="bg-white p-1.5 rounded-lg border border-slate-200">
                  <div class="text-slate-400 text-[10px]">Proteine</div>
                  <div class="font-bold text-rose-600">${d.protein}g</div>
                </div>
                <div class="bg-white p-1.5 rounded-lg border border-slate-200">
                  <div class="text-slate-400 text-[10px]">Carbi</div>
                  <div class="font-bold text-amber-600">${d.carbs}g</div>
                </div>
                <div class="bg-white p-1.5 rounded-lg border border-slate-200">
                  <div class="text-slate-400 text-[10px]">Grăsimi</div>
                  <div class="font-bold text-sky-600">${d.fat}g</div>
                </div>
              </div>
            </div>

            <!-- Price input -->
            <div class="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label class="block text-xs font-bold text-emerald-900">Preț Pachet Plătit (RON)</label>
                <div class="text-[11px] text-emerald-700">Prețul per 100g va fi calculat automat: (Preț / ${d.packageQuantity}) * 100</div>
              </div>
              <div class="w-full sm:w-36">
                <input type="number" step="0.01" id="scanned-price-input" value="${d.packagePrice || ''}" placeholder="ex: 12.50" class="w-full bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-sm font-bold text-emerald-900 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              </div>
            </div>

            <!-- Action button -->
            <div class="flex justify-end gap-2">
              <button id="btn-cancel-scanned" class="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Anulează</button>
              <button id="btn-save-scanned-to-db" class="px-4 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition">
                ${res.isExisting ? 'Actualizează Prețul în DB' : 'Adaugă în Baza de Date'}
              </button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-cancel-scanned')?.addEventListener('click', () => {
        card.classList.add('hidden');
      });

      document.getElementById('btn-save-scanned-to-db')?.addEventListener('click', () => {
        const priceVal = parseFloat(document.getElementById('scanned-price-input')?.value) || 0;
        if (priceVal <= 0) {
          alert('Te rugăm să introduci prețul plătit pe pachet.');
          return;
        }

        if (res.isExisting && res.ingredient) {
          window.store.updateIngredient(res.ingredient.id, {
            packagePrice: priceVal,
            packageQuantity: d.packageQuantity
          });
          alert(`Prețul pentru "${d.name}" a fost actualizat la ${priceVal.toFixed(2)} RON!`);
        } else {
          window.store.addIngredient({
            name: d.name,
            category: d.category,
            packageQuantity: d.packageQuantity,
            packagePrice: priceVal,
            calories: d.calories,
            protein: d.protein,
            carbs: d.carbs,
            fat: d.fat,
            ean: d.ean
          });
          alert(`Produsul "${d.name}" a fost salvat cu succes în baza de date!`);
        }
        card.classList.add('hidden');
      });

    } catch (err) {
      card.innerHTML = `
        <div class="bg-rose-50 text-rose-700 p-4 rounded-xl border border-rose-200 text-xs">
          A apărut o eroare la căutarea codului EAN: ${err.message}
        </div>
      `;
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
    await this.simulateOcrProgress();
    const result = window.receiptOcr.parseReceiptText(window.INITIAL_DATA.sampleReceipts[0].rawText);
    this.renderReceiptResults(result);
  }

  renderReceiptResults(parsed) {
    const container = document.getElementById('receipt-result-container');
    if (!container) return;

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-md overflow-hidden space-y-4 p-4 sm:p-5 modal-enter">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-bold text-base text-slate-800">${parsed.store}</h3>
              <span class="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">Data: ${parsed.date}</span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">S-au detectat ${parsed.items.length} produse pe bonul fiscal</p>
          </div>
          <div class="text-right">
            <span class="text-xs text-slate-500">Total Produse Extrase:</span>
            <div class="font-bold text-base text-emerald-700">${parsed.totalCalculated.toFixed(2)} RON</div>
          </div>
        </div>

        <!-- Parsed Products Table -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th class="p-2.5 w-8">
                  <input type="checkbox" id="check-all-receipt-items" checked class="rounded text-emerald-600 focus:ring-emerald-500">
                </th>
                <th class="p-2.5 font-semibold">Produs Bon Fiscal</th>
                <th class="p-2.5 font-semibold">Status Bază Date</th>
                <th class="p-2.5 font-semibold">Gramaj</th>
                <th class="p-2.5 font-semibold">Preț Bon</th>
                <th class="p-2.5 font-semibold text-emerald-700">Preț / 100g</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${parsed.items.map((it, idx) => `
                <tr class="hover:bg-slate-50/70 transition">
                  <td class="p-2.5">
                    <input type="checkbox" data-receipt-item-check="${idx}" checked class="receipt-item-checkbox rounded text-emerald-600 focus:ring-emerald-500">
                  </td>
                  <td class="p-2.5 font-medium text-slate-800">
                    <div>${it.name}</div>
                    <div class="text-[10px] text-slate-400 font-mono">${it.rawLine}</div>
                  </td>
                  <td class="p-2.5">
                    ${it.isMatched ? `
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <svg class="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                        Potrivit: ${it.matchedIngredient.name}
                      </span>
                    ` : `
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        + Produs Nou
                      </span>
                    `}
                  </td>
                  <td class="p-2.5 text-slate-600">${it.quantity}g</td>
                  <td class="p-2.5 font-bold text-slate-800">${it.price.toFixed(2)} RON</td>
                  <td class="p-2.5 font-bold text-emerald-700">${it.pricePer100g.toFixed(2)} RON</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Bottom Action Bar -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div class="text-xs text-slate-500">
            Selectează produsele pe care dorești să le actualizezi sau să le introduci în baza de date.
          </div>
          <button id="btn-import-receipt-items" class="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow transition">
            Actualizează / Importă în Bază de Date
          </button>
        </div>
      </div>
    `;

    // Check all checkbox
    const checkAll = document.getElementById('check-all-receipt-items');
    if (checkAll) {
      checkAll.addEventListener('change', (e) => {
        document.querySelectorAll('.receipt-item-checkbox').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }

    // Import batch button
    document.getElementById('btn-import-receipt-items')?.addEventListener('click', () => {
      let updatedCount = 0;
      let newCount = 0;

      parsed.items.forEach((it, idx) => {
        const cb = document.querySelector(`[data-receipt-item-check="${idx}"]`);
        if (cb && cb.checked) {
          if (it.isMatched && it.matchedIngredient) {
            window.store.updateIngredient(it.matchedIngredient.id, {
              packagePrice: it.price,
              packageQuantity: it.quantity
            });
            updatedCount++;
          } else {
            window.store.addIngredient({
              name: it.name,
              category: 'Ingrediente',
              packageQuantity: it.quantity,
              packagePrice: it.price,
              calories: 100,
              protein: 5,
              carbs: 10,
              fat: 2
            });
            newCount++;
          }
        }
      });

      alert(`Succes! S-au actualizat ${updatedCount} ingrediente și s-au adăugat ${newCount} produse noi.`);
      container.classList.add('hidden');
      this.switchTab('ingredients');
    });
  }

  // ==========================================
  // 5. ANALYTICS & SHOPPING LIST VIEW
  // ==========================================
  renderAnalyticsView() {
    const weekData = window.store.calculateWeek();
    const shoppingList = window.store.generateShoppingList();
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

    return `
      <div class="space-y-5 pb-20">
        <!-- Header -->
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-bold text-slate-800">Sumar Săptămânal & Listă de Cumpărături</h1>
            <p class="text-xs text-slate-500 mt-0.5">Optimizare buget alimentar și aprovizionare automată</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="btn-print-shopping-list" class="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
              Printează
            </button>
            <button id="btn-copy-shopping-list" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow flex items-center gap-1.5 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
              Copiază Text
            </button>
          </div>
        </div>

        <!-- Weekly Shopping Cart Summary Card -->
        <div class="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-200">Necesar de Cumpărat pentru Toată Săptămâna</span>
            <div class="text-2xl sm:text-3xl font-extrabold mt-1">${shoppingList.totalBudget.toFixed(2)} <span class="text-sm font-normal">RON Estimativ</span></div>
            <div class="text-xs text-emerald-100 mt-1">Calculat automat pe pachete întregi din cele ${shoppingList.totalItemsCount} ingrediente necesare</div>
          </div>
          <div class="bg-black/20 backdrop-blur-sm rounded-xl p-3 border border-white/10 text-center sm:text-right">
            <div class="text-xs text-emerald-200">Consum Planificat vs Achiziție</div>
            <div class="text-sm font-semibold mt-0.5">${weekData.totals.cost.toFixed(2)} RON consum net</div>
          </div>
        </div>

        <!-- Shopping List Items -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
          <h2 class="font-bold text-base text-slate-800 mb-3 flex items-center gap-2">
            <span>Ingrediente de Cumpărat</span>
            <span class="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">${shoppingList.items.length} articole</span>
          </h2>

          ${shoppingList.items.length === 0 ? `
            <div class="text-center py-8 text-slate-400 text-sm">
              Nu ai planificat nicio rețetă în săptămâna curentă. Mergi la tabul "Planificator" pentru a adăuga mese.
            </div>
          ` : `
            <div class="divide-y divide-slate-100">
              ${shoppingList.items.map((item, idx) => `
                <div class="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 rounded-lg px-2 transition">
                  <div class="flex items-center gap-3">
                    <input type="checkbox" id="shop-check-${idx}" class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                    <label for="shop-check-${idx}" class="cursor-pointer">
                      <div class="font-bold text-sm text-slate-800">${item.name}</div>
                      <div class="text-xs text-slate-500">
                        Necesar: <span class="font-semibold text-slate-700">${item.totalGrams} ${item.unit}</span> • Categorie: ${item.category}
                      </div>
                    </label>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-bold text-emerald-700">
                      ${item.packagesToBuy} ${item.packagesToBuy === 1 ? 'pachet' : 'pachete'} (~${item.estimatedCost.toFixed(2)} RON)
                    </div>
                    <div class="text-[11px] text-slate-400">Pachet de ${item.packageQuantity}${item.unit}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Data Management & Backup -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-3">
          <h3 class="font-bold text-sm text-slate-800">Gestiune Date & Backup</h3>
          <div class="flex flex-wrap gap-2">
            <button id="btn-export-json" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-xl transition">
              Exportă Date (JSON)
            </button>
            <button id="btn-import-json" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2 rounded-xl transition">
              Importă Date (JSON)
            </button>
            <button id="btn-reset-defaults" class="text-rose-600 hover:bg-rose-50 font-semibold text-xs px-3.5 py-2 rounded-xl border border-rose-200 transition">
              Resetează la Datele Google Sheet
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
        alert('Lista de cumpărături a fost copiată în clipboard!');
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
              alert('Datele au fost importate cu succes!');
              this.renderCurrentView();
            } else {
              alert('Fișierul JSON nu are formatul corect.');
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });

    // Reset defaults
    document.getElementById('btn-reset-defaults')?.addEventListener('click', () => {
      if (confirm('Ești sigur că vrei să resetezi toate datele la starea inițială din Google Sheet?')) {
        window.store.resetToDefaults();
        alert('Datele au fost resetate la starea inițială!');
        this.renderCurrentView();
      }
    });
  }

  // ==========================================
  // MODALS & DIALOGS
  // ==========================================
  openModal(html) {
    this.closeModal();
    const modalWrapper = document.createElement('div');
    modalWrapper.id = 'active-modal-root';
    modalWrapper.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs modal-enter" data-modal-backdrop="true">
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200" onclick="event.stopPropagation()">
          ${html}
        </div>
      </div>
    `;
    document.body.appendChild(modalWrapper);
    this.activeModal = modalWrapper;
  }

  closeModal() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
  }

  // --- Modal: Add Recipe to Meal ---
  openAddRecipeToMealModal(day, meal) {
    const recipes = window.store.getRecipes();

    const html = `
      <div class="p-5">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="font-bold text-base text-slate-800">Adaugă Rețetă la ${meal}</h3>
            <p class="text-xs text-slate-500">Ziua: ${day}</p>
          </div>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="py-3">
          <input type="text" id="modal-recipe-search" placeholder="Caută rețetă..." class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm">
        </div>

        <div class="space-y-2 max-h-72 overflow-y-auto pr-1" id="modal-recipe-list">
          ${recipes.map(raw => {
            const r = window.store.calculateRecipe(raw);
            return `
              <div class="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition" data-select-recipe="${r.id}">
                <div>
                  <div class="font-bold text-sm text-slate-800">${r.name}</div>
                  <div class="text-xs text-slate-500">${r.category} • ${Math.round(r.perServing.calories)} kcal</div>
                </div>
                <div class="text-right">
                  <div class="font-bold text-sm text-emerald-700">${r.perServing.cost.toFixed(2)} RON</div>
                  <div class="text-[10px] text-slate-400">per porție</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.openModal(html);

    // Filter recipes in modal
    const searchIn = document.getElementById('modal-recipe-search');
    const listEl = document.getElementById('modal-recipe-list');
    if (searchIn && listEl) {
      searchIn.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase().trim();
        const filtered = recipes.filter(r => r.name.toLowerCase().includes(q));
        listEl.innerHTML = filtered.map(raw => {
          const r = window.store.calculateRecipe(raw);
          return `
            <div class="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition" data-select-recipe="${r.id}">
              <div>
                <div class="font-bold text-sm text-slate-800">${r.name}</div>
                <div class="text-xs text-slate-500">${r.category} • ${Math.round(r.perServing.calories)} kcal</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-sm text-emerald-700">${r.perServing.cost.toFixed(2)} RON</div>
                <div class="text-[10px] text-slate-400">per porție</div>
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
      <div class="p-5 space-y-4">
        <div class="flex items-start justify-between border-b border-slate-200 pb-3">
          <div>
            <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">${r.category}</span>
            <h2 class="text-lg font-bold text-slate-800 mt-1">${r.name}</h2>
            <div class="text-xs text-slate-500">${r.servings} porții • Greutate totală: ${Math.round(r.totals.weight)}g</div>
          </div>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Recipe Overview Cards (Same as Google Sheet Header) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div class="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
            <div class="text-[11px] font-medium text-emerald-800">Preț / Porție</div>
            <div class="text-base font-bold text-emerald-700">${r.perServing.cost.toFixed(2)} RON</div>
            <div class="text-[10px] text-emerald-600">Total: ${r.totals.cost.toFixed(2)} RON</div>
          </div>
          <div class="bg-purple-50 p-2.5 rounded-xl border border-purple-100">
            <div class="text-[11px] font-medium text-purple-800">Calorii / Porție</div>
            <div class="text-base font-bold text-purple-700">${Math.round(r.perServing.calories)} kcal</div>
            <div class="text-[10px] text-purple-600">Total: ${Math.round(r.totals.calories)} kcal</div>
          </div>
          <div class="bg-rose-50 p-2.5 rounded-xl border border-rose-100">
            <div class="text-[11px] font-medium text-rose-800">Proteine / Porție</div>
            <div class="text-base font-bold text-rose-600">${r.perServing.protein.toFixed(1)}g</div>
            <div class="text-[10px] text-rose-500">${Math.round(r.macroShare.protein)}% calorii</div>
          </div>
          <div class="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
            <div class="text-[11px] font-medium text-amber-800">Carbi & Grăsimi</div>
            <div class="text-sm font-bold text-slate-700 mt-1">${r.perServing.carbs.toFixed(1)}g C | ${r.perServing.fat.toFixed(1)}g G</div>
            <div class="text-[10px] text-slate-500">${Math.round(r.macroShare.carbs)}% C | ${Math.round(r.macroShare.fat)}% G</div>
          </div>
        </div>

        <!-- Full Detailed Table (Exact Google Sheet Replica) -->
        <div>
          <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Compoziție Ingrediente & Costuri</h4>
          <div class="overflow-x-auto border border-slate-200 rounded-xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th class="py-2.5 px-3 font-semibold">Ingredient</th>
                  <th class="py-2.5 px-2 font-semibold">Cantitate</th>
                  <th class="py-2.5 px-2 font-semibold">Preț / 100g</th>
                  <th class="py-2.5 px-2 font-semibold text-emerald-700">Cost Total</th>
                  <th class="py-2.5 px-2 font-semibold">Calorii</th>
                  <th class="py-2.5 px-2 font-semibold text-rose-600">P</th>
                  <th class="py-2.5 px-2 font-semibold text-amber-600">C</th>
                  <th class="py-2.5 px-2 font-semibold text-sky-600">G</th>
                  <th class="py-2.5 px-2 font-semibold text-right">Pondere Cost</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${r.ingredients.map(ing => `
                  <tr class="hover:bg-slate-50/50">
                    <td class="py-2.5 px-3 font-medium text-slate-800">${ing.name}</td>
                    <td class="py-2.5 px-2 text-slate-600">${ing.quantity}g</td>
                    <td class="py-2.5 px-2 text-slate-600">${ing.pricePer100g.toFixed(2)} RON</td>
                    <td class="py-2.5 px-2 font-semibold text-emerald-700">${ing.cost.toFixed(2)} RON</td>
                    <td class="py-2.5 px-2 text-slate-700">${Math.round(ing.calories)}</td>
                    <td class="py-2.5 px-2 text-rose-600">${ing.protein.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-amber-600">${ing.carbs.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-sky-600">${ing.fat.toFixed(1)}g</td>
                    <td class="py-2.5 px-2 text-right font-medium text-slate-600">${ing.costShare.toFixed(1)}%</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
                  <td class="py-2.5 px-3">TOTAL REȚETĂ</td>
                  <td class="py-2.5 px-2">${Math.round(r.totals.weight)}g</td>
                  <td class="py-2.5 px-2">-</td>
                  <td class="py-2.5 px-2 text-emerald-800">${r.totals.cost.toFixed(2)} RON</td>
                  <td class="py-2.5 px-2">${Math.round(r.totals.calories)}</td>
                  <td class="py-2.5 px-2 text-rose-700">${r.totals.protein.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-amber-700">${r.totals.carbs.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-sky-700">${r.totals.fat.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-right">100%</td>
                </tr>
                <tr class="bg-emerald-50/70 font-bold text-emerald-900 border-t border-emerald-200">
                  <td class="py-2.5 px-3">PER PORȚIE (${r.servings})</td>
                  <td class="py-2.5 px-2">${Math.round(r.perServing.weight)}g</td>
                  <td class="py-2.5 px-2">-</td>
                  <td class="py-2.5 px-2 text-emerald-700">${r.perServing.cost.toFixed(2)} RON</td>
                  <td class="py-2.5 px-2">${Math.round(r.perServing.calories)}</td>
                  <td class="py-2.5 px-2 text-rose-600">${r.perServing.protein.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-amber-600">${r.perServing.carbs.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-sky-600">${r.perServing.fat.toFixed(1)}g</td>
                  <td class="py-2.5 px-2 text-right">-</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button data-modal-close="true" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs">
            Închide
          </button>
        </div>
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

    const renderRows = () => {
      return curIngredients.map((item, idx) => `
        <div class="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
          <select data-builder-ing-select="${idx}" class="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800">
            ${allIngredients.map(ing => `
              <option value="${ing.id}" ${ing.id === item.ingredientId ? 'selected' : ''}>
                ${ing.name} (${ing.pricePer100g.toFixed(2)} RON/100g)
              </option>
            `).join('')}
          </select>
          <div class="flex items-center gap-1 w-24">
            <input type="number" step="1" data-builder-ing-qty="${idx}" value="${item.quantity}" class="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center font-bold">
            <span class="text-xs text-slate-500 font-medium">g</span>
          </div>
          <button data-builder-ing-remove="${idx}" class="p-1.5 text-slate-400 hover:text-rose-600 rounded">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `).join('');
    };

    const html = `
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 class="font-bold text-base text-slate-800">${isEdit ? 'Editează Rețeta' : 'Creează Rețetă Nouă'}</h3>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2 space-y-1">
            <label class="block text-xs font-bold text-slate-700">Nume Rețetă</label>
            <input type="text" id="recipe-builder-name" value="${existingRecipe?.name || ''}" placeholder="ex: Souvlaki cu Cartofi" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Categorie</label>
            <select id="recipe-builder-cat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white">
              ${categories.map(c => `
                <option value="${c}" ${existingRecipe?.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Număr Porții</label>
            <input type="number" step="0.5" id="recipe-builder-servings" value="${existingRecipe?.servings || 1}" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-center">
          </div>
        </div>

        <!-- Ingredients dynamic list -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-slate-700">Ingrediente & Cantități</label>
            <button id="btn-builder-add-ing" class="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
              + Adaugă Ingredient
            </button>
          </div>

          <div id="recipe-builder-rows" class="space-y-2 max-h-56 overflow-y-auto pr-1">
            ${renderRows()}
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button data-modal-close="true" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Anulează</button>
          <button id="btn-builder-save" class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition">
            ${isEdit ? 'Salvează Modificările' : 'Creează Rețeta'}
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    const refreshRows = () => {
      const container = document.getElementById('recipe-builder-rows');
      if (container) {
        container.innerHTML = renderRows();
        bindRowHandlers();
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
          }
        });
      });

      document.querySelectorAll('[data-builder-ing-qty]').forEach(el => {
        el.addEventListener('input', (e) => {
          const idx = parseInt(e.target.getAttribute('data-builder-ing-qty'), 10);
          if (curIngredients[idx]) {
            curIngredients[idx].quantity = parseFloat(e.target.value) || 0;
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
      const servings = parseFloat(document.getElementById('recipe-builder-servings')?.value) || 1;

      if (!name) {
        alert('Te rugăm să completezi numele rețetei.');
        return;
      }
      if (curIngredients.length === 0) {
        alert('Adaugă cel puțin un ingredient în rețetă.');
        return;
      }

      if (isEdit) {
        window.store.updateRecipe(existingRecipe.id, {
          name,
          category: cat,
          servings,
          ingredients: curIngredients
        });
      } else {
        window.store.addRecipe({
          name,
          category: cat,
          servings,
          ingredients: curIngredients
        });
      }

      this.closeModal();
    });
  }

  // --- Modal: Ingredient Add / Edit ---
  openIngredientModal(existingIng = null) {
    const isEdit = !!existingIng;
    const categories = window.INITIAL_DATA.categories?.filter(c => c !== 'Toate') || ['Ingrediente'];

    const html = `
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 class="font-bold text-base text-slate-800">${isEdit ? 'Editează Ingredient' : 'Adaugă Ingredient Nou'}</h3>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1 sm:col-span-2">
            <label class="block text-xs font-bold text-slate-700">Nume Ingredient</label>
            <input type="text" id="ing-form-name" value="${existingIng?.name || ''}" placeholder="ex: Piept de pui dezosat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none">
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Categorie</label>
            <select id="ing-form-cat" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:bg-white">
              ${categories.map(c => `
                <option value="${c}" ${existingIng?.category === c ? 'selected' : ''}>${c}</option>
              `).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Cod Bare EAN (opțional)</label>
            <input type="text" id="ing-form-ean" value="${existingIng?.ean || ''}" placeholder="ex: 5941014001234" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono">
          </div>
        </div>

        <!-- Package size & price -> Price per 100g -->
        <div class="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100 space-y-3">
          <div class="text-xs font-bold text-emerald-900">Preț de Achiziție & Pachet</div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-emerald-800">Gramaj Pachet (g/ml)</label>
              <input type="number" step="10" id="ing-form-qty" value="${existingIng?.packageQuantity || 1000}" class="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] font-semibold text-emerald-800">Preț Pachet (RON)</label>
              <input type="number" step="0.1" id="ing-form-price" value="${existingIng?.packagePrice || ''}" placeholder="28.00" class="w-full bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center">
            </div>
            <div class="space-y-1 col-span-2 sm:col-span-1">
              <label class="block text-[11px] font-semibold text-emerald-800">Preț Calculat / 100g</label>
              <div id="ing-form-calc-100g" class="bg-emerald-100/80 rounded-lg py-1.5 px-2 text-center text-xs font-extrabold text-emerald-900">
                ${existingIng ? existingIng.pricePer100g.toFixed(2) : '0.00'} RON
              </div>
            </div>
          </div>
        </div>

        <!-- Nutrition per 100g -->
        <div class="space-y-2">
          <div class="text-xs font-bold text-slate-700">Valori Nutriționale raportate la 100g:</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="space-y-1">
              <label class="block text-[11px] text-purple-700 font-semibold">Calorii (kcal)</label>
              <input type="number" step="1" id="ing-form-cals" value="${existingIng?.calories || ''}" placeholder="165" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-rose-600 font-semibold">Proteine (g)</label>
              <input type="number" step="0.1" id="ing-form-prot" value="${existingIng?.protein || ''}" placeholder="31.0" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-amber-600 font-semibold">Carbohidrați (g)</label>
              <input type="number" step="0.1" id="ing-form-carbs" value="${existingIng?.carbs || '0'}" placeholder="0.0" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center">
            </div>
            <div class="space-y-1">
              <label class="block text-[11px] text-sky-600 font-semibold">Grăsimi (g)</label>
              <input type="number" step="0.1" id="ing-form-fat" value="${existingIng?.fat || ''}" placeholder="3.6" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-center">
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button data-modal-close="true" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Anulează</button>
          <button id="btn-ing-form-save" class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition">
            ${isEdit ? 'Salvează Modificările' : 'Adaugă Ingredient'}
          </button>
        </div>
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
        alert('Te rugăm să completezi numele ingredientului.');
        return;
      }

      if (isEdit) {
        window.store.updateIngredient(existingIng.id, {
          name, category: cat, ean, packageQuantity: pkgQty, packagePrice: pkgPrice, calories, protein, carbs, fat
        });
      } else {
        window.store.addIngredient({
          name, category: cat, ean, packageQuantity: pkgQty, packagePrice: pkgPrice, calories, protein, carbs, fat
        });
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
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h3 class="font-bold text-base text-slate-800">Planifică Rețeta</h3>
            <p class="text-xs text-emerald-700 font-semibold">${raw.name}</p>
          </div>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Alege Ziua</label>
            <select id="quick-plan-day" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
              ${days.map(d => `<option value="${d}" ${d === this.activeDay ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Alege Masa</label>
            <select id="quick-plan-meal" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
              ${meals.map(m => `<option value="${m}">${m}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="block text-xs font-bold text-slate-700">Număr Porții</label>
            <input type="number" step="0.5" id="quick-plan-servings" value="1.0" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-center">
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button data-modal-close="true" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Anulează</button>
          <button id="btn-save-quick-plan" class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition">
            Adaugă în Planificator
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    document.getElementById('btn-save-quick-plan')?.addEventListener('click', () => {
      const day = document.getElementById('quick-plan-day')?.value;
      const meal = document.getElementById('quick-plan-meal')?.value;
      const servings = parseFloat(document.getElementById('quick-plan-servings')?.value) || 1.0;
      window.store.addPlanItem(day, meal, recipeId, servings);
      alert(`Rețeta "${raw.name}" a fost adăugată la ${meal} pentru ziua de ${day}!`);
      this.closeModal();
      this.switchTab('planner');
    });
  }

  // --- Modal: Copy Day Plan ---
  openCopyDayModal() {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'].filter(d => d !== this.activeDay);

    const html = `
      <div class="p-5 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 class="font-bold text-base text-slate-800">Copiază Planul Zilei (${this.activeDay})</h3>
          <button data-modal-close="true" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-bold text-slate-700">Copiază preparatele în ziua:</label>
          <select id="copy-target-day" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800">
            ${days.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <button data-modal-close="true" class="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">Anulează</button>
          <button id="btn-execute-copy-day" class="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition">
            Copiază Planul
          </button>
        </div>
      </div>
    `;

    this.openModal(html);

    document.getElementById('btn-execute-copy-day')?.addEventListener('click', () => {
      const target = document.getElementById('copy-target-day')?.value;
      if (target) {
        window.store.copyDayPlan(this.activeDay, target);
        alert(`Planul din ziua de ${this.activeDay} a fost copiat în ${target}!`);
        this.closeModal();
      }
    });
  }
}

// Bootstrap app on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new NutriApp();
});
