// Asistent Inteligent NutriChef — Creare Rețete & Căutare Valori Online
class NutriChefAssistant {
  constructor() {
    this.geminiApiKey = localStorage.getItem('nutri_gemini_key') || '';
    
    // Romanian Supermarket Market Price & Macro Benchmark Catalog (Lidl, Kaufland, Carrefour, Mega Image)
    this.priceBenchmarks = [
      { keywords: ['piept', 'pui', 'curcan', 'file'], cat: 'Carne & Pește', avgPerKg: 30.0, defaultPackG: 650, kcal: 120, prot: 24.0, carbs: 0, fat: 2.5 },
      { keywords: ['pulp', 'ciocan'], cat: 'Carne & Pește', avgPerKg: 20.0, defaultPackG: 700, kcal: 180, prot: 19.0, carbs: 0, fat: 11.0 },
      { keywords: ['porc', 'cotlet', 'ceafa', 'muschi'], cat: 'Carne & Pește', avgPerKg: 28.0, defaultPackG: 500, kcal: 230, prot: 21.0, carbs: 0, fat: 16.0 },
      { keywords: ['vita', 'manzat'], cat: 'Carne & Pește', avgPerKg: 55.0, defaultPackG: 500, kcal: 215, prot: 22.0, carbs: 0, fat: 14.0 },
      { keywords: ['somon'], cat: 'Carne & Pește', avgPerKg: 85.0, defaultPackG: 300, kcal: 208, prot: 20.0, carbs: 0, fat: 13.0 },
      { keywords: ['ton', 'conserva'], cat: 'Carne & Pește', avgPerKg: 60.0, defaultPackG: 160, kcal: 116, prot: 26.0, carbs: 0, fat: 1.0 },
      { keywords: ['peste', 'cod', 'pastrav', 'dorada'], cat: 'Carne & Pește', avgPerKg: 45.0, defaultPackG: 400, kcal: 110, prot: 20.0, carbs: 0, fat: 3.0 },
      { keywords: ['ou', 'oua'], cat: 'Ouă & Lactate', avgPerKg: 26.0, defaultPackG: 500, kcal: 145, prot: 13.0, carbs: 1.0, fat: 10.0 },
      { keywords: ['lapte'], cat: 'Ouă & Lactate', avgPerKg: 7.5, defaultPackG: 1000, kcal: 50, prot: 3.4, carbs: 4.8, fat: 1.5 },
      { keywords: ['iaurt', 'grecesc', 'skyr'], cat: 'Ouă & Lactate', avgPerKg: 18.0, defaultPackG: 400, kcal: 95, prot: 8.5, carbs: 4.0, fat: 5.0 },
      { keywords: ['branza', 'telemea', 'cottage', 'fagaras'], cat: 'Ouă & Lactate', avgPerKg: 35.0, defaultPackG: 300, kcal: 185, prot: 14.0, carbs: 2.5, fat: 13.0 },
      { keywords: ['mozzarella', 'cascaval'], cat: 'Ouă & Lactate', avgPerKg: 45.0, defaultPackG: 250, kcal: 280, prot: 22.0, carbs: 1.5, fat: 21.0 },
      { keywords: ['unt'], cat: 'Grăsimi & Uleiuri', avgPerKg: 50.0, defaultPackG: 200, kcal: 745, prot: 0.8, carbs: 0.7, fat: 82.0 },
      { keywords: ['smantana'], cat: 'Ouă & Lactate', avgPerKg: 22.0, defaultPackG: 300, kcal: 195, prot: 2.8, carbs: 3.5, fat: 20.0 },
      { keywords: ['orez', 'basmati', 'iasomie'], cat: 'Cereale & Paste', avgPerKg: 9.5, defaultPackG: 1000, kcal: 355, prot: 7.5, carbs: 78.0, fat: 1.0 },
      { keywords: ['paste', 'spaghete', 'penne', 'barilla'], cat: 'Cereale & Paste', avgPerKg: 9.0, defaultPackG: 500, kcal: 350, prot: 12.5, carbs: 72.0, fat: 1.5 },
      { keywords: ['ovaz', 'fulgi'], cat: 'Cereale & Paste', avgPerKg: 8.0, defaultPackG: 500, kcal: 375, prot: 13.5, carbs: 62.0, fat: 7.0 },
      { keywords: ['paine', 'toast', 'lipie', 'tortilla'], cat: 'Cereale & Paste', avgPerKg: 10.0, defaultPackG: 500, kcal: 250, prot: 9.0, carbs: 48.0, fat: 2.0 },
      { keywords: ['cartof', 'cartofi'], cat: 'Legume & Fructe', avgPerKg: 4.0, defaultPackG: 1000, kcal: 77, prot: 2.0, carbs: 17.5, fat: 0.1 },
      { keywords: ['ciuperci', 'champignon'], cat: 'Legume & Fructe', avgPerKg: 14.0, defaultPackG: 500, kcal: 22, prot: 3.1, carbs: 3.3, fat: 0.3 },
      { keywords: ['rosii', 'rosie'], cat: 'Legume & Fructe', avgPerKg: 8.5, defaultPackG: 500, kcal: 18, prot: 0.9, carbs: 3.9, fat: 0.2 },
      { keywords: ['castraveti', 'castravete'], cat: 'Legume & Fructe', avgPerKg: 7.0, defaultPackG: 500, kcal: 15, prot: 0.7, carbs: 3.6, fat: 0.1 },
      { keywords: ['ardei', 'kapia', 'gogosar'], cat: 'Legume & Fructe', avgPerKg: 12.0, defaultPackG: 500, kcal: 26, prot: 1.0, carbs: 5.3, fat: 0.2 },
      { keywords: ['ceapa', 'usturoi'], cat: 'Legume & Fructe', avgPerKg: 5.0, defaultPackG: 500, kcal: 40, prot: 1.1, carbs: 9.3, fat: 0.1 },
      { keywords: ['spanac', 'salata', 'baby'], cat: 'Legume & Fructe', avgPerKg: 28.0, defaultPackG: 200, kcal: 23, prot: 2.9, carbs: 3.6, fat: 0.4 },
      { keywords: ['broccoli'], cat: 'Legume & Fructe', avgPerKg: 12.0, defaultPackG: 500, kcal: 34, prot: 2.8, carbs: 6.6, fat: 0.4 },
      { keywords: ['avocado'], cat: 'Legume & Fructe', avgPerKg: 25.0, defaultPackG: 200, kcal: 160, prot: 2.0, carbs: 8.5, fat: 14.7 },
      { keywords: ['banana', 'banane'], cat: 'Legume & Fructe', avgPerKg: 6.5, defaultPackG: 1000, kcal: 89, prot: 1.1, carbs: 22.8, fat: 0.3 },
      { keywords: ['mar', 'mere'], cat: 'Legume & Fructe', avgPerKg: 5.0, defaultPackG: 1000, kcal: 52, prot: 0.3, carbs: 13.8, fat: 0.2 },
      { keywords: ['fructe de padure', 'afine', 'capsuni'], cat: 'Legume & Fructe', avgPerKg: 35.0, defaultPackG: 300, kcal: 57, prot: 0.7, carbs: 14.5, fat: 0.3 },
      { keywords: ['ulei de masline', 'masline'], cat: 'Grăsimi & Uleiuri', avgPerKg: 55.0, defaultPackG: 1000, kcal: 884, prot: 0, carbs: 0, fat: 100.0 },
      { keywords: ['ulei'], cat: 'Grăsimi & Uleiuri', avgPerKg: 8.5, defaultPackG: 1000, kcal: 884, prot: 0, carbs: 0, fat: 100.0 },
      { keywords: ['nuci', 'migdale', 'arahide', 'caju'], cat: 'Grăsimi & Uleiuri', avgPerKg: 60.0, defaultPackG: 200, kcal: 620, prot: 18.0, carbs: 16.0, fat: 55.0 },
      { keywords: ['ciocolata'], cat: 'Dulciuri', avgPerKg: 45.0, defaultPackG: 100, kcal: 540, prot: 6.5, carbs: 54.0, fat: 33.0 },
      { keywords: ['proteina', 'whey', 'pudra'], cat: 'Ouă & Lactate', avgPerKg: 130.0, defaultPackG: 1000, kcal: 380, prot: 75.0, carbs: 8.0, fat: 5.0 }
    ];
  }

  // Estimate price and category for any ingredient name using Romanian market data
  estimateMarketData(name, quantityGrams = 100) {
    const clean = name.toLowerCase().trim();
    let best = this.priceBenchmarks.find(b => b.keywords.some(k => clean.includes(k)));
    if (!best) {
      best = {
        cat: 'Ingrediente',
        avgPerKg: 20.0,
        defaultPackG: 500,
        kcal: 150,
        prot: 5.0,
        carbs: 20.0,
        fat: 4.0
      };
    }
    const packQty = best.defaultPackG;
    const packPrice = parseFloat(((best.avgPerKg * packQty) / 1000).toFixed(2));
    const pricePer100g = parseFloat((packPrice / (packQty / 100)).toFixed(2));

    return {
      category: best.cat,
      packageQuantity: packQty,
      packagePrice: packPrice,
      pricePer100g,
      calories: best.kcal,
      protein: best.prot,
      carbs: best.carbs,
      fat: best.fat
    };
  }

  // 1. Search online products (Open Food Facts + Romanian DB)
  async searchOnlineProducts(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim();

    const results = [];

    // 1. Live Query Open Food Facts via modern Search-a-licious API
    try {
      const resp = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=8`, {
        headers: { 'Accept': 'application/json' }
      });
      if (resp.ok) {
        const json = await resp.json();
        const hits = json.hits || [];
        hits.forEach(h => {
          const name = h.product_name || h.product_name_ro || h.product_name_en || '';
          if (!name) return;
          const brands = Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands || '');
          const nut = h.nutriments || {};

          // Extract pack weight
          let packG = 100;
          if (h.quantity) {
            const m = String(h.quantity).match(/([0-9.,]+)\s*(g|gr|gram|ml|l|kg)/i);
            if (m) {
              const val = parseFloat(m[1].replace(',', '.'));
              const unit = m[2].toLowerCase();
              packG = (unit === 'kg' || unit === 'l') ? val * 1000 : val;
            }
          }

          // Estimate price in RON
          const market = this.estimateMarketData(name + ' ' + brands, packG);
          const packPrice = parseFloat(((market.pricePer100g * packG) / 100).toFixed(2));

          const calories = Math.round(nut['energy-kcal_100g'] || (nut.energy_100g ? nut.energy_100g / 4.184 : market.calories));
          const protein = parseFloat(Number(nut.proteins_100g ?? market.protein).toFixed(1));
          const carbs = parseFloat(Number(nut.carbohydrates_100g ?? market.carbs).toFixed(1));
          const fat = parseFloat(Number(nut.fat_100g ?? market.fat).toFixed(1));
          const fiber = parseFloat(Number(nut.fiber_100g ?? 0).toFixed(1));

          results.push({
            id: 'off_' + (h.code || Math.random().toString(36).substr(2, 6)),
            name: brands ? `${name} (${brands})` : name,
            rawName: name,
            brand: brands,
            ean: h.code || '',
            category: market.category,
            packageQuantity: packG,
            packagePrice: packPrice > 0 ? packPrice : market.packagePrice,
            pricePer100g: parseFloat(((packPrice > 0 ? packPrice : market.packagePrice) / (packG / 100)).toFixed(2)),
            calories,
            protein,
            carbs,
            fat,
            fiber,
            imageUrl: h.image_url || h.image_front_small_url || '',
            source: 'Open Food Facts Online'
          });
        });
      }
    } catch (e) {
      console.warn('Open Food Facts online search error:', e);
    }

    // 2. Also match from Local Pantry & Benchmarks if results are few
    if (results.length < 3) {
      const localMatches = (window.store ? window.store.data.ingredients : [])
        .filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 3);

      localMatches.forEach(i => {
        if (!results.some(r => r.name.toLowerCase() === i.name.toLowerCase())) {
          results.push({
            id: i.id,
            name: i.name,
            rawName: i.name,
            brand: 'Local Pantry',
            ean: i.ean || '',
            category: i.category,
            packageQuantity: i.packageQuantity,
            packagePrice: i.packagePrice,
            pricePer100g: i.pricePer100g,
            calories: i.calories,
            protein: i.protein,
            carbs: i.carbs,
            fat: i.fat,
            fiber: 0,
            imageUrl: '',
            source: 'Baza Locală'
          });
        }
      });

      // Match from benchmarks
      const bMatches = this.priceBenchmarks.filter(b => b.keywords.some(k => q.toLowerCase().includes(k) || k.includes(q.toLowerCase()))).slice(0, 2);
      bMatches.forEach((b, idx) => {
        const title = q.charAt(0).toUpperCase() + q.slice(1);
        if (!results.some(r => r.name.toLowerCase().includes(q.toLowerCase()))) {
          const packPrice = parseFloat(((b.avgPerKg * b.defaultPackG) / 1000).toFixed(2));
          results.push({
            id: 'bm_' + idx,
            name: title,
            rawName: title,
            brand: 'Piața RO (Lidl/Kaufland)',
            ean: '',
            category: b.cat,
            packageQuantity: b.defaultPackG,
            packagePrice: packPrice,
            pricePer100g: parseFloat((packPrice / (b.defaultPackG / 100)).toFixed(2)),
            calories: b.kcal,
            protein: b.prot,
            carbs: b.carbs,
            fat: b.fat,
            fiber: 1.0,
            imageUrl: '',
            source: 'Estimare Piață România'
          });
        }
      });
    }

    return results;
  }

  // 2. AI Recipe Generator from user-supplied ingredients
  async generateRecipe(options) {
    const rawInput = options.ingredients || '';
    const servings = Math.max(1, parseInt(options.servings) || 2);
    const mealType = options.mealType || 'Prânz';
    const goal = options.goal || 'balanced'; // balanced, high_protein, low_calorie, keto, budget, quick

    // If Gemini API Key is available, try generative AI first
    if (this.geminiApiKey) {
      try {
        const prompt = `Ești un chef nutriționist profesionist. Creează o rețetă delicioasă, sănătoasă și realistă în limba română bazată pe aceste ingrediente: "${rawInput}".
Număr porții: ${servings}.
Tip masă: ${mealType}.
Obiectiv nutrițional: ${goal}.
Răspunde STRICT în format JSON valid fără markdown, cu următoarea structură:
{
  "name": "Numele Rețetei",
  "category": "${mealType}",
  "servings": ${servings},
  "prepTime": "25 min",
  "difficulty": "Ușor",
  "ingredients": [
    { "name": "Nume ingredient", "quantityGrams": 200, "calories100g": 120, "protein100g": 24, "carbs100g": 0, "fat100g": 2.5, "pricePer100g": 3.0 }
  ],
  "instructions": [
    "Pasul 1...",
    "Pasul 2...",
    "Pasul 3..."
  ],
  "chefTips": "Sfat util pentru gust și macronutrienți"
}`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
          })
        });

        if (resp.ok) {
          const resJson = await resp.json();
          let text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(text);
          return this.processGeneratedRecipe(parsed, servings, mealType);
        }
      } catch (err) {
        console.warn('Gemini generative failed, falling back to built-in culinary AI engine:', err);
      }
    }

    // Built-in Intelligent Culinary Engine (Instant, Offline & Zero-Latency)
    return this.buildRecipeWithSmartEngine(rawInput, servings, mealType, goal);
  }

  // Built-in intelligent recipe synthesis algorithm
  buildRecipeWithSmartEngine(rawInput, servings, mealType, goal) {
    const rawTokens = rawInput.toLowerCase()
      .split(/[,;\n+]+/)
      .map(s => s.trim())
      .filter(s => s.length > 1);

    const ingTokens = rawTokens.length > 0 ? rawTokens : ['piept de pui', 'orez', 'legume'];

    // Resolve ingredients and calculate quantities per portion
    const ingredientsList = [];

    // Culinary role identification
    let hasProtein = false;
    let hasCarb = false;
    let hasVeggie = false;
    let mainProteinName = '';
    let mainCarbName = '';
    let mainVeggieName = '';

    ingTokens.forEach((token, idx) => {
      // 1. Look in store ingredients
      let matched = window.store ? window.store.findIngredientByName(token) : null;
      let est = this.estimateMarketData(token);

      const ingName = matched ? matched.name : (token.charAt(0).toUpperCase() + token.slice(1));
      const calories = matched ? matched.calories : est.calories;
      const protein = matched ? matched.protein : est.protein;
      const carbs = matched ? matched.carbs : est.carbs;
      const fat = matched ? matched.fat : est.fat;
      const pricePer100g = matched ? matched.pricePer100g : est.pricePer100g;

      // Determine portion size based on macronutrient profile & role
      let gramsPerServing = 100;
      if (protein > 15 && carbs < 10) {
        // Meat / Fish / Tofu
        gramsPerServing = goal === 'high_protein' ? 220 : 175;
        hasProtein = true;
        if (!mainProteinName) mainProteinName = ingName;
      } else if (carbs > 40) {
        // Grains, Rice, Pasta, Oats
        gramsPerServing = goal === 'low_calorie' || goal === 'keto' ? 45 : (goal === 'high_protein' ? 80 : 70);
        hasCarb = true;
        if (!mainCarbName) mainCarbName = ingName;
      } else if (fat > 30) {
        // Oils, Nuts, Butter
        gramsPerServing = 15;
      } else if (calories < 60) {
        // Veggies / Greens
        gramsPerServing = 120;
        hasVeggie = true;
        if (!mainVeggieName) mainVeggieName = ingName;
      } else {
        gramsPerServing = 100;
      }

      const totalQuantity = Math.round(gramsPerServing * servings);

      ingredientsList.push({
        name: ingName,
        quantityGrams: totalQuantity,
        gramsPerServing,
        calories100g: calories,
        protein100g: protein,
        carbs100g: carbs,
        fat100g: fat,
        pricePer100g,
        category: matched ? matched.category : est.category,
        existingId: matched ? matched.id : null
      });
    });

    // Generate enticing title
    let recipeTitle = '';
    if (mealType === 'Mic Dejun') {
      if (mainProteinName.toLowerCase().includes('ou')) {
        recipeTitle = `Omletă Sățioasă cu ${mainVeggieName || 'Verdețuri'} & Brânză`;
      } else if (mainCarbName.toLowerCase().includes('ovaz')) {
        recipeTitle = `Bol Cald de Ovăz Proteic cu Fructe`;
      } else {
        recipeTitle = `Mic Dejun Nutritiv cu ${ingTokens.slice(0, 2).join(' & ')}`;
      }
    } else if (mealType === 'Snacks') {
      recipeTitle = `Gustare Rapidă cu ${ingTokens.slice(0, 2).join(' & ')}`;
    } else {
      // Lunch / Dinner
      if (mainProteinName && mainCarbName) {
        recipeTitle = `${mainProteinName} Rumenit la Tigaie cu ${mainCarbName} & ${mainVeggieName || 'Legume Proaspete'}`;
      } else if (mainProteinName) {
        recipeTitle = `${mainProteinName} la Cuptor cu Ierburi Aromatice & Garnitură`;
      } else {
        recipeTitle = `Preparat Sănătos cu ${ingTokens.slice(0, 2).join(', ')}`;
      }
    }

    // Generate clear, logical instructions
    const instructions = [
      `1. Pregătirea: Spală și cântărește ingredientele conform gramajelor indicate. Taie ingredientele în bucăți egale pentru gătire uniformă.`,
      hasCarb ? `2. Baza de carbohidrați: Fierbe ${mainCarbName || 'garnitura'} în apă cu un praf de sare conform instrucțiunilor (aprox. 12-15 minute), apoi scurge bine.` : `2. Pregătește baza: Pune tigaia la încins cu puțin ulei la foc mediu.`,
      hasProtein ? `3. Proteina: Condimentează ${mainProteinName || 'carnea'} cu sare, piper, boia sau ierburi preferate. Rumenește la tigaie sau cuptor timp de 8-12 minute până devine aurie și suculentă.` : `3. Călește ingredientele principale timp de 6-8 minute până devin fragede.`,
      hasVeggie ? `4. Legumele: Adaugă ${mainVeggieName || 'legumele'} peste preparat și sotează-le 4-5 minute pentru a-și păstra textura crocantă și nutrienții.` : `4. Omogenizează aromele și lasă focul mic încă 2 minute.`,
      `5. Montare & Servire: Împarte mâncarea în mod egal în ${servings} ${servings === 1 ? 'farfurie' : 'farfurii / caserole'}. Poftă bună!`
    ];

    const prepTime = hasCarb || hasProtein ? '25 min' : '15 min';
    const difficulty = ingredientsList.length > 4 ? 'Mediu' : 'Ușor';

    return this.processGeneratedRecipe({
      name: recipeTitle,
      category: mealType,
      servings,
      prepTime,
      difficulty,
      ingredients: ingredientsList,
      instructions,
      chefTips: goal === 'high_protein'
        ? 'Bogată în proteine de înaltă calitate pentru recuperare musculară și sațietate prelungită.'
        : 'Rețetă echilibrată caloric, excelentă atât caldă cât și la caserolă a doua zi.'
    }, servings, mealType);
  }

  // Process and calculate full macro & cost totals
  processGeneratedRecipe(recipeData, servings, mealType) {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalCost = 0;

    const processedIngredients = (recipeData.ingredients || []).map(ing => {
      const qty = parseFloat(ing.quantityGrams) || 100;
      const cals = ((parseFloat(ing.calories100g) || 0) * qty) / 100;
      const prot = ((parseFloat(ing.protein100g) || 0) * qty) / 100;
      const carbs = ((parseFloat(ing.carbs100g) || 0) * qty) / 100;
      const fat = ((parseFloat(ing.fat100g) || 0) * qty) / 100;
      const cost = ((parseFloat(ing.pricePer100g) || 0) * qty) / 100;

      totalCalories += cals;
      totalProtein += prot;
      totalCarbs += carbs;
      totalFat += fat;
      totalCost += cost;

      return {
        ...ing,
        totalGrams: qty,
        gramsPerServing: Math.round(qty / servings),
        caloriesTotal: Math.round(cals),
        proteinTotal: parseFloat(prot.toFixed(1)),
        carbsTotal: parseFloat(carbs.toFixed(1)),
        fatTotal: parseFloat(fat.toFixed(1)),
        costTotal: parseFloat(cost.toFixed(2))
      };
    });

    return {
      name: recipeData.name || 'Rețetă Asistent AI',
      category: mealType || recipeData.category || 'Prânz',
      servings,
      prepTime: recipeData.prepTime || '20 min',
      difficulty: recipeData.difficulty || 'Ușor',
      chefTips: recipeData.chefTips || '',
      ingredients: processedIngredients,
      instructions: recipeData.instructions || [],
      totals: {
        calories: Math.round(totalCalories),
        protein: parseFloat(totalProtein.toFixed(1)),
        carbs: parseFloat(totalCarbs.toFixed(1)),
        fat: parseFloat(totalFat.toFixed(1)),
        cost: parseFloat(totalCost.toFixed(2))
      },
      perServing: {
        calories: Math.round(totalCalories / servings),
        protein: parseFloat((totalProtein / servings).toFixed(1)),
        carbs: parseFloat((totalCarbs / servings).toFixed(1)),
        fat: parseFloat((totalFat / servings).toFixed(1)),
        cost: parseFloat((totalCost / servings).toFixed(2))
      }
    };
  }

  // 3. Save generated recipe into store database
  saveRecipeToStore(recipeObj) {
    if (!window.store) return null;

    // Ensure all ingredients exist in store.ingredients
    const storeIngredients = [];

    recipeObj.ingredients.forEach(ing => {
      let existing = ing.existingId ? window.store.getIngredientById(ing.existingId) : window.store.findIngredientByName(ing.name);
      if (!existing) {
        // Register it
        const market = this.estimateMarketData(ing.name, ing.totalGrams || 500);
        existing = window.store.addIngredient({
          name: ing.name,
          category: ing.category || market.category,
          packageQuantity: market.packageQuantity,
          packagePrice: market.packagePrice,
          calories: ing.calories100g || market.calories,
          protein: ing.protein100g || market.protein,
          carbs: ing.carbs100g || market.carbs,
          fat: ing.fat100g || market.fat
        });
      }

      if (existing) {
        storeIngredients.push({
          ingredientId: existing.id,
          quantity: ing.totalGrams
        });
      }
    });

    const fullNotes = [
      `Timp: ${recipeObj.prepTime} | Dificultate: ${recipeObj.difficulty}`,
      recipeObj.chefTips ? `Sfat Chef: ${recipeObj.chefTips}` : '',
      '',
      'Mod de preparare:',
      ...(recipeObj.instructions || [])
    ].filter(Boolean).join('\n');

    const created = window.store.addRecipe({
      name: recipeObj.name,
      category: recipeObj.category,
      servings: recipeObj.servings,
      ingredients: storeIngredients,
      notes: fullNotes
    });

    return created;
  }
}

// Global singleton instance
window.nutriAssistant = new NutriChefAssistant();
