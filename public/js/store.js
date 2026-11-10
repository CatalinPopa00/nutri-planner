// Store & State Management with localStorage persistence
class NutriStore {
  constructor() {
    this.STORAGE_KEY = 'nutri_planner_v1';
    this.listeners = [];
    this.data = this.loadState();
  }

  loadState() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ingredients && parsed.recipes && parsed.weeklyPlan) {
          // Sanitize ingredients: purge any corrupted/garbage names like ", X", "' X", "X"
          const originalLength = parsed.ingredients.length;
          parsed.ingredients = parsed.ingredients.filter(ing => {
            if (!ing || !ing.name) return false;
            const letters = ing.name.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
            if (letters.length < 2) return false;
            if (/^[,'.~`"_\-^#*]+\s*[xX*]/i.test(ing.name.trim())) return false;
            if (/^[xX*]$/i.test(ing.name.trim())) return false;
            return true;
          });
          // Classify recipes into custom (Proprii) vs common (Comune)
          const defaultCommonIds = ['rec_1', 'rec_2', 'rec_3', 'rec_4', 'rec_5', 'rec_6', 'rec_7', 'rec_8', 'rec_9'];
          parsed.recipes.forEach(r => {
            if (r.isCustom === undefined) {
              r.isCustom = !defaultCommonIds.includes(r.id);
            }
          });

          // Ensure profiles array and activeProfileId exist
          if (!parsed.profiles || !Array.isArray(parsed.profiles) || parsed.profiles.length === 0) {
            const curTargets = parsed.targets || { calories: 2000, protein: 140, carbs: 220, fat: 65 };
            parsed.profiles = [
              {
                id: 'prof_default',
                name: 'Utilizator',
                photo: '',
                gender: 'masculin',
                weight: 75,
                height: 178,
                calories: curTargets.calories || 2000,
                protein: curTargets.protein || 140,
                carbs: curTargets.carbs || 220,
                fat: curTargets.fat || 65,
                createdAt: Date.now()
              }
            ];
            parsed.activeProfileId = 'prof_default';
          }

          // Ensure plansByProfile exists and isolates weekly plans per profile
          const createEmptyWeekPlan = () => ({
            'Luni': [],
            'Marți': [],
            'Miercuri': [],
            'Joi': [],
            'Vineri': [],
            'Sâmbătă': [],
            'Duminică': []
          });

          if (!parsed.plansByProfile || typeof parsed.plansByProfile !== 'object') {
            parsed.plansByProfile = {};
            const defaultId = (parsed.profiles && parsed.profiles[0]?.id) || 'prof_default';
            parsed.plansByProfile[defaultId] = JSON.parse(JSON.stringify(parsed.weeklyPlan || createEmptyWeekPlan()));
          }

          // Ensure every profile has its own isolated plan
          if (Array.isArray(parsed.profiles)) {
            parsed.profiles.forEach((p, idx) => {
              if (!parsed.plansByProfile[p.id]) {
                parsed.plansByProfile[p.id] = (idx === 0)
                  ? JSON.parse(JSON.stringify(parsed.weeklyPlan || createEmptyWeekPlan()))
                  : createEmptyWeekPlan();
              }
            });
          }

          const currentActive = parsed.activeProfileId || (parsed.profiles && parsed.profiles[0]?.id) || 'prof_default';
          if (!parsed.plansByProfile[currentActive]) {
            parsed.plansByProfile[currentActive] = createEmptyWeekPlan();
          }
          parsed.weeklyPlan = parsed.plansByProfile[currentActive];

          // If corrupted items were purged or recipes/profiles updated, save cleaned state
          try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed)); } catch(e) {}
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using initial data:', e);
    }
    const initial = JSON.parse(JSON.stringify(window.INITIAL_DATA));
    initial.recipes.forEach(r => { r.isCustom = false; });
    initial.profiles = [
      {
        id: 'prof_default',
        name: 'Utilizator',
        photo: '',
        gender: 'masculin',
        weight: 75,
        height: 178,
        calories: 2000,
        protein: 140,
        carbs: 220,
        fat: 65,
        createdAt: Date.now()
      }
    ];
    initial.activeProfileId = 'prof_default';
    initial.plansByProfile = {
      'prof_default': JSON.parse(JSON.stringify(initial.weeklyPlan || {}))
    };
    return initial;
  }

  saveState() {
    try {
      if (!this.data.plansByProfile) {
        this.data.plansByProfile = {};
      }
      const activeId = this.data.activeProfileId || 'prof_default';
      this.data.plansByProfile[activeId] = this.data.weeklyPlan;

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(cb => {
      try { cb(this.data); } catch(err) { console.error('Listener error:', err); }
    });
  }

  resetToDefaults() {
    this.data = JSON.parse(JSON.stringify(window.INITIAL_DATA));
    this.saveState();
  }

  // --- INGREDIENTS ---
  getIngredients(filterCategory = 'Toate', searchQuery = '') {
    let list = this.data.ingredients || [];
    if (filterCategory && filterCategory !== 'Toate') {
      list = list.filter(i => i.category === filterCategory);
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(i => 
        i.name.toLowerCase().includes(q) || 
        (i.ean && i.ean.includes(q)) || 
        i.category.toLowerCase().includes(q)
      );
    }
    return list;
  }

  getIngredientById(id) {
    return this.data.ingredients.find(i => i.id === id);
  }

  findIngredientByName(name) {
    if (!name) return null;
    const clean = name.toLowerCase().trim();
    return this.data.ingredients.find(i => i.name.toLowerCase().trim() === clean) ||
           this.data.ingredients.find(i => i.name.toLowerCase().includes(clean) || clean.includes(i.name.toLowerCase()));
  }

  addIngredient(item) {
    if (!item || !item.name) return null;
    const cleanName = item.name.trim();
    const letters = cleanName.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
    if (letters.length < 2 || /^[,'.~`"_\-^#*]+\s*[xX*]/i.test(cleanName) || /^[xX*]$/i.test(cleanName)) {
      console.warn('Rejected adding invalid ingredient name:', cleanName);
      return null;
    }

    const id = 'ing_' + Date.now();
    const pkgQty = parseFloat(item.packageQuantity) || 100;
    const pkgPrice = parseFloat(item.packagePrice) || 0;
    const pricePer100g = pkgQty > 0 ? (pkgPrice / pkgQty) * 100 : 0;

    const newIng = {
      id,
      name: cleanName,
      category: item.category || 'Altele',
      packageQuantity: pkgQty,
      packagePrice: pkgPrice,
      pricePer100g: parseFloat(pricePer100g.toFixed(4)),
      calories: parseFloat(item.calories) || 0,
      protein: parseFloat(item.protein) || 0,
      carbs: parseFloat(item.carbs) || 0,
      fat: parseFloat(item.fat) || 0,
      ean: item.ean ? item.ean.trim() : ''
    };

    this.data.ingredients.push(newIng);
    this.saveState();
    return newIng;
  }

  updateIngredient(id, patch) {
    const idx = this.data.ingredients.findIndex(i => i.id === id);
    if (idx === -1) return null;

    const cur = this.data.ingredients[idx];
    const pkgQty = patch.packageQuantity !== undefined ? parseFloat(patch.packageQuantity) : cur.packageQuantity;
    const pkgPrice = patch.packagePrice !== undefined ? parseFloat(patch.packagePrice) : cur.packagePrice;
    const pricePer100g = pkgQty > 0 ? (pkgPrice / pkgQty) * 100 : 0;

    this.data.ingredients[idx] = {
      ...cur,
      ...patch,
      packageQuantity: pkgQty,
      packagePrice: pkgPrice,
      pricePer100g: parseFloat(pricePer100g.toFixed(4)),
      calories: patch.calories !== undefined ? parseFloat(patch.calories) : cur.calories,
      protein: patch.protein !== undefined ? parseFloat(patch.protein) : cur.protein,
      carbs: patch.carbs !== undefined ? parseFloat(patch.carbs) : cur.carbs,
      fat: patch.fat !== undefined ? parseFloat(patch.fat) : cur.fat
    };

    this.saveState();
    return this.data.ingredients[idx];
  }

  deleteIngredient(id) {
    this.data.ingredients = this.data.ingredients.filter(i => i.id !== id);
    this.saveState();
  }

  // --- RECIPES & CALCULATOR ---
  getRecipeOwnerId(recipe) {
    if (!recipe.isCustom) return null;
    if (recipe.profileId) return recipe.profileId;
    const profiles = this.getProfiles ? this.getProfiles() : (this.data.profiles || []);
    return profiles[0]?.id || 'prof_default';
  }

  isRecipeOwnedByActiveProfile(recipe) {
    if (!recipe.isCustom) return false;
    const ownerId = this.getRecipeOwnerId(recipe);
    const activeId = this.data.activeProfileId || (this.data.profiles && this.data.profiles[0]?.id) || 'prof_default';
    return ownerId === activeId;
  }

  getRecipes(category = 'Toate', searchQuery = '', mainTab = 'all') {
    let list = this.data.recipes || [];

    // Filter by main tab:
    // 'proprii' = strictly recipes created on the currently active profile
    // 'comune'  = standard catalog recipes + recipes created on ANY other connected profile
    if (mainTab === 'proprii') {
      list = list.filter(r => this.isRecipeOwnedByActiveProfile(r));
    } else if (mainTab === 'comune') {
      list = list.filter(r => !this.isRecipeOwnedByActiveProfile(r));
    }

    if (category && category !== 'Toate') {
      list = list.filter(r => r.category === category);
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }
    return list;
  }

  getRecipeCounts() {
    const list = this.data.recipes || [];
    let custom = 0;
    let common = 0;
    for (const r of list) {
      if (this.isRecipeOwnedByActiveProfile(r)) {
        custom++;
      } else {
        common++;
      }
    }
    return {
      total: list.length,
      custom,
      common
    };
  }

  cloneRecipeToCustom(recipeId, targetProfileId = null, customName = null) {
    const orig = this.getRecipeById(recipeId);
    if (!orig) return null;
    const pId = targetProfileId || this.data.activeProfileId || 'prof_default';
    const name = (customName && customName.trim()) ? customName.trim() : `${orig.name} (Proprie)`;
    const cloned = {
      ...orig,
      id: 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      isCustom: true,
      profileId: pId,
      ingredients: JSON.parse(JSON.stringify(orig.ingredients || []))
    };
    this.data.recipes.unshift(cloned);
    this.saveState();
    return cloned;
  }

  getRecipeById(id) {
    return this.data.recipes.find(r => r.id === id);
  }

  calculateRecipe(recipe) {
    if (!recipe) return null;
    const servings = Math.max(0.1, parseFloat(recipe.servings) || 1);

    let totalWeight = 0;
    let totalCost = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    const computedIngredients = (recipe.ingredients || []).map(ri => {
      const dbIng = this.getIngredientById(ri.ingredientId) || this.findIngredientByName(ri.name);
      const qty = parseFloat(ri.quantity) || 0;
      totalWeight += qty;

      if (!dbIng) {
        return {
          name: ri.name || 'Ingredient necunoscut',
          quantity: qty,
          pricePer100g: 0,
          cost: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          costShare: 0,
          missing: true
        };
      }

      const cost = (qty * dbIng.pricePer100g) / 100;
      const cals = (qty * dbIng.calories) / 100;
      const prot = (qty * dbIng.protein) / 100;
      const carbs = (qty * dbIng.carbs) / 100;
      const fat = (qty * dbIng.fat) / 100;

      totalCost += cost;
      totalCalories += cals;
      totalProtein += prot;
      totalCarbs += carbs;
      totalFat += fat;

      return {
        id: dbIng.id,
        name: dbIng.name,
        category: dbIng.category,
        quantity: qty,
        pricePer100g: dbIng.pricePer100g,
        cost,
        calories: cals,
        protein: prot,
        carbs: carbs,
        fat: fat,
        missing: false
      };
    });

    // Compute cost share % for each ingredient
    computedIngredients.forEach(ci => {
      ci.costShare = totalCost > 0 ? (ci.cost / totalCost) * 100 : 0;
    });

    // Per serving
    const costPerServing = totalCost / servings;
    const weightPerServing = totalWeight / servings;
    const calsPerServing = totalCalories / servings;
    const protPerServing = totalProtein / servings;
    const carbsPerServing = totalCarbs / servings;
    const fatPerServing = totalFat / servings;

    // Macro calorie shares
    const calFromProt = protPerServing * 4;
    const calFromCarbs = carbsPerServing * 4;
    const calFromFat = fatPerServing * 9;
    const macroCalsSum = calFromProt + calFromCarbs + calFromFat;

    const protPercent = macroCalsSum > 0 ? (calFromProt / macroCalsSum) * 100 : 0;
    const carbsPercent = macroCalsSum > 0 ? (calFromCarbs / macroCalsSum) * 100 : 0;
    const fatPercent = macroCalsSum > 0 ? (calFromFat / macroCalsSum) * 100 : 0;

    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      servings: servings,
      notes: recipe.notes || '',
      ingredients: computedIngredients,
      totals: {
        weight: totalWeight,
        cost: totalCost,
        calories: totalCalories,
        protein: totalProtein,
        carbs: totalCarbs,
        fat: totalFat
      },
      perServing: {
        weight: weightPerServing,
        cost: costPerServing,
        calories: calsPerServing,
        protein: protPerServing,
        carbs: carbsPerServing,
        fat: fatPerServing
      },
      macroCalories: {
        protein: calFromProt,
        carbs: calFromCarbs,
        fat: calFromFat,
        total: macroCalsSum
      },
      macroShare: {
        protein: protPercent,
        carbs: carbsPercent,
        fat: fatPercent
      }
    };
  }

  addRecipe(rec) {
    const id = 'rec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const newRecipe = {
      id,
      name: rec.name.trim(),
      category: rec.category || 'Mese Mari',
      servings: Math.max(0.1, parseFloat(rec.servings) || 1),
      ingredients: rec.ingredients || [],
      notes: rec.notes || '',
      isCustom: rec.isCustom !== undefined ? !!rec.isCustom : true,
      profileId: rec.profileId || this.data.activeProfileId || 'prof_default'
    };
    this.data.recipes.unshift(newRecipe);
    this.saveState();
    return newRecipe;
  }

  updateRecipe(id, patch) {
    const idx = this.data.recipes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.recipes[idx] = {
      ...this.data.recipes[idx],
      ...patch
    };
    this.saveState();
    return this.data.recipes[idx];
  }

  deleteRecipe(id) {
    this.data.recipes = this.data.recipes.filter(r => r.id !== id);
    // Remove from weekly plans across all profiles
    if (this.data.weeklyPlan) {
      Object.keys(this.data.weeklyPlan).forEach(day => {
        this.data.weeklyPlan[day] = (this.data.weeklyPlan[day] || []).filter(item => item.recipeId !== id);
      });
    }
    if (this.data.plansByProfile) {
      Object.keys(this.data.plansByProfile).forEach(pId => {
        const plan = this.data.plansByProfile[pId];
        if (plan) {
          Object.keys(plan).forEach(day => {
            plan[day] = (plan[day] || []).filter(item => item.recipeId !== id);
          });
        }
      });
    }
    this.saveState();
  }

  // --- WEEKLY PLANNER ---
  getWeeklyPlan() {
    return this.data.weeklyPlan;
  }

  addPlanItem(day, meal, recipeId, servings = 1.0, isIngredient = false) {
    if (!this.data.weeklyPlan[day]) {
      this.data.weeklyPlan[day] = [];
    }
    const item = {
      id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      meal: meal || 'Prânz',
      recipeId,
      servings: Math.max(0.01, parseFloat(servings) || 1.0),
      isIngredient: !!isIngredient
    };
    this.data.weeklyPlan[day].push(item);

    // Track in mealHistory for last 14 days statistics
    if (!this.data.mealHistory) {
      this.data.mealHistory = [];
    }
    this.data.mealHistory.push({
      meal: item.meal,
      recipeId: item.recipeId,
      isIngredient: item.isIngredient,
      timestamp: Date.now()
    });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    this.data.mealHistory = this.data.mealHistory.filter(h => h.timestamp > thirtyDaysAgo);

    this.saveState();
    return item;
  }

  addPlanItems(day, meal, itemsList) {
    if (!this.data.weeklyPlan[day]) {
      this.data.weeklyPlan[day] = [];
    }
    if (!this.data.mealHistory) {
      this.data.mealHistory = [];
    }

    const now = Date.now();
    itemsList.forEach((it, idx) => {
      const planItem = {
        id: 'plan_' + (now + idx) + '_' + Math.random().toString(36).substr(2, 4),
        meal: meal || 'Prânz',
        recipeId: it.recipeId || it.id,
        servings: Math.max(0.01, parseFloat(it.servings) || 1.0),
        isIngredient: !!it.isIngredient
      };
      this.data.weeklyPlan[day].push(planItem);
      this.data.mealHistory.push({
        meal: planItem.meal,
        recipeId: planItem.recipeId,
        isIngredient: planItem.isIngredient,
        timestamp: now
      });
    });

    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    this.data.mealHistory = this.data.mealHistory.filter(h => h.timestamp > thirtyDaysAgo);

    this.saveState();
  }

  // Get most used meals/recipes in the last 2 weeks for this meal category
  getFavoriteMealsForCategory(mealCategory, days = 14) {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const counts = {}; // id -> { count, isIngredient, isSeed }

    // 1. Scan mealHistory in last 14 days for this specific category
    const history = this.data.mealHistory || [];
    history.forEach(h => {
      if (h.meal === mealCategory && h.timestamp >= cutoff) {
        if (!counts[h.recipeId]) {
          counts[h.recipeId] = { count: 0, isIngredient: !!h.isIngredient };
        }
        counts[h.recipeId].count += 1;
      }
    });

    // 2. Scan weeklyPlan across all 7 days for this mealCategory
    const weeklyPlan = this.data.weeklyPlan || {};
    Object.keys(weeklyPlan).forEach(d => {
      (weeklyPlan[d] || []).forEach(item => {
        if (item.meal === mealCategory && item.recipeId) {
          if (!counts[item.recipeId]) {
            counts[item.recipeId] = { count: 0, isIngredient: !!item.isIngredient };
          }
          counts[item.recipeId].count += 2;
        }
      });
    });

    // 3. Seed / fallback relevance based on mealCategory keywords so favorites are populated immediately
    const lowerCategory = (mealCategory || '').toLowerCase();
    const allRecipes = this.data.recipes || [];

    allRecipes.forEach(rec => {
      const recLower = rec.name.toLowerCase();
      const recCat = (rec.category || '').toLowerCase();
      let seedScore = 0;

      if (lowerCategory.includes('mic dejun')) {
        if (recCat.includes('mic dejun') || recCat.includes('snacks') || /omlet|ovaz|iaurt|pancake|toast|ou|pui/i.test(recLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('prânz') || lowerCategory.includes('pranz')) {
        if (recCat.includes('mese mari') || /pui|orez|somon|vita|paste|cartofi|ciorba/i.test(recLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('cină') || lowerCategory.includes('cina')) {
        if (/salat|pastrav|supa|curry|legume|pui|somon/i.test(recLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('gustar') || lowerCategory.includes('snack')) {
        if (recCat.includes('snacks') || recCat.includes('desert') || /baton|iaurt|fruct|shake|smoothie|migdale|clatite|pancake|prajitur|ciocolat|mere/i.test(recLower)) {
          seedScore = 1;
        }
      }

      if (seedScore > 0) {
        if (!counts[rec.id]) {
          counts[rec.id] = { count: seedScore, isIngredient: false, isSeed: true };
        } else {
          counts[rec.id].count += seedScore;
        }
      }
    });

    // Also seed relevant base ingredients (e.g. Ouă, Banane, Iaurt, etc.)
    const allIngredients = this.data.ingredients || [];
    allIngredients.forEach(ing => {
      const ingLower = (ing.name || '').toLowerCase();
      const catLower = (ing.category || '').toLowerCase();
      let seedScore = 0;

      if (lowerCategory.includes('mic dejun')) {
        if (/ou|oua|lapte|ovaz|paine|unt|miere|banana/i.test(ingLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('prânz') || lowerCategory.includes('pranz')) {
        if (/pui|piept|somon|orez|cartof|vita|paste/i.test(ingLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('cină') || lowerCategory.includes('cina')) {
        if (/salat|rosii|castrav|branza|telemea|pastrav|ton/i.test(ingLower)) {
          seedScore = 1;
        }
      } else if (lowerCategory.includes('gustar') || lowerCategory.includes('snack')) {
        // Tag "Legume & Fructe" / "Fructe și Legume" and tag "Dulciuri"
        if (catLower.includes('fruct') || catLower.includes('legum') || catLower.includes('dulciur') || /mar|mere|banana|iaurt|migdale|nuci|caju|ciocolat|biscuit|afine|capsuni|portocal|struguri|morcov/i.test(ingLower)) {
          seedScore = 1;
        }
      }

      if (seedScore > 0) {
        if (!counts[ing.id]) {
          counts[ing.id] = { count: seedScore, isIngredient: true, isSeed: true };
        }
      }
    });

    // 4. Resolve full metadata
    const favorites = [];
    Object.keys(counts).forEach(id => {
      const info = counts[id];
      if (info.isIngredient) {
        const ing = this.getIngredientById(id);
        if (ing) {
          favorites.push({
            id: ing.id,
            name: ing.name,
            category: ing.category,
            isIngredient: true,
            count: info.count,
            isSeed: !!info.isSeed,
            calories: ing.calories,
            protein: ing.protein,
            carbs: ing.carbs,
            fat: ing.fat,
            cost: ing.pricePer100g,
            unitLabel: '100g'
          });
        }
      } else {
        const rawRec = this.getRecipeById(id);
        if (rawRec) {
          const calc = this.calculateRecipe(rawRec);
          favorites.push({
            id: rawRec.id,
            name: rawRec.name,
            category: rawRec.category,
            isIngredient: false,
            count: info.count,
            isSeed: !!info.isSeed,
            calories: calc.perServing.calories,
            protein: calc.perServing.protein,
            carbs: calc.perServing.carbs,
            fat: calc.perServing.fat,
            cost: calc.perServing.cost,
            unitLabel: 'porție'
          });
        }
      }
    });

    favorites.sort((a, b) => b.count - a.count);
    return favorites.slice(0, 16);
  }

  removePlanItem(day, itemId) {
    if (!this.data.weeklyPlan[day]) return;
    this.data.weeklyPlan[day] = this.data.weeklyPlan[day].filter(i => i.id !== itemId);
    this.saveState();
  }

  updatePlanItemServings(day, itemId, servings) {
    if (!this.data.weeklyPlan[day]) return;
    const item = this.data.weeklyPlan[day].find(i => i.id === itemId);
    if (item) {
      item.servings = Math.max(0.01, parseFloat(servings) || 0.01);
      this.saveState();
    }
  }

  copyDayPlan(sourceDay, targetDay) {
    if (!this.data.weeklyPlan[sourceDay]) return;
    const cloned = this.data.weeklyPlan[sourceDay].map(item => ({
      ...item,
      id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4)
    }));
    this.data.weeklyPlan[targetDay] = cloned;
    this.saveState();
  }

  // --- COPY MEAL & PLAN ITEMS ---
  copyMeal(sourceDay, sourceMeal, targetDay, targetMeal, overwrite = false) {
    if (!this.data.weeklyPlan[sourceDay]) return false;
    const sourceItems = this.data.weeklyPlan[sourceDay].filter(it => it.meal === sourceMeal);
    if (sourceItems.length === 0) return false;

    if (!this.data.weeklyPlan[targetDay]) {
      this.data.weeklyPlan[targetDay] = [];
    }

    if (overwrite) {
      this.data.weeklyPlan[targetDay] = this.data.weeklyPlan[targetDay].filter(it => it.meal !== targetMeal);
    }

    const now = Date.now();
    if (!this.data.mealHistory) this.data.mealHistory = [];

    const cloned = sourceItems.map((item, index) => {
      const newItem = {
        ...item,
        id: 'plan_' + now + '_' + index + '_' + Math.random().toString(36).substr(2, 4),
        meal: targetMeal
      };

      this.data.mealHistory.push({
        meal: targetMeal,
        recipeId: newItem.recipeId,
        isIngredient: !!newItem.isIngredient,
        timestamp: now
      });

      return newItem;
    });

    this.data.weeklyPlan[targetDay].push(...cloned);
    this.saveState();
    return true;
  }

  copyPlanItem(sourceDay, itemId, targetDay, targetMeal) {
    if (!this.data.weeklyPlan[sourceDay]) return false;
    const item = this.data.weeklyPlan[sourceDay].find(i => i.id === itemId);
    if (!item) return false;

    if (!this.data.weeklyPlan[targetDay]) {
      this.data.weeklyPlan[targetDay] = [];
    }

    const now = Date.now();
    const cloned = {
      ...item,
      id: 'plan_' + now + '_' + Math.random().toString(36).substr(2, 4),
      meal: targetMeal
    };

    this.data.weeklyPlan[targetDay].push(cloned);

    if (!this.data.mealHistory) this.data.mealHistory = [];
    this.data.mealHistory.push({
      meal: targetMeal,
      recipeId: cloned.recipeId,
      isIngredient: !!cloned.isIngredient,
      timestamp: now
    });

    this.saveState();
    return true;
  }

  // --- NUTRITIONAL TARGETS & SETTINGS ---
  getTargets() {
    const defaults = {
      calories: 2000,
      protein: 140,
      carbs: 220,
      fat: 65
    };
    if (!this.data.targets) {
      this.data.targets = { ...defaults };
    }
    return {
      calories: parseFloat(this.data.targets.calories) || defaults.calories,
      protein: parseFloat(this.data.targets.protein) || defaults.protein,
      carbs: parseFloat(this.data.targets.carbs) || defaults.carbs,
      fat: parseFloat(this.data.targets.fat) || defaults.fat
    };
  }

  updateTargets(targets) {
    if (!this.data.targets) this.data.targets = {};
    if (targets.calories !== undefined) this.data.targets.calories = Math.max(500, parseFloat(targets.calories) || 2000);
    if (targets.protein !== undefined) this.data.targets.protein = Math.max(10, parseFloat(targets.protein) || 140);
    if (targets.carbs !== undefined) this.data.targets.carbs = Math.max(10, parseFloat(targets.carbs) || 220);
    if (targets.fat !== undefined) this.data.targets.fat = Math.max(10, parseFloat(targets.fat) || 65);
    this.saveState();
  }

  // --- PROFILES MANAGEMENT ---
  getProfiles() {
    if (!this.data.profiles || !Array.isArray(this.data.profiles) || this.data.profiles.length === 0) {
      const curTargets = this.getTargets();
      this.data.profiles = [
        {
          id: 'prof_default',
          name: 'Utilizator',
          photo: '',
          gender: 'masculin',
          weight: 75,
          height: 178,
          calories: curTargets.calories || 2000,
          protein: curTargets.protein || 140,
          carbs: curTargets.carbs || 220,
          fat: curTargets.fat || 65,
          createdAt: Date.now()
        }
      ];
      this.data.activeProfileId = 'prof_default';
      this.saveState();
    }
    return this.data.profiles;
  }

  getActiveProfile() {
    const list = this.getProfiles();
    const active = list.find(p => p.id === this.data.activeProfileId) || list[0];
    return active;
  }

  setActiveProfile(profileId) {
    const list = this.getProfiles();
    const found = list.find(p => p.id === profileId);
    if (!found) return null;

    // 1. Save current active plan before switching
    if (!this.data.plansByProfile) {
      this.data.plansByProfile = {};
    }
    const currentId = this.data.activeProfileId || 'prof_default';
    if (this.data.weeklyPlan) {
      this.data.plansByProfile[currentId] = JSON.parse(JSON.stringify(this.data.weeklyPlan));
    }

    // 2. Set new active profile id
    this.data.activeProfileId = profileId;

    // 3. Switch weeklyPlan to new profile's plan
    const createEmptyWeekPlan = () => ({
      'Luni': [],
      'Marți': [],
      'Miercuri': [],
      'Joi': [],
      'Vineri': [],
      'Sâmbătă': [],
      'Duminică': []
    });

    if (!this.data.plansByProfile[profileId]) {
      this.data.plansByProfile[profileId] = createEmptyWeekPlan();
    }
    this.data.weeklyPlan = this.data.plansByProfile[profileId];

    // Synchronize daily targets with active profile
    this.updateTargets({
      calories: found.calories,
      protein: found.protein,
      carbs: found.carbs,
      fat: found.fat
    });

    this.saveState();
    return found;
  }

  addProfile(profileData) {
    const list = this.getProfiles();
    const newProfile = {
      id: 'prof_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: (profileData.name || 'Profil Nou').trim(),
      photo: profileData.photo || '',
      gender: profileData.gender || 'masculin',
      weight: parseFloat(profileData.weight) || 70,
      height: parseFloat(profileData.height) || 175,
      calories: Math.max(500, parseFloat(profileData.calories) || 2000),
      protein: Math.max(10, parseFloat(profileData.protein) || 140),
      carbs: Math.max(10, parseFloat(profileData.carbs) || 220),
      fat: Math.max(10, parseFloat(profileData.fat) || 65),
      createdAt: Date.now()
    };
    this.data.profiles.push(newProfile);

    // Initialize clean, blank weekly plan for this new profile
    if (!this.data.plansByProfile) {
      this.data.plansByProfile = {};
    }
    this.data.plansByProfile[newProfile.id] = {
      'Luni': [],
      'Marți': [],
      'Miercuri': [],
      'Joi': [],
      'Vineri': [],
      'Sâmbătă': [],
      'Duminică': []
    };

    this.setActiveProfile(newProfile.id);
    return newProfile;
  }

  updateProfile(profileId, patch) {
    const list = this.getProfiles();
    const idx = list.findIndex(p => p.id === profileId);
    if (idx === -1) return null;

    const cur = list[idx];
    const updated = {
      ...cur,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : cur.name,
      photo: patch.photo !== undefined ? patch.photo : cur.photo,
      gender: patch.gender !== undefined ? patch.gender : cur.gender,
      weight: patch.weight !== undefined ? parseFloat(patch.weight) : cur.weight,
      height: patch.height !== undefined ? parseFloat(patch.height) : cur.height,
      calories: patch.calories !== undefined ? Math.max(500, parseFloat(patch.calories)) : cur.calories,
      protein: patch.protein !== undefined ? Math.max(10, parseFloat(patch.protein)) : cur.protein,
      carbs: patch.carbs !== undefined ? Math.max(10, parseFloat(patch.carbs)) : cur.carbs,
      fat: patch.fat !== undefined ? Math.max(10, parseFloat(patch.fat)) : cur.fat
    };
    this.data.profiles[idx] = updated;

    if (this.data.activeProfileId === profileId) {
      this.updateTargets({
        calories: updated.calories,
        protein: updated.protein,
        carbs: updated.carbs,
        fat: updated.fat
      });
    }

    this.saveState();
    return updated;
  }

  deleteProfile(profileId) {
    const list = this.getProfiles();
    if (list.length <= 1) {
      return false; // Can't delete the only profile
    }
    const remaining = list.filter(p => p.id !== profileId);
    this.data.profiles = remaining;
    if (this.data.plansByProfile && this.data.plansByProfile[profileId]) {
      delete this.data.plansByProfile[profileId];
    }
    // Reassign recipes of deleted profile to first remaining profile
    if (this.data.recipes) {
      this.data.recipes.forEach(r => {
        if (r.profileId === profileId) {
          r.profileId = remaining[0].id;
        }
      });
    }
    if (this.data.activeProfileId === profileId) {
      this.setActiveProfile(remaining[0].id);
    } else {
      this.saveState();
    }
    return true;
  }

  clearDay(day) {
    this.data.weeklyPlan[day] = [];
    this.saveState();
  }

  clearWeek() {
    Object.keys(this.data.weeklyPlan).forEach(d => {
      this.data.weeklyPlan[d] = [];
    });
    this.saveState();
  }

  calculateDay(day) {
    const items = this.data.weeklyPlan[day] || [];
    let dayCost = 0;
    let dayCalories = 0;
    let dayProtein = 0;
    let dayCarbs = 0;
    let dayFat = 0;

    const computedItems = items.map(it => {
      const rawRecipe = this.getRecipeById(it.recipeId);
      if (rawRecipe) {
        const calc = this.calculateRecipe(rawRecipe);
        const portions = parseFloat(it.servings) || 1.0;
        const cost = calc.perServing.cost * portions;
        const cals = calc.perServing.calories * portions;
        const prot = calc.perServing.protein * portions;
        const carbs = calc.perServing.carbs * portions;
        const fat = calc.perServing.fat * portions;

        dayCost += cost;
        dayCalories += cals;
        dayProtein += prot;
        dayCarbs += carbs;
        dayFat += fat;

        return {
          ...it,
          recipeName: rawRecipe.name,
          category: rawRecipe.category,
          portions,
          cost,
          calories: cals,
          protein: prot,
          carbs,
          fat,
          calc
        };
      }

      // Check if it's an individual food / ingredient (1 portion = 100g)
      const rawIng = this.getIngredientById(it.recipeId);
      if (rawIng) {
        const portions = parseFloat(it.servings) || 1.0;
        const cost = rawIng.pricePer100g * portions;
        const cals = rawIng.calories * portions;
        const prot = rawIng.protein * portions;
        const carbs = rawIng.carbs * portions;
        const fat = rawIng.fat * portions;

        dayCost += cost;
        dayCalories += cals;
        dayProtein += prot;
        dayCarbs += carbs;
        dayFat += fat;

        return {
          ...it,
          recipeName: rawIng.name,
          category: rawIng.category,
          portions,
          cost,
          calories: cals,
          protein: prot,
          carbs,
          fat,
          isIngredient: true
        };
      }

      return {
        ...it,
        recipeName: 'Articol șters',
        cost: 0,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    });

    return {
      day,
      items: computedItems,
      totals: {
        cost: dayCost,
        calories: dayCalories,
        protein: dayProtein,
        carbs: dayCarbs,
        fat: dayFat
      }
    };
  }

  calculateWeek() {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const daysData = {};
    let weekCost = 0;
    let weekCalories = 0;
    let weekProtein = 0;
    let weekCarbs = 0;
    let weekFat = 0;

    days.forEach(day => {
      const d = this.calculateDay(day);
      daysData[day] = d;
      weekCost += d.totals.cost;
      weekCalories += d.totals.calories;
      weekProtein += d.totals.protein;
      weekCarbs += d.totals.carbs;
      weekFat += d.totals.fat;
    });

    return {
      days: daysData,
      totals: {
        cost: weekCost,
        calories: weekCalories,
        protein: weekProtein,
        carbs: weekCarbs,
        fat: weekFat,
        avgDailyCost: weekCost / 7,
        avgDailyCalories: weekCalories / 7,
        avgDailyProtein: weekProtein / 7,
        avgDailyCarbs: weekCarbs / 7,
        avgDailyFat: weekFat / 7
      }
    };
  }

  generateShoppingList() {
    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const ingredientUsage = {};

    days.forEach(day => {
      const items = this.data.weeklyPlan[day] || [];
      items.forEach(it => {
        const recipe = this.getRecipeById(it.recipeId);
        if (recipe) {
          const portionsMultiplier = (parseFloat(it.servings) || 1.0) / (parseFloat(recipe.servings) || 1.0);

          (recipe.ingredients || []).forEach(ri => {
            const dbIng = this.getIngredientById(ri.ingredientId) || this.findIngredientByName(ri.name);
            const key = dbIng ? dbIng.id : (ri.name || 'necunoscut');
            const qty = (parseFloat(ri.quantity) || 0) * portionsMultiplier;

            if (!ingredientUsage[key]) {
              ingredientUsage[key] = {
                ingredientId: dbIng ? dbIng.id : null,
                name: dbIng ? dbIng.name : ri.name,
                category: dbIng ? dbIng.category : 'Altele',
                totalGrams: 0,
                packageQuantity: dbIng ? dbIng.packageQuantity : 100,
                packagePrice: dbIng ? dbIng.packagePrice : 0
              };
            }
            ingredientUsage[key].totalGrams += qty;
          });
        } else {
          // Individual food / ingredient added to plan
          const dbIng = this.getIngredientById(it.recipeId);
          if (dbIng) {
            const key = dbIng.id;
            const qty = (parseFloat(it.servings) || 1.0) * 100;
            if (!ingredientUsage[key]) {
              ingredientUsage[key] = {
                ingredientId: dbIng.id,
                name: dbIng.name,
                category: dbIng.category || 'Altele',
                totalGrams: 0,
                packageQuantity: dbIng.packageQuantity || 100,
                packagePrice: dbIng.packagePrice || 0
              };
            }
            ingredientUsage[key].totalGrams += qty;
          }
        }
      });
    });

    // Calculate packages to buy and budget
    const list = Object.values(ingredientUsage).map(item => {
      const pkgQty = item.packageQuantity > 0 ? item.packageQuantity : 100;
      const packagesToBuy = Math.ceil(item.totalGrams / pkgQty);
      const estimatedCost = packagesToBuy * item.packagePrice;
      return {
        ...item,
        totalGrams: Math.round(item.totalGrams * 10) / 10,
        packagesToBuy,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        unit: item.category === 'Grăsimi & Uleiuri' && item.packageQuantity === 500 ? 'ml' : 'g'
      };
    });

    // Sort by category then name
    list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    const totalBudget = list.reduce((acc, curr) => acc + curr.estimatedCost, 0);

    return {
      items: list,
      totalBudget: Math.round(totalBudget * 100) / 100,
      totalItemsCount: list.length
    };
  }

  calculateWeekForProfile(profileId) {
    const defaultId = (this.data.profiles && this.data.profiles[0]?.id) || 'prof_default';
    const plan = (this.data.plansByProfile && this.data.plansByProfile[profileId]) ||
                 (this.data.activeProfileId === profileId ? this.data.weeklyPlan : null) || {};

    const days = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const daysData = {};
    let weekCost = 0;
    let weekCalories = 0;
    let weekProtein = 0;
    let weekCarbs = 0;
    let weekFat = 0;
    let totalItems = 0;

    days.forEach(day => {
      const items = plan[day] || [];
      let dayCost = 0;
      let dayCalories = 0;
      let dayProtein = 0;
      let dayCarbs = 0;
      let dayFat = 0;

      const computedItems = items.map(it => {
        totalItems++;
        const rawRecipe = this.getRecipeById(it.recipeId);
        if (rawRecipe) {
          const calc = this.calculateRecipe(rawRecipe);
          const portions = parseFloat(it.servings) || 1.0;
          const cost = calc.perServing.cost * portions;
          const cals = calc.perServing.calories * portions;
          const prot = calc.perServing.protein * portions;
          const carbs = calc.perServing.carbs * portions;
          const fat = calc.perServing.fat * portions;

          dayCost += cost;
          dayCalories += cals;
          dayProtein += prot;
          dayCarbs += carbs;
          dayFat += fat;

          return {
            ...it,
            recipeName: rawRecipe.name,
            category: rawRecipe.category,
            portions,
            cost,
            calories: cals,
            protein: prot,
            carbs,
            fat,
            calc
          };
        }

        const rawIng = this.getIngredientById(it.recipeId);
        if (rawIng) {
          const portions = parseFloat(it.servings) || 1.0;
          const cost = rawIng.pricePer100g * portions;
          const cals = rawIng.calories * portions;
          const prot = rawIng.protein * portions;
          const carbs = rawIng.carbs * portions;
          const fat = rawIng.fat * portions;

          dayCost += cost;
          dayCalories += cals;
          dayProtein += prot;
          dayCarbs += carbs;
          dayFat += fat;

          return {
            ...it,
            recipeName: rawIng.name,
            category: rawIng.category,
            portions,
            cost,
            calories: cals,
            protein: prot,
            carbs,
            fat,
            isIngredient: true
          };
        }

        return {
          ...it,
          recipeName: 'Articol șters',
          cost: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };
      });

      daysData[day] = {
        day,
        items: computedItems,
        totals: {
          cost: dayCost,
          calories: dayCalories,
          protein: dayProtein,
          carbs: dayCarbs,
          fat: dayFat
        }
      };

      weekCost += dayCost;
      weekCalories += dayCalories;
      weekProtein += dayProtein;
      weekCarbs += dayCarbs;
      weekFat += dayFat;
    });

    return {
      profileId,
      days: daysData,
      totalItems,
      totals: {
        cost: weekCost,
        calories: weekCalories,
        protein: weekProtein,
        carbs: weekCarbs,
        fat: weekFat,
        avgDailyCost: weekCost / 7,
        avgDailyCalories: weekCalories / 7,
        avgDailyProtein: weekProtein / 7,
        avgDailyCarbs: weekCarbs / 7,
        avgDailyFat: weekFat / 7
      }
    };
  }

  calculateAllProfilesTotal() {
    const profiles = this.getProfiles();
    const defaultProfileId = (profiles && profiles[0]?.id) || 'prof_default';

    // 1. Weekly plans calculated per profile
    const profilesPlanData = profiles.map(p => {
      const weekCalc = this.calculateWeekForProfile(p.id);
      return {
        profile: p,
        ...weekCalc
      };
    });

    // 2. Custom recipes entered per profile
    const allRecipes = this.data.recipes || [];
    const knownProfileIds = new Set(profiles.map(p => p.id));

    const recipesByProfile = profiles.map(p => {
      const pRecipes = allRecipes.filter(r => {
        if (!r.isCustom) return false;
        const ownerId = this.getRecipeOwnerId(r);
        if (ownerId === p.id) return true;
        if (!knownProfileIds.has(ownerId) && p.id === defaultProfileId) return true;
        return false;
      });
      const computedRecipes = pRecipes.map(r => this.calculateRecipe(r));
      const totalCost = computedRecipes.reduce((sum, r) => sum + (r?.totals?.cost || 0), 0);
      const totalCalories = computedRecipes.reduce((sum, r) => sum + (r?.totals?.calories || 0), 0);
      const totalProtein = computedRecipes.reduce((sum, r) => sum + (r?.totals?.protein || 0), 0);
      const totalWeight = computedRecipes.reduce((sum, r) => sum + (r?.totals?.weight || 0), 0);

      return {
        profile: p,
        recipes: computedRecipes,
        totalCost,
        totalCalories,
        totalProtein,
        totalWeight
      };
    });

    // Common/catalog recipes
    const commonRecipes = allRecipes.filter(r => !r.isCustom).map(r => this.calculateRecipe(r));
    const commonCost = commonRecipes.reduce((sum, r) => sum + r.totals.cost, 0);

    const grandTotalWeeklyCost = profilesPlanData.reduce((sum, item) => sum + item.totals.cost, 0);
    const grandTotalWeeklyCalories = profilesPlanData.reduce((sum, item) => sum + item.totals.calories, 0);
    const grandTotalWeeklyProtein = profilesPlanData.reduce((sum, item) => sum + item.totals.protein, 0);
    const grandTotalWeeklyItems = profilesPlanData.reduce((sum, item) => sum + item.totalItems, 0);

    const grandTotalCreatedRecipesCost = recipesByProfile.reduce((sum, item) => sum + item.totalCost, 0);
    const grandTotalCreatedRecipesCount = recipesByProfile.reduce((sum, item) => sum + item.recipes.length, 0);

    return {
      profiles,
      profilesPlanData,
      recipesByProfile,
      commonRecipes,
      commonCost,
      totals: {
        grandTotalWeeklyCost,
        grandTotalWeeklyCalories,
        grandTotalWeeklyProtein,
        grandTotalWeeklyItems,
        grandTotalCreatedRecipesCost,
        grandTotalCreatedRecipesCount
      }
    };
  }

  exportDataJson() {
    return JSON.stringify(this.data, null, 2);
  }

  importDataJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.ingredients && parsed.recipes && parsed.weeklyPlan) {
        this.data = parsed;
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  }
}

window.store = new NutriStore();
