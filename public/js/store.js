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
          // If corrupted items were purged, save the cleaned state immediately
          if (parsed.ingredients.length !== originalLength) {
            try { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(parsed)); } catch(e) {}
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read from localStorage, using initial data:', e);
    }
    return JSON.parse(JSON.stringify(window.INITIAL_DATA));
  }

  saveState() {
    try {
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
  getRecipes(category = 'Toate', searchQuery = '') {
    let list = this.data.recipes || [];
    if (category && category !== 'Toate') {
      list = list.filter(r => r.category === category);
    }
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => r.name.toLowerCase().includes(q));
    }
    return list;
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
    const id = 'rec_' + Date.now();
    const newRecipe = {
      id,
      name: rec.name.trim(),
      category: rec.category || 'Mese Mari',
      servings: Math.max(1, parseFloat(rec.servings) || 1),
      ingredients: rec.ingredients || [],
      notes: rec.notes || ''
    };
    this.data.recipes.push(newRecipe);
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
    // Remove from weekly plans
    Object.keys(this.data.weeklyPlan).forEach(day => {
      this.data.weeklyPlan[day] = this.data.weeklyPlan[day].filter(item => item.recipeId !== id);
    });
    this.saveState();
  }

  // --- WEEKLY PLANNER ---
  getWeeklyPlan() {
    return this.data.weeklyPlan;
  }

  addPlanItem(day, meal, recipeId, servings = 1.0) {
    if (!this.data.weeklyPlan[day]) {
      this.data.weeklyPlan[day] = [];
    }
    const item = {
      id: 'plan_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      meal: meal || 'Prânz',
      recipeId,
      servings: parseFloat(servings) || 1.0
    };
    this.data.weeklyPlan[day].push(item);
    this.saveState();
    return item;
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
      item.servings = Math.max(0.1, parseFloat(servings) || 1.0);
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
      if (!rawRecipe) {
        return {
          ...it,
          recipeName: 'Rețetă ștearsă',
          cost: 0,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0
        };
      }
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
        if (!recipe) return;
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
