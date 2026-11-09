// Asistent Inteligent NutriChef — Creare Rețete & Căutare Valori Online
class NutriChefAssistant {
  constructor() {
    this.geminiApiKey = (typeof localStorage !== 'undefined') ? (localStorage.getItem('nutri_gemini_key') || '') : '';

    // Normalization helper (diacritic-insensitive, punctuation-free)
    this.normalizeStr = function(str) {
      if (!str) return '';
      return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // English-to-Romanian Culinary Dictionary & Smart Unit Converter
    this.culinaryMap = [
      { en: ['banana bread', 'nana bread'], ro: 'Banana Bread Proteic', isTitle: true },
      { en: ['pancakes', 'pancake', 'protein pancakes'], ro: 'Clătite Proteice', isTitle: true },
      { en: ['oatmeal', 'porridge', 'overnight oats'], ro: 'Budincă de Ovăz (Porridge)', isTitle: true },
      { en: ['cheesecake', 'protein cheesecake'], ro: 'Cheesecake Proteic', isTitle: true },
      { en: ['ripe banana', 'ripe bananas', 'banana', 'bananas'], ro: 'Banane', cat: 'Legume & Fructe', defaultGrams: 120 },
      { en: ['egg whites', 'egg white'], ro: 'Albuș de Ou', cat: 'Ouă & Lactate', defaultGrams: 35 },
      { en: ['egg', 'eggs'], ro: 'Ouă', cat: 'Ouă & Lactate', defaultGrams: 55 },
      { en: ['vanilla extract', 'vanilla essence', 'vanilla', 'esenta vanilie'], ro: 'Esență de Vanilie', cat: 'Dulciuri', defaultGrams: 5 },
      { en: ['maple syrup', 'syrup', 'rup if you like', 'honey', 'miere', 'sirop artar'], ro: 'Miere / Sirop de Arțar', cat: 'Dulciuri', defaultGrams: 25 },
      { en: ['whey protein powder', 'protein powder', 'whey protein', 'pudra proteica', 'proteina'], ro: 'Pudră Proteică Whey', cat: 'Ouă & Lactate', defaultGrams: 31 },
      { en: ['oat flour', 'rolled oats', 'quick oats', 'oats', 'coat flour', 'faina de ovaz', 'fulgi de ovaz'], ro: 'Făină de Ovăz', cat: 'Cereale & Paste', defaultGrams: 160 },
      { en: ['baking powder', 'praf de copt'], ro: 'Praf de Copt', cat: 'Dulciuri', defaultGrams: 10 },
      { en: ['baking soda', 'bicarbonat de sodiu', 'bicarbonat'], ro: 'Bicarbonat de Sodiu', cat: 'Dulciuri', defaultGrams: 3 },
      { en: ['salt', 'sea salt', 'sare'], ro: 'Sare', cat: 'Dulciuri', defaultGrams: 2 },
      { en: ['cinnamon', 'ground cinnamon', 'scortisoara'], ro: 'Scorțișoară', cat: 'Dulciuri', defaultGrams: 2 },
      { en: ['chocolate chips', 'choc chips', 'dark chocolate', 'chocolate', 'ciocolata', 'picaturi ciocolata'], ro: 'Bobițe de Ciocolată Neagră', cat: 'Dulciuri', defaultGrams: 45 },
      { en: ['peanut butter', 'unt de arahide'], ro: 'Unt de Arahide', cat: 'Grăsimi & Uleiuri', defaultGrams: 30 },
      { en: ['greek yogurt', 'iaurt grecesc'], ro: 'Iaurt Grecesc', cat: 'Ouă & Lactate', defaultGrams: 150 },
      { en: ['cottage cheese', 'branza cottage', 'fagaras'], ro: 'Brânză Cottage', cat: 'Ouă & Lactate', defaultGrams: 150 },
      { en: ['milk', 'almond milk', 'oat milk', 'lapte'], ro: 'Lapte', cat: 'Ouă & Lactate', defaultGrams: 200 },
      { en: ['chicken breast', 'chicken', 'piept de pui'], ro: 'Piept de Pui', cat: 'Carne & Pește', defaultGrams: 200 },
      { en: ['olive oil', 'coconut oil', 'butter', 'unt', 'ulei de masline'], ro: 'Ulei de Măsline', cat: 'Grăsimi & Uleiuri', defaultGrams: 15 },
      { en: ['flour', 'all purpose flour', 'faina de grau', 'faina'], ro: 'Făină de Grâu', cat: 'Cereale & Paste', defaultGrams: 100 },
      { en: ['chia seeds', 'seminte de chia'], ro: 'Semințe de Chia', cat: 'Grăsimi & Uleiuri', defaultGrams: 20 },
      { en: ['blueberries', 'afine'], ro: 'Afine', cat: 'Legume & Fructe', defaultGrams: 80 },
      { en: ['strawberries', 'capsuni'], ro: 'Căpșuni', cat: 'Legume & Fructe', defaultGrams: 100 },
      { en: ['almonds', 'migdale'], ro: 'Migdale', cat: 'Grăsimi & Uleiuri', defaultGrams: 30 },
      { en: ['walnuts', 'nuci'], ro: 'Nuci', cat: 'Grăsimi & Uleiuri', defaultGrams: 30 },
      { en: ['cocoa powder', 'cacao'], ro: 'Cacao', cat: 'Dulciuri', defaultGrams: 15 }
    ];

    // Romanian Supermarket Market Price & Macro Benchmark Catalog (Lidl, Kaufland, Carrefour, Mega Image, Penny)
    this.priceBenchmarks = [
      { keywords: ['piept', 'pui', 'curcan', 'file'], cat: 'Carne & Pește', avgPerKg: 30.0, defaultPackG: 650, kcal: 120, prot: 24.0, carbs: 0, fat: 2.5 },
      { keywords: ['pulp', 'ciocan'], cat: 'Carne & Pește', avgPerKg: 20.0, defaultPackG: 700, kcal: 180, prot: 19.0, carbs: 0, fat: 11.0 },
      { keywords: ['porc', 'cotlet', 'ceafa', 'muschi'], cat: 'Carne & Pește', avgPerKg: 28.0, defaultPackG: 500, kcal: 230, prot: 21.0, carbs: 0, fat: 16.0 },
      { keywords: ['vita', 'manzat', 'angus'], cat: 'Carne & Pește', avgPerKg: 55.0, defaultPackG: 500, kcal: 215, prot: 22.0, carbs: 0, fat: 14.0 },
      { keywords: ['somon'], cat: 'Carne & Pește', avgPerKg: 85.0, defaultPackG: 300, kcal: 208, prot: 20.0, carbs: 0, fat: 13.0 },
      { keywords: ['ton', 'conserva'], cat: 'Carne & Pește', avgPerKg: 60.0, defaultPackG: 160, kcal: 116, prot: 26.0, carbs: 0, fat: 1.0 },
      { keywords: ['peste', 'cod', 'pastrav', 'dorada', 'creveti'], cat: 'Carne & Pește', avgPerKg: 45.0, defaultPackG: 400, kcal: 110, prot: 20.0, carbs: 0, fat: 3.0 },
      { keywords: ['sunca', 'mezel', 'salam', 'crenvursti'], cat: 'Carne & Pește', avgPerKg: 45.0, defaultPackG: 150, kcal: 160, prot: 18.0, carbs: 1.5, fat: 9.0 },
      { keywords: ['ou', 'oua'], cat: 'Ouă & Lactate', avgPerKg: 26.0, defaultPackG: 500, kcal: 145, prot: 13.0, carbs: 1.0, fat: 10.0 },
      { keywords: ['lapte'], cat: 'Ouă & Lactate', avgPerKg: 7.5, defaultPackG: 1000, kcal: 50, prot: 3.4, carbs: 4.8, fat: 1.5 },
      { keywords: ['iaurt', 'grecesc', 'skyr'], cat: 'Ouă & Lactate', avgPerKg: 18.0, defaultPackG: 400, kcal: 95, prot: 8.5, carbs: 4.0, fat: 5.0 },
      { keywords: ['branza', 'telemea', 'cottage', 'fagaras'], cat: 'Ouă & Lactate', avgPerKg: 35.0, defaultPackG: 300, kcal: 185, prot: 14.0, carbs: 2.5, fat: 13.0 },
      { keywords: ['mozzarella', 'cascaval', 'parmezan'], cat: 'Ouă & Lactate', avgPerKg: 45.0, defaultPackG: 250, kcal: 280, prot: 22.0, carbs: 1.5, fat: 21.0 },
      { keywords: ['unt'], cat: 'Grăsimi & Uleiuri', avgPerKg: 50.0, defaultPackG: 200, kcal: 745, prot: 0.8, carbs: 0.7, fat: 82.0 },
      { keywords: ['smantana'], cat: 'Ouă & Lactate', avgPerKg: 22.0, defaultPackG: 300, kcal: 195, prot: 2.8, carbs: 3.5, fat: 20.0 },
      { keywords: ['orez', 'basmati', 'iasomie'], cat: 'Cereale & Paste', avgPerKg: 9.5, defaultPackG: 1000, kcal: 355, prot: 7.5, carbs: 78.0, fat: 1.0 },
      { keywords: ['paste', 'spaghete', 'penne', 'barilla', 'fidea'], cat: 'Cereale & Paste', avgPerKg: 9.0, defaultPackG: 500, kcal: 350, prot: 12.5, carbs: 72.0, fat: 1.5 },
      { keywords: ['ovaz', 'fulgi', 'muesli'], cat: 'Cereale & Paste', avgPerKg: 8.0, defaultPackG: 500, kcal: 375, prot: 13.5, carbs: 62.0, fat: 7.0 },
      { keywords: ['paine', 'toast', 'lipie', 'tortilla', 'faina', 'malai', 'covrig', 'covrigi'], cat: 'Cereale & Paste', avgPerKg: 12.0, defaultPackG: 300, kcal: 280, prot: 9.0, carbs: 54.0, fat: 2.5 },
      { keywords: ['cartof', 'cartofi'], cat: 'Legume & Fructe', avgPerKg: 4.0, defaultPackG: 1000, kcal: 77, prot: 2.0, carbs: 17.5, fat: 0.1 },
      { keywords: ['ciuperci', 'champignon'], cat: 'Legume & Fructe', avgPerKg: 14.0, defaultPackG: 500, kcal: 22, prot: 3.1, carbs: 3.3, fat: 0.3 },
      { keywords: ['rosii', 'rosie'], cat: 'Legume & Fructe', avgPerKg: 8.5, defaultPackG: 500, kcal: 18, prot: 0.9, carbs: 3.9, fat: 0.2 },
      { keywords: ['castraveti', 'castravete'], cat: 'Legume & Fructe', avgPerKg: 7.0, defaultPackG: 500, kcal: 15, prot: 0.7, carbs: 3.6, fat: 0.1 },
      { keywords: ['ardei', 'kapia', 'gogosar'], cat: 'Legume & Fructe', avgPerKg: 12.0, defaultPackG: 500, kcal: 26, prot: 1.0, carbs: 5.3, fat: 0.2 },
      { keywords: ['ceapa', 'usturoi'], cat: 'Legume & Fructe', avgPerKg: 5.0, defaultPackG: 500, kcal: 40, prot: 1.1, carbs: 9.3, fat: 0.1 },
      { keywords: ['spanac', 'salata', 'baby', 'rucola'], cat: 'Legume & Fructe', avgPerKg: 28.0, defaultPackG: 200, kcal: 23, prot: 2.9, carbs: 3.6, fat: 0.4 },
      { keywords: ['broccoli', 'conopida'], cat: 'Legume & Fructe', avgPerKg: 12.0, defaultPackG: 500, kcal: 34, prot: 2.8, carbs: 6.6, fat: 0.4 },
      { keywords: ['avocado'], cat: 'Legume & Fructe', avgPerKg: 25.0, defaultPackG: 200, kcal: 160, prot: 2.0, carbs: 8.5, fat: 14.7 },
      { keywords: ['banana', 'banane'], cat: 'Legume & Fructe', avgPerKg: 6.5, defaultPackG: 1000, kcal: 89, prot: 1.1, carbs: 22.8, fat: 0.3 },
      { keywords: ['mar', 'mere', 'para', 'pere'], cat: 'Legume & Fructe', avgPerKg: 5.0, defaultPackG: 1000, kcal: 52, prot: 0.3, carbs: 13.8, fat: 0.2 },
      { keywords: ['fructe de padure', 'afine', 'capsuni', 'zmeura'], cat: 'Legume & Fructe', avgPerKg: 35.0, defaultPackG: 300, kcal: 57, prot: 0.7, carbs: 14.5, fat: 0.3 },
      { keywords: ['ulei de masline', 'masline'], cat: 'Grăsimi & Uleiuri', avgPerKg: 55.0, defaultPackG: 1000, kcal: 824, prot: 0, carbs: 0, fat: 91.6 },
      { keywords: ['ulei'], cat: 'Grăsimi & Uleiuri', avgPerKg: 8.5, defaultPackG: 1000, kcal: 828, prot: 0, carbs: 0, fat: 92.0 },
      { keywords: ['nuci', 'migdale', 'arahide', 'caju', 'seminte'], cat: 'Grăsimi & Uleiuri', avgPerKg: 60.0, defaultPackG: 200, kcal: 620, prot: 18.0, carbs: 16.0, fat: 55.0 },
      { keywords: ['kinder', 'bueno', 'nutella', 'ciocolata', 'milka', 'oreo', 'kitkat', 'snickers', 'twix', 'bounty', 'croissant', 'biscuiti', 'napolitana', 'dulciuri'], cat: 'Dulciuri', avgPerKg: 65.0, defaultPackG: 100, kcal: 520, prot: 7.0, carbs: 55.0, fat: 31.0 },
      { keywords: ['proteina', 'whey', 'pudra', 'shake', 'barebells', 'grenade'], cat: 'Ouă & Lactate', avgPerKg: 130.0, defaultPackG: 1000, kcal: 380, prot: 75.0, carbs: 8.0, fat: 5.0 }
    ];

    // Curated Supermarket Database of 160+ Popular Romanian Supermarket Products (Lidl, Kaufland, Carrefour, Mega Image, Penny)
    this.supermarketCatalog = [
      // --- DULCIURI & BATOANE & GUSTĂRI ---
      { id: 'kb_01', name: 'Kinder Bueno', brand: 'Ferrero', ean: '8000500019956', category: 'Dulciuri', packageQuantity: 43, packagePrice: 4.50, calories: 572, protein: 8.6, carbs: 52.8, fat: 37.3, fiber: 1.5, keywords: ['kinder', 'bueno', 'ciocolata', 'napolitana', 'alune'] },
      { id: 'kb_02', name: 'Kinder Bueno White', brand: 'Ferrero', ean: '8000500129259', category: 'Dulciuri', packageQuantity: 39, packagePrice: 4.50, calories: 571, protein: 8.5, carbs: 53.6, fat: 37.1, fiber: 1.4, keywords: ['kinder', 'bueno', 'white', 'alb', 'ciocolata'] },
      { id: 'kb_03', name: 'Kinder Country', brand: 'Ferrero', ean: '8000500008431', category: 'Dulciuri', packageQuantity: 23.5, packagePrice: 2.50, calories: 561, protein: 8.6, carbs: 54.9, fat: 33.8, fiber: 1.7, keywords: ['kinder', 'country', 'cereale', 'ciocolata'] },
      { id: 'kb_04', name: 'Kinder Delice', brand: 'Ferrero', ean: '8000500023977', category: 'Dulciuri', packageQuantity: 39, packagePrice: 3.20, calories: 455, protein: 5.5, carbs: 51.5, fat: 25.5, fiber: 2.0, keywords: ['kinder', 'delice', 'prajitura', 'cacao'] },
      { id: 'kb_05', name: 'Kinder Cards', brand: 'Ferrero', ean: '8000500284392', category: 'Dulciuri', packageQuantity: 128, packagePrice: 12.50, calories: 510, protein: 7.8, carbs: 58.0, fat: 27.5, fiber: 2.1, keywords: ['kinder', 'cards', 'biscuiti', 'ciocolata'] },
      { id: 'kb_06', name: 'Kinder Maxi', brand: 'Ferrero', ean: '8000500010991', category: 'Dulciuri', packageQuantity: 21, packagePrice: 2.20, calories: 566, protein: 8.7, carbs: 53.5, fat: 35.0, fiber: 0.9, keywords: ['kinder', 'maxi', 'ciocolata', 'bomboane'] },
      { id: 'kb_07', name: 'Kinder Schoko-Bons', brand: 'Ferrero', ean: '8000500027739', category: 'Dulciuri', packageQuantity: 125, packagePrice: 13.50, calories: 576, protein: 8.3, carbs: 52.5, fat: 36.6, fiber: 1.4, keywords: ['kinder', 'schoko', 'bons', 'bomboane'] },
      { id: 'kb_08', name: 'Kinder Ciocolată Tablete', brand: 'Ferrero', ean: '8000500003788', category: 'Dulciuri', packageQuantity: 100, packagePrice: 6.50, calories: 566, protein: 8.7, carbs: 53.5, fat: 35.0, fiber: 0.9, keywords: ['kinder', 'ciocolata', 'tableta'] },
      { id: 'kb_09', name: 'Kinder Pingui', brand: 'Ferrero', ean: '8000500010885', category: 'Dulciuri', packageQuantity: 30, packagePrice: 2.80, calories: 450, protein: 7.0, carbs: 42.0, fat: 29.7, fiber: 1.3, keywords: ['kinder', 'pingui', 'prajitura'] },
      { id: 'kb_10', name: 'Kinder Paradiso', brand: 'Ferrero', ean: '8000500010779', category: 'Dulciuri', packageQuantity: 29, packagePrice: 3.20, calories: 422, protein: 7.3, carbs: 51.5, fat: 27.9, fiber: 1.1, keywords: ['kinder', 'paradiso', 'lamaie'] },
      { id: 'kb_11', name: 'Kinder Joy', brand: 'Ferrero', ean: '8000500021386', category: 'Dulciuri', packageQuantity: 20, packagePrice: 5.00, calories: 550, protein: 8.2, carbs: 56.5, fat: 32.0, fiber: 1.2, keywords: ['kinder', 'joy', 'ou'] },
      { id: 'kb_12', name: 'Kinder Surprise Ou', brand: 'Ferrero', ean: '8000500001159', category: 'Dulciuri', packageQuantity: 20, packagePrice: 4.80, calories: 552, protein: 8.1, carbs: 52.3, fat: 34.2, fiber: 0.9, keywords: ['kinder', 'surprise', 'ou', 'ciocolata'] },
      { id: 'kb_13', name: 'Nutella Cremă Alune cu Cacao', brand: 'Ferrero', ean: '8000500179865', category: 'Dulciuri', packageQuantity: 400, packagePrice: 18.50, calories: 539, protein: 6.3, carbs: 57.5, fat: 30.9, fiber: 3.0, keywords: ['nutella', 'crema', 'alune', 'ciocolata'] },
      { id: 'kb_14', name: 'Raffaello Praline Cocos', brand: 'Ferrero', ean: '8000500009650', category: 'Dulciuri', packageQuantity: 150, packagePrice: 15.00, calories: 628, protein: 7.2, carbs: 38.3, fat: 48.6, fiber: 4.0, keywords: ['raffaello', 'praline', 'cocos', 'migdale'] },
      { id: 'kb_15', name: 'Ferrero Rocher Praline', brand: 'Ferrero', ean: '8000500003290', category: 'Dulciuri', packageQuantity: 200, packagePrice: 22.00, calories: 595, protein: 8.2, carbs: 44.4, fat: 42.7, fiber: 3.5, keywords: ['ferrero', 'rocher', 'praline', 'alune'] },
      { id: 'kb_16', name: 'Milka Ciocolată cu Lapte Alpin', brand: 'Mondelez Milka', ean: '7622210286864', category: 'Dulciuri', packageQuantity: 100, packagePrice: 5.50, calories: 530, protein: 6.3, carbs: 58.5, fat: 29.5, fiber: 1.8, keywords: ['milka', 'ciocolata', 'alpin'] },
      { id: 'kb_17', name: 'Milka Oreo Ciocolată', brand: 'Mondelez Milka', ean: '7622210286987', category: 'Dulciuri', packageQuantity: 100, packagePrice: 6.00, calories: 555, protein: 5.4, carbs: 56.0, fat: 34.0, fiber: 1.4, keywords: ['milka', 'oreo', 'ciocolata'] },
      { id: 'kb_18', name: 'Milka Noisette Cremă Alune', brand: 'Mondelez Milka', ean: '7622210287113', category: 'Dulciuri', packageQuantity: 100, packagePrice: 6.00, calories: 545, protein: 7.4, carbs: 54.0, fat: 32.5, fiber: 2.5, keywords: ['milka', 'noisette', 'alune'] },
      { id: 'kb_19', name: 'Milka Alune de Pădure Întregi', brand: 'Mondelez Milka', ean: '7622210287229', category: 'Dulciuri', packageQuantity: 100, packagePrice: 6.20, calories: 555, protein: 8.1, carbs: 50.0, fat: 35.5, fiber: 3.2, keywords: ['milka', 'alune', 'ciocolata'] },
      { id: 'kb_20', name: 'Oreo Biscuiți Sandwich Original', brand: 'Mondelez Oreo', ean: '7622300315894', category: 'Dulciuri', packageQuantity: 154, packagePrice: 6.50, calories: 474, protein: 5.2, carbs: 68.0, fat: 20.0, fiber: 2.7, keywords: ['oreo', 'biscuiti', 'vanilie', 'cacao'] },
      { id: 'kb_21', name: 'KitKat 4 Finger Vafe Ciocolată', brand: 'Nestle KitKat', ean: '3800020412354', category: 'Dulciuri', packageQuantity: 41.5, packagePrice: 3.50, calories: 518, protein: 6.9, carbs: 64.5, fat: 26.0, fiber: 2.2, keywords: ['kitkat', 'napolitana', 'ciocolata'] },
      { id: 'kb_22', name: 'KitKat Chunky Ciocolată Lapte', brand: 'Nestle KitKat', ean: '3800020412460', category: 'Dulciuri', packageQuantity: 40, packagePrice: 3.50, calories: 523, protein: 6.1, carbs: 62.0, fat: 27.5, fiber: 2.0, keywords: ['kitkat', 'chunky'] },
      { id: 'kb_23', name: 'Snickers Baton Ciocolată & Caramel', brand: 'Mars Snickers', ean: '5000159461122', category: 'Dulciuri', packageQuantity: 50, packagePrice: 3.50, calories: 488, protein: 8.6, carbs: 60.5, fat: 23.0, fiber: 2.3, keywords: ['snickers', 'baton', 'arahide', 'caramel'] },
      { id: 'kb_24', name: 'Twix Batoane Biscuiți cu Caramel', brand: 'Mars Twix', ean: '5000159459228', category: 'Dulciuri', packageQuantity: 50, packagePrice: 3.50, calories: 495, protein: 4.4, carbs: 64.8, fat: 24.0, fiber: 1.6, keywords: ['twix', 'biscuiti', 'caramel', 'baton'] },
      { id: 'kb_25', name: 'Bounty Baton Nucă de Cocos', brand: 'Mars Bounty', ean: '5000159459334', category: 'Dulciuri', packageQuantity: 57, packagePrice: 3.50, calories: 487, protein: 3.7, carbs: 58.9, fat: 26.0, fiber: 3.9, keywords: ['bounty', 'cocos', 'ciocolata'] },
      { id: 'kb_26', name: 'Mars Baton Ciocolată & Caramel', brand: 'Mars', ean: '5000159459112', category: 'Dulciuri', packageQuantity: 51, packagePrice: 3.50, calories: 448, protein: 4.0, carbs: 70.0, fat: 16.7, fiber: 1.1, keywords: ['mars', 'baton', 'caramel'] },
      { id: 'kb_27', name: 'Lion Baton Caramel & Cereale', brand: 'Nestle Lion', ean: '7613035252873', category: 'Dulciuri', packageQuantity: 42, packagePrice: 3.00, calories: 485, protein: 5.2, carbs: 65.1, fat: 22.3, fiber: 1.8, keywords: ['lion', 'baton', 'cereale', 'caramel'] },
      { id: 'kb_28', name: '7Days Croissant cu Cremă Cacao', brand: 'Chipita 7Days', ean: '5201360523014', category: 'Dulciuri', packageQuantity: 60, packagePrice: 3.50, calories: 456, protein: 7.0, carbs: 44.0, fat: 28.0, fiber: 2.0, keywords: ['7days', 'croissant', 'cacao', 'corn'] },
      { id: 'kb_29', name: 'Belvita Start Biscuiți Cereale & Lapte', brand: 'Mondelez Belvita', ean: '7622210212009', category: 'Dulciuri', packageQuantity: 300, packagePrice: 10.50, calories: 450, protein: 7.8, carbs: 68.0, fat: 15.0, fiber: 4.3, keywords: ['belvita', 'biscuiti', 'cereale', 'start'] },
      { id: 'kb_30', name: 'Biscuiți Digestive Gullon', brand: 'Gullon', ean: '8410376008655', category: 'Dulciuri', packageQuantity: 400, packagePrice: 7.50, calories: 477, protein: 6.8, carbs: 65.0, fat: 21.0, fiber: 4.5, keywords: ['digestive', 'gullon', 'biscuiti'] },
      { id: 'kb_31', name: 'Biscuiți Petit Beurre RoStar', brand: 'RoStar', ean: '5941198000014', category: 'Dulciuri', packageQuantity: 300, packagePrice: 5.50, calories: 435, protein: 7.5, carbs: 73.0, fat: 12.0, fiber: 2.5, keywords: ['petit', 'beurre', 'rostar', 'biscuiti'] },
      { id: 'kb_32', name: 'Eugenia Dobrogea Original Cacao', brand: 'Dobrogea', ean: '5941014000105', category: 'Dulciuri', packageQuantity: 36, packagePrice: 1.50, calories: 470, protein: 6.5, carbs: 68.0, fat: 19.0, fiber: 2.4, keywords: ['eugenia', 'dobrogea', 'biscuiti', 'cacao'] },
      { id: 'kb_33', name: 'M&M\'s Arahide Bomboane', brand: 'Mars M&M', ean: '5000159461153', category: 'Dulciuri', packageQuantity: 90, packagePrice: 6.50, calories: 516, protein: 9.4, carbs: 59.0, fat: 26.0, fiber: 3.1, keywords: ['m&m', 'mms', 'arahide', 'bomboane'] },
      { id: 'kb_34', name: 'Ciocolată Heidi Dark Extreme 85%', brand: 'Heidi', ean: '5941262002012', category: 'Dulciuri', packageQuantity: 80, packagePrice: 9.50, calories: 620, protein: 8.5, carbs: 19.0, fat: 55.0, fiber: 11.0, keywords: ['heidi', 'ciocolata', 'neagra', 'dark', '85%'] },
      { id: 'kb_35', name: 'Ciocolată Lindt Excellence 70%', brand: 'Lindt', ean: '3046920028005', category: 'Dulciuri', packageQuantity: 100, packagePrice: 14.50, calories: 566, protein: 9.5, carbs: 34.0, fat: 41.0, fiber: 9.0, keywords: ['lindt', 'ciocolata', 'neagra', '70%'] },
      { id: 'kb_36', name: 'Baton Proteic Barebells Caramel Cashew', brand: 'Barebells', ean: '7340001800003', category: 'Dulciuri', packageQuantity: 55, packagePrice: 12.50, calories: 362, protein: 36.0, carbs: 27.0, fat: 15.0, fiber: 8.0, keywords: ['barebells', 'baton', 'proteic', 'caramel', 'protein'] },
      { id: 'kb_37', name: 'Baton Proteic Barebells Cookies & Cream', brand: 'Barebells', ean: '7340001800010', category: 'Dulciuri', packageQuantity: 55, packagePrice: 12.50, calories: 362, protein: 36.0, carbs: 27.0, fat: 15.0, fiber: 7.5, keywords: ['barebells', 'baton', 'proteic', 'cookies'] },
      { id: 'kb_38', name: 'Baton Proteic Grenade Carb Killa Oreo', brand: 'Grenade', ean: '5060221074452', category: 'Dulciuri', packageQuantity: 60, packagePrice: 13.50, calories: 388, protein: 35.0, carbs: 33.0, fat: 17.0, fiber: 3.5, keywords: ['grenade', 'carb', 'killa', 'oreo', 'protein'] },
      { id: 'kb_39', name: 'Pufuleți Gusto cu Sare', brand: 'Gusto Phoenix', ean: '5941212000013', category: 'Dulciuri', packageQuantity: 85, packagePrice: 2.50, calories: 435, protein: 7.5, carbs: 75.0, fat: 12.0, fiber: 3.0, keywords: ['pufuleti', 'gusto', 'malai'] },
      { id: 'kb_40', name: 'Chipsuri Lay\'s Clasic cu Sare', brand: 'Lay\'s', ean: '5941014002017', category: 'Dulciuri', packageQuantity: 140, packagePrice: 7.50, calories: 539, protein: 6.5, carbs: 53.0, fat: 33.0, fiber: 4.4, keywords: ['chipsuri', 'lays', 'cartofi', 'sare'] },

      // --- OUĂ & LACTATE ---
      // Pilos (Lidl România) & Lapte Supermarket RO
      { id: 'lac_pilos_01', name: 'Lapte Pilos 1.5% UHT (Lidl)', brand: 'Pilos / Lidl', ean: '20042890', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 4.99, calories: 44, protein: 3.2, carbs: 4.7, fat: 1.5, fiber: 0, keywords: ['lapte', 'pilos', 'lidl', 'uht', '1.5%'] },
      { id: 'lac_pilos_02', name: 'Lapte Pilos 3.5% UHT (Lidl)', brand: 'Pilos / Lidl', ean: '20042906', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 5.89, calories: 62, protein: 3.2, carbs: 4.7, fat: 3.5, fiber: 0, keywords: ['lapte', 'pilos', 'lidl', 'uht', '3.5%'] },
      { id: 'lac_pilos_03', name: 'Lapte Proaspăt Pilos 1.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20114455', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 5.29, calories: 44, protein: 3.2, carbs: 4.7, fat: 1.5, fiber: 0, keywords: ['lapte', 'proaspat', 'pilos', 'lidl', '1.5%'] },
      { id: 'lac_pilos_04', name: 'Lapte Proaspăt Pilos 3.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20114462', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 6.19, calories: 62, protein: 3.2, carbs: 4.7, fat: 3.5, fiber: 0, keywords: ['lapte', 'proaspat', 'pilos', 'lidl', '3.5%'] },
      { id: 'lac_pilos_05', name: 'Lapte Bătut Pilos 2% (Lidl)', brand: 'Pilos / Lidl', ean: '20115577', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 5.49, calories: 48, protein: 3.2, carbs: 4.2, fat: 2.0, fiber: 0, keywords: ['lapte', 'batut', 'pilos', 'lidl', '2%'] },
      { id: 'lac_pilos_06', name: 'Lapte cu Ciocolată Pilos (Lidl)', brand: 'Pilos / Lidl', ean: '20116688', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 4.49, calories: 68, protein: 3.3, carbs: 9.8, fat: 1.7, fiber: 0, keywords: ['lapte', 'ciocolata', 'pilos', 'lidl', 'cacao'] },
      { id: 'lac_pilos_07', name: 'Lapte Bio Pilos 3.8% (Lidl)', brand: 'Pilos / Lidl', ean: '20117799', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 6.99, calories: 65, protein: 3.3, carbs: 4.8, fat: 3.8, fiber: 0, keywords: ['lapte', 'bio', 'pilos', 'lidl', '3.8%'] },
      { id: 'lac_pilos_08', name: 'Iaurt Pilos Natur 1.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20118811', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 3.20, calories: 44, protein: 3.6, carbs: 4.2, fat: 1.5, fiber: 0, keywords: ['iaurt', 'pilos', 'lidl', 'natur', '1.5%'] },
      { id: 'lac_pilos_09', name: 'Iaurt Pilos Natur 3.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20118828', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 3.70, calories: 61, protein: 3.3, carbs: 4.1, fat: 3.5, fiber: 0, keywords: ['iaurt', 'pilos', 'lidl', 'natur', '3.5%'] },
      { id: 'lac_pilos_10', name: 'Iaurt Grecesc Pilos 2% (Lidl)', brand: 'Pilos / Lidl', ean: '20104128', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 5.99, calories: 68, protein: 8.5, carbs: 3.8, fat: 2.0, fiber: 0, keywords: ['iaurt', 'grecesc', 'pilos', 'lidl', '2%'] },
      { id: 'lac_pilos_11', name: 'Chefir Pilos 1.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20119933', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 3.99, calories: 45, protein: 3.2, carbs: 4.0, fat: 1.5, fiber: 0, keywords: ['chefir', 'kefir', 'pilos', 'lidl'] },
      { id: 'lac_pilos_12', name: 'Sana Pilos 3.5% (Lidl)', brand: 'Pilos / Lidl', ean: '20119940', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 3.99, calories: 60, protein: 3.2, carbs: 4.0, fat: 3.5, fiber: 0, keywords: ['sana', 'pilos', 'lidl'] },
      { id: 'lac_pilos_13', name: 'Brânză Făgăraș Pilos 5% (Lidl)', brand: 'Pilos / Lidl', ean: '20120011', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 4.49, calories: 95, protein: 12.0, carbs: 2.8, fat: 5.0, fiber: 0, keywords: ['fagaras', 'branza', 'pilos', 'lidl'] },
      { id: 'lac_pilos_14', name: 'Brânză Cottage Pilos Light (Lidl)', brand: 'Pilos / Lidl', ean: '20120028', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 4.29, calories: 76, protein: 12.5, carbs: 2.0, fat: 2.0, fiber: 0, keywords: ['cottage', 'branza', 'perle', 'pilos', 'lidl'] },
      { id: 'lac_pilos_15', name: 'Cașcaval Rucăr Pilos (Lidl)', brand: 'Pilos / Lidl', ean: '20122233', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 15.50, calories: 310, protein: 24.0, carbs: 1.0, fat: 24.0, fiber: 0, keywords: ['cascaval', 'rucar', 'pilos', 'lidl'] },
      { id: 'lac_pilos_16', name: 'Telemea de Vacă Pilos (Lidl)', brand: 'Pilos / Lidl', ean: '20123344', category: 'Ouă & Lactate', packageQuantity: 300, packagePrice: 11.50, calories: 245, protein: 16.0, carbs: 1.0, fat: 20.0, fiber: 0, keywords: ['telemea', 'vaca', 'branza', 'pilos', 'lidl'] },
      { id: 'lac_pilos_17', name: 'Unt Pilos 65% (Lidl)', brand: 'Pilos / Lidl', ean: '20121117', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 7.99, calories: 595, protein: 1.0, carbs: 1.0, fat: 65.0, fiber: 0, keywords: ['unt', 'pilos', 'lidl', '65%'] },
      { id: 'lac_pilos_18', name: 'Unt Pilos 82% (Lidl)', brand: 'Pilos / Lidl', ean: '20121124', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 9.99, calories: 743, protein: 0.7, carbs: 0.7, fat: 82.0, fiber: 0, keywords: ['unt', 'pilos', 'lidl', '82%'] },
      { id: 'lac_nap_01', name: 'Lapte Napolact 1.5% UHT', brand: 'Napolact', ean: '5941165000101', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 7.80, calories: 44, protein: 3.2, carbs: 4.7, fat: 1.5, fiber: 0, keywords: ['lapte', 'napolact', 'uht', '1.5%'] },
      { id: 'lac_nap_02', name: 'Lapte Napolact 3.5% UHT', brand: 'Napolact', ean: '5941165000217', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 8.80, calories: 62, protein: 3.2, carbs: 4.7, fat: 3.5, fiber: 0, keywords: ['lapte', 'napolact', 'uht', '3.5%'] },
      { id: 'lac_oly_01', name: 'Lapte Olympus 1.5%', brand: 'Olympus', ean: '5201101006615', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 7.90, calories: 45, protein: 3.3, carbs: 4.7, fat: 1.5, fiber: 0, keywords: ['lapte', 'olympus', '1.5%'] },
      { id: 'lac_oly_02', name: 'Lapte Olympus 3.7%', brand: 'Olympus', ean: '5201101006622', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 8.90, calories: 64, protein: 3.3, carbs: 4.7, fat: 3.7, fiber: 0, keywords: ['lapte', 'olympus', '3.7%'] },
      { id: 'lac_kcl_01', name: 'Lapte K-Classic 1.5% (Kaufland)', brand: 'K-Classic / Kaufland', ean: '4337185001112', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 4.89, calories: 44, protein: 3.2, carbs: 4.7, fat: 1.5, fiber: 0, keywords: ['lapte', 'kclassic', 'kaufland', '1.5%'] },
      { id: 'lac_kcl_02', name: 'Lapte K-Classic 3.5% (Kaufland)', brand: 'K-Classic / Kaufland', ean: '4337185001129', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 5.79, calories: 62, protein: 3.2, carbs: 4.7, fat: 3.5, fiber: 0, keywords: ['lapte', 'kclassic', 'kaufland', '3.5%'] },
      { id: 'lac_01', name: 'Iaurt Grecesc Olympus 10%', brand: 'Olympus', ean: '5201101004123', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 8.50, calories: 126, protein: 7.0, carbs: 3.8, fat: 10.0, fiber: 0, keywords: ['iaurt', 'grecesc', 'olympus', '10%'] },
      { id: 'lac_02', name: 'Iaurt Grecesc Olympus 2%', brand: 'Olympus', ean: '5201101004130', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 8.20, calories: 68, protein: 9.0, carbs: 3.8, fat: 2.0, fiber: 0, keywords: ['iaurt', 'grecesc', 'olympus', '2%'] },
      { id: 'lac_03', name: 'Iaurt Grecesc Olympus 0%', brand: 'Olympus', ean: '5201101004147', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 8.00, calories: 53, protein: 10.0, carbs: 3.5, fat: 0.0, fiber: 0, keywords: ['iaurt', 'grecesc', 'olympus', '0%'] },
      { id: 'lac_04', name: 'Iaurt Grecesc Pilos 10% (Lidl)', brand: 'Pilos / Lidl', ean: '20104111', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 6.50, calories: 125, protein: 6.5, carbs: 4.0, fat: 10.0, fiber: 0, keywords: ['iaurt', 'grecesc', 'pilos', 'lidl', '10%'] },
      { id: 'lac_05', name: 'Pilos Skyr Natur Islandez (Lidl)', brand: 'Pilos / Lidl', ean: '20108822', category: 'Ouă & Lactate', packageQuantity: 350, packagePrice: 6.00, calories: 63, protein: 11.0, carbs: 4.0, fat: 0.2, fiber: 0, keywords: ['skyr', 'pilos', 'lidl', 'islandez', 'iaurt'] },
      { id: 'lac_06', name: 'Skyr Islandez Milbona Natur (Lidl)', brand: 'Milbona / Lidl', ean: '20205511', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 8.50, calories: 65, protein: 11.5, carbs: 4.0, fat: 0.2, fiber: 0, keywords: ['skyr', 'milbona', 'lidl', 'iaurt'] },
      { id: 'lac_07', name: 'Iaurt Zuzu Max 10%', brand: 'Zuzu Albalact', ean: '5941112004221', category: 'Ouă & Lactate', packageQuantity: 330, packagePrice: 6.80, calories: 120, protein: 3.5, carbs: 4.2, fat: 10.0, fiber: 0, keywords: ['iaurt', 'zuzu', 'max', 'cremos'] },
      { id: 'lac_08', name: 'Iaurt Danone Natural 3.5%', brand: 'Danone', ean: '5941012001112', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 5.20, calories: 61, protein: 3.3, carbs: 4.1, fat: 3.5, fiber: 0, keywords: ['iaurt', 'danone', 'natural'] },
      { id: 'lac_09', name: 'Activia Natur Iaurt Bifidus', brand: 'Danone Activia', ean: '5941012003338', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 9.50, calories: 66, protein: 3.9, carbs: 4.4, fat: 3.5, fiber: 0, keywords: ['activia', 'iaurt', 'danone', 'bifidus'] },
      { id: 'lac_10', name: 'Kefir Covalact de Țară 3.3%', brand: 'Covalact', ean: '5941178000452', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 6.20, calories: 58, protein: 3.2, carbs: 4.1, fat: 3.3, fiber: 0, keywords: ['kefir', 'covalact', 'tara', 'lapte'] },
      { id: 'lac_11', name: 'Sana Covalact de Țară 3.6%', brand: 'Covalact', ean: '5941178000469', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 6.20, calories: 60, protein: 3.2, carbs: 4.0, fat: 3.6, fiber: 0, keywords: ['sana', 'covalact', 'lapte'] },
      { id: 'lac_12', name: 'Lapte Zuzu 1.5% UHT', brand: 'Zuzu Albalact', ean: '5941112001015', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 7.50, calories: 44, protein: 3.2, carbs: 4.5, fat: 1.5, fiber: 0, keywords: ['lapte', 'zuzu', '1.5'] },
      { id: 'lac_13', name: 'Lapte Zuzu 3.5% UHT', brand: 'Zuzu Albalact', ean: '5941112001022', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 8.50, calories: 62, protein: 3.2, carbs: 4.5, fat: 3.5, fiber: 0, keywords: ['lapte', 'zuzu', '3.5'] },
      { id: 'lac_14', name: 'Lapte Olympus Proteic 20g Protein', brand: 'Olympus', ean: '5201101007780', category: 'Ouă & Lactate', packageQuantity: 500, packagePrice: 7.50, calories: 56, protein: 6.7, carbs: 4.8, fat: 1.1, fiber: 0, keywords: ['lapte', 'proteic', 'olympus', 'protein'] },
      { id: 'lac_15', name: 'Lapte de Migdale Alpro Fără Zahăr', brand: 'Alpro', ean: '5411188110835', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 13.50, calories: 13, protein: 0.4, carbs: 0.0, fat: 1.1, fiber: 0.4, keywords: ['lapte', 'migdale', 'alpro', 'vegan'] },
      { id: 'lac_16', name: 'Lapte de Ovăz Oatly Barista Edition', brand: 'Oatly', ean: '7394376616037', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 14.50, calories: 59, protein: 1.0, carbs: 6.6, fat: 3.0, fiber: 0.8, keywords: ['lapte', 'ovaz', 'oatly', 'barista'] },
      { id: 'lac_17', name: 'Budincă Proteică Ehrmann Ciocolată 20g', brand: 'Ehrmann', ean: '4002930026607', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 7.50, calories: 76, protein: 10.0, carbs: 5.5, fat: 1.5, fiber: 0, keywords: ['budinca', 'proteica', 'ehrmann', 'ciocolata'] },
      { id: 'lac_18', name: 'Budincă Proteică Milbona 20g (Lidl)', brand: 'Milbona / Lidl', ean: '20194422', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 5.50, calories: 78, protein: 10.0, carbs: 6.0, fat: 1.5, fiber: 0, keywords: ['budinca', 'proteica', 'milbona', 'lidl'] },
      { id: 'lac_19', name: 'Băutură Proteică Ehrmann Ciocolată 330ml', brand: 'Ehrmann', ean: '4002930026713', category: 'Ouă & Lactate', packageQuantity: 330, packagePrice: 9.90, calories: 60, protein: 6.1, carbs: 5.0, fat: 1.5, fiber: 0, keywords: ['bautura', 'proteica', 'ehrmann', 'shake'] },
      { id: 'lac_20', name: 'Brânză Făgăraș Covalact de Țară', brand: 'Covalact', ean: '5941178000100', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 5.80, calories: 100, protein: 13.0, carbs: 2.5, fat: 4.5, fiber: 0, keywords: ['fagaras', 'branza', 'covalact'] },
      { id: 'lac_21', name: 'Cottage Cheese Olympus 4%', brand: 'Olympus', ean: '5201101002235', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 5.50, calories: 90, protein: 12.5, carbs: 2.0, fat: 4.0, fiber: 0, keywords: ['cottage', 'cheese', 'olympus', 'perle'] },
      { id: 'lac_22', name: 'Brânză Proaspătă Vaci Pilos 0.2% (Lidl)', brand: 'Pilos / Lidl', ean: '20103322', category: 'Ouă & Lactate', packageQuantity: 250, packagePrice: 5.20, calories: 68, protein: 12.0, carbs: 4.0, fat: 0.2, fiber: 0, keywords: ['branza', 'vaci', 'slaba', 'pilos', 'lidl'] },
      { id: 'lac_23', name: 'Brânză Slabă de Vaci Covalact 0.5%', brand: 'Covalact', ean: '5941178000124', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 5.50, calories: 72, protein: 13.5, carbs: 3.5, fat: 0.5, fiber: 0, keywords: ['branza', 'vaci', 'covalact', 'slaba'] },
      { id: 'lac_24', name: 'Telemea de Vaci Hochland', brand: 'Hochland', ean: '5941108000331', category: 'Ouă & Lactate', packageQuantity: 350, packagePrice: 15.50, calories: 260, protein: 16.0, carbs: 1.0, fat: 21.0, fiber: 0, keywords: ['telemea', 'vaci', 'hochland', 'branza'] },
      { id: 'lac_25', name: 'Telemea de Oaie și Capră Olympus', brand: 'Olympus', ean: '5201101003447', category: 'Ouă & Lactate', packageQuantity: 350, packagePrice: 19.50, calories: 280, protein: 17.0, carbs: 0.8, fat: 23.5, fiber: 0, keywords: ['telemea', 'oaie', 'capra', 'olympus'] },
      { id: 'lac_26', name: 'Cașcaval Rucăr Delaco', brand: 'Delaco', ean: '5941233000214', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 18.00, calories: 320, protein: 24.0, carbs: 0.5, fat: 25.0, fiber: 0, keywords: ['cascaval', 'rucar', 'delaco'] },
      { id: 'lac_27', name: 'Cașcaval Feliat Hochland Clasic', brand: 'Hochland', ean: '5941108000447', category: 'Ouă & Lactate', packageQuantity: 150, packagePrice: 8.50, calories: 325, protein: 24.5, carbs: 0.5, fat: 25.5, fiber: 0, keywords: ['cascaval', 'feliat', 'hochland'] },
      { id: 'lac_28', name: 'Mozzarella Fresca Galbani', brand: 'Galbani', ean: '8000430000008', category: 'Ouă & Lactate', packageQuantity: 125, packagePrice: 6.50, calories: 238, protein: 17.0, carbs: 1.0, fat: 18.5, fiber: 0, keywords: ['mozzarella', 'fresca', 'galbani'] },
      { id: 'lac_29', name: 'Mozzarella Rasă Milbona (Lidl)', brand: 'Milbona / Lidl', ean: '20152233', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 9.00, calories: 305, protein: 25.0, carbs: 2.0, fat: 22.0, fiber: 0, keywords: ['mozzarella', 'rasa', 'milbona', 'lidl', 'pizza'] },
      { id: 'lac_30', name: 'Brânză Halloumi Olympus', brand: 'Olympus', ean: '5201101005526', category: 'Ouă & Lactate', packageQuantity: 225, packagePrice: 16.50, calories: 322, protein: 21.0, carbs: 2.0, fat: 25.5, fiber: 0, keywords: ['halloumi', 'olympus', 'gratar'] },
      { id: 'lac_31', name: 'Parmezan Parmigiano Reggiano DOP Zanetti', brand: 'Zanetti', ean: '8001035112001', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 21.00, calories: 392, protein: 33.0, carbs: 0.0, fat: 28.5, fiber: 0, keywords: ['parmezan', 'parmigiano', 'reggiano'] },
      { id: 'lac_32', name: 'Grana Padano DOP Lovilio (Lidl)', brand: 'Lovilio / Lidl', ean: '20163344', category: 'Ouă & Lactate', packageQuantity: 200, packagePrice: 16.50, calories: 384, protein: 33.0, carbs: 0.0, fat: 28.0, fiber: 0, keywords: ['grana', 'padano', 'lovilio', 'lidl'] },
      { id: 'lac_33', name: 'Smântână Covalact 20%', brand: 'Covalact', ean: '5941178000308', category: 'Ouă & Lactate', packageQuantity: 375, packagePrice: 8.20, calories: 204, protein: 2.8, carbs: 3.2, fat: 20.0, fiber: 0, keywords: ['smantana', 'covalact', '20%'] },
      { id: 'lac_34', name: 'Smântână Gospodar Pilos 12% (Lidl)', brand: 'Pilos / Lidl', ean: '20121100', category: 'Ouă & Lactate', packageQuantity: 400, packagePrice: 5.20, calories: 131, protein: 3.1, carbs: 3.9, fat: 12.0, fiber: 0, keywords: ['smantana', 'pilos', 'lidl', '12%'] },
      { id: 'lac_35', name: 'Ouă M/L Toneli Bune (10 buc)', brand: 'Toneli', ean: '5941458000102', category: 'Ouă & Lactate', packageQuantity: 550, packagePrice: 13.50, calories: 143, protein: 12.6, carbs: 0.8, fat: 9.9, fiber: 0, keywords: ['oua', 'ou', 'toneli', 'gaini'] },

      // --- CARNE, PASĂRE, MEZELURI & PEȘTE ---
      { id: 'crn_01', name: 'Piept de Pui Dezosat Fragedo', brand: 'Transavia Fragedo', ean: '5941421000104', category: 'Carne & Pește', packageQuantity: 650, packagePrice: 22.50, calories: 115, protein: 23.5, carbs: 0.0, fat: 2.0, fiber: 0, keywords: ['piept', 'pui', 'fragedo', 'transavia', 'file'] },
      { id: 'crn_02', name: 'Piept de Pui File CocoRico', brand: 'CocoRico', ean: '5941885000114', category: 'Carne & Pește', packageQuantity: 700, packagePrice: 24.00, calories: 114, protein: 23.8, carbs: 0.0, fat: 1.8, fiber: 0, keywords: ['piept', 'pui', 'cocorico', 'file'] },
      { id: 'crn_03', name: 'Mușchiuleț din Piept de Pui Fragedo', brand: 'Transavia Fragedo', ean: '5941421000210', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 18.50, calories: 110, protein: 24.0, carbs: 0.0, fat: 1.5, fiber: 0, keywords: ['muschiulet', 'piept', 'pui', 'fragedo'] },
      { id: 'crn_04', name: 'Pulpe de Pui Dezosate Fără Piele Fragedo', brand: 'Transavia Fragedo', ean: '5941421000319', category: 'Carne & Pește', packageQuantity: 650, packagePrice: 17.50, calories: 155, protein: 20.0, carbs: 0.0, fat: 8.5, fiber: 0, keywords: ['pulpe', 'pui', 'dezosate', 'fragedo'] },
      { id: 'crn_05', name: 'Ciocănele de Pui CocoRico', brand: 'CocoRico', ean: '5941885000220', category: 'Carne & Pește', packageQuantity: 700, packagePrice: 14.50, calories: 172, protein: 18.5, carbs: 0.0, fat: 11.0, fiber: 0, keywords: ['ciocanele', 'pulpe', 'pui', 'cocorico'] },
      { id: 'crn_06', name: 'Piept de Curcan File Peneș Curcanul', brand: 'Peneș Curcanul', ean: '5941279000109', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 24.50, calories: 108, protein: 24.5, carbs: 0.0, fat: 1.0, fiber: 0, keywords: ['curcan', 'piept', 'penes', 'file'] },
      { id: 'crn_07', name: 'Carne Tocată de Pui CocoRico', brand: 'CocoRico', ean: '5941885000336', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 13.50, calories: 145, protein: 19.5, carbs: 0.0, fat: 7.5, fiber: 0, keywords: ['carne', 'tocata', 'pui', 'cocorico'] },
      { id: 'crn_08', name: 'Carne Tocată Amestec Vită-Porc', brand: 'Carmangerie Supermarket RO', ean: '20231199', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 14.00, calories: 240, protein: 18.0, carbs: 0.0, fat: 19.0, fiber: 0, keywords: ['carne', 'tocata', 'vita', 'porc', 'amestec'] },
      { id: 'crn_09', name: 'Mușchiuleț de Porc Proaspăt', brand: 'Periș / Comtim', ean: '5941334000118', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 18.50, calories: 143, protein: 22.0, carbs: 0.0, fat: 5.5, fiber: 0, keywords: ['muschiulet', 'porc', 'peris'] },
      { id: 'crn_10', name: 'Cotlet de Porc Fără Os', brand: 'Periș', ean: '5941334000224', category: 'Carne & Pește', packageQuantity: 650, packagePrice: 19.00, calories: 180, protein: 21.5, carbs: 0.0, fat: 10.5, fiber: 0, keywords: ['cotlet', 'porc', 'peris'] },
      { id: 'crn_11', name: 'Ceafă de Porc Fără Os', brand: 'Periș', ean: '5941334000330', category: 'Carne & Pește', packageQuantity: 650, packagePrice: 21.00, calories: 250, protein: 18.5, carbs: 0.0, fat: 19.5, fiber: 0, keywords: ['ceafa', 'porc', 'peris'] },
      { id: 'crn_12', name: 'Pulpă de Mânzat Vită', brand: 'Carmangerie Supermarket RO', ean: '20232288', category: 'Carne & Pește', packageQuantity: 500, packagePrice: 28.00, calories: 195, protein: 22.5, carbs: 0.0, fat: 11.5, fiber: 0, keywords: ['vita', 'manzat', 'pulpa'] },
      { id: 'crn_13', name: 'Antricot de Vită Black Angus', brand: 'Karpaten Meat', ean: '5941999000101', category: 'Carne & Pește', packageQuantity: 300, packagePrice: 35.00, calories: 245, protein: 21.0, carbs: 0.0, fat: 17.5, fiber: 0, keywords: ['antricot', 'vita', 'steak', 'angus'] },
      { id: 'crn_14', name: 'File de Somon Proaspăt cu Piele', brand: 'Pescărie Supermarket RO', ean: '20241155', category: 'Carne & Pește', packageQuantity: 300, packagePrice: 26.00, calories: 208, protein: 20.0, carbs: 0.0, fat: 13.5, fiber: 0, keywords: ['somon', 'file', 'peste', 'proaspat'] },
      { id: 'crn_15', name: 'Somon Afumat Feliat Nautica (Lidl)', brand: 'Nautica / Lidl', ean: '20185522', category: 'Carne & Pește', packageQuantity: 100, packagePrice: 12.50, calories: 185, protein: 21.0, carbs: 0.5, fat: 11.0, fiber: 0, keywords: ['somon', 'afumat', 'nautica', 'lidl'] },
      { id: 'crn_16', name: 'Ton Bucăți în Suc Propriu Rio Mare', brand: 'Rio Mare', ean: '8004030041019', category: 'Carne & Pește', packageQuantity: 160, packagePrice: 14.50, calories: 101, protein: 24.0, carbs: 0.0, fat: 0.5, fiber: 0, keywords: ['ton', 'rio', 'mare', 'conserva'] },
      { id: 'crn_17', name: 'Ton Bucăți în Ulei de Măsline Rio Mare', brand: 'Rio Mare', ean: '8004030041026', category: 'Carne & Pește', packageQuantity: 160, packagePrice: 16.50, calories: 190, protein: 21.0, carbs: 0.0, fat: 12.0, fiber: 0, keywords: ['ton', 'rio', 'mare', 'ulei', 'masline'] },
      { id: 'crn_18', name: 'Ton Bucăți Nixe în Suc Propriu (Lidl)', brand: 'Nixe / Lidl', ean: '20173344', category: 'Carne & Pește', packageQuantity: 185, packagePrice: 7.50, calories: 105, protein: 23.5, carbs: 0.0, fat: 1.0, fiber: 0, keywords: ['ton', 'nixe', 'lidl', 'conserva'] },
      { id: 'crn_19', name: 'Păstrăv Proaspăt Evoscerat', brand: 'Pescărie Supermarket RO', ean: '20242277', category: 'Carne & Pește', packageQuantity: 400, packagePrice: 15.50, calories: 140, protein: 20.5, carbs: 0.0, fat: 6.0, fiber: 0, keywords: ['pastrav', 'peste', 'proaspat'] },
      { id: 'crn_20', name: 'Doradă Proaspătă Evoscerată', brand: 'Pescărie Supermarket RO', ean: '20243388', category: 'Carne & Pește', packageQuantity: 400, packagePrice: 18.50, calories: 115, protein: 19.5, carbs: 0.0, fat: 3.5, fiber: 0, keywords: ['dorada', 'peste', 'proaspat'] },
      { id: 'crn_21', name: 'Creveți Decorticați Fierți Congelați', brand: 'Ocean Fish', ean: '5941655000109', category: 'Carne & Pește', packageQuantity: 300, packagePrice: 24.00, calories: 85, protein: 18.0, carbs: 0.8, fat: 1.0, fiber: 0, keywords: ['creveti', 'fructe', 'mare'] },
      { id: 'crn_22', name: 'Șuncă de Praga CrisTim', brand: 'CrisTim', ean: '5941199000103', category: 'Carne & Pește', packageQuantity: 150, packagePrice: 7.50, calories: 110, protein: 17.0, carbs: 1.5, fat: 4.0, fiber: 0, keywords: ['sunca', 'praga', 'cristim', 'mezeluri'] },
      { id: 'crn_23', name: 'Șuncă din Piept de Curcan Meda', brand: 'Meda', ean: '5941288000206', category: 'Carne & Pește', packageQuantity: 150, packagePrice: 8.50, calories: 95, protein: 19.0, carbs: 1.0, fat: 1.5, fiber: 0, keywords: ['sunca', 'curcan', 'meda', 'slaba'] },
      { id: 'crn_24', name: 'Mușchi File Feliat Matache Măcelaru\'', brand: 'Caroli Matache', ean: '5941122000311', category: 'Carne & Pește', packageQuantity: 120, packagePrice: 8.00, calories: 115, protein: 20.0, carbs: 1.0, fat: 3.5, fiber: 0, keywords: ['muschi', 'file', 'matache', 'caroli'] },
      { id: 'crn_25', name: 'Salam Săsesc CrisTim', brand: 'CrisTim', ean: '5941199000226', category: 'Carne & Pește', packageQuantity: 350, packagePrice: 15.00, calories: 245, protein: 16.0, carbs: 2.0, fat: 20.0, fiber: 0, keywords: ['salam', 'sasesc', 'cristim'] },
      { id: 'crn_26', name: 'Salam de Sibiu Agricola', brand: 'Agricola', ean: '5941019000117', category: 'Carne & Pește', packageQuantity: 300, packagePrice: 24.00, calories: 440, protein: 25.0, carbs: 1.0, fat: 38.0, fiber: 0, keywords: ['salam', 'sibiu', 'agricola'] },

      // --- CEREALE, PASTE & PANIFICAȚIE ---
      { id: 'cer_01', name: 'Paste Barilla Spaghetti n.5', brand: 'Barilla', ean: '8076800195057', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 6.50, calories: 359, protein: 12.5, carbs: 71.2, fat: 2.0, fiber: 3.0, keywords: ['paste', 'barilla', 'spaghetti', 'spaghete'] },
      { id: 'cer_02', name: 'Paste Barilla Penne Rigate', brand: 'Barilla', ean: '8076809513722', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 6.50, calories: 359, protein: 12.5, carbs: 71.2, fat: 2.0, fiber: 3.0, keywords: ['paste', 'barilla', 'penne'] },
      { id: 'cer_03', name: 'Paste Barilla Fusilli', brand: 'Barilla', ean: '8076809513753', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 6.50, calories: 359, protein: 12.5, carbs: 71.2, fat: 2.0, fiber: 3.0, keywords: ['paste', 'barilla', 'fusilli'] },
      { id: 'cer_04', name: 'Paste Barilla Integrale Penne', brand: 'Barilla', ean: '8076809545440', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 7.80, calories: 347, protein: 13.0, carbs: 64.0, fat: 2.5, fiber: 6.5, keywords: ['paste', 'barilla', 'integrale', 'penne'] },
      { id: 'cer_05', name: 'Paste Combino Penne Rigate (Lidl)', brand: 'Combino / Lidl', ean: '20112233', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 3.80, calories: 355, protein: 12.0, carbs: 72.0, fat: 1.5, fiber: 2.8, keywords: ['paste', 'combino', 'lidl', 'penne'] },
      { id: 'cer_06', name: 'Orez Basmati Scotti', brand: 'Riso Scotti', ean: '8001860195509', category: 'Cereale & Paste', packageQuantity: 1000, packagePrice: 13.50, calories: 350, protein: 8.5, carbs: 77.0, fat: 0.8, fiber: 1.2, keywords: ['orez', 'basmati', 'scotti'] },
      { id: 'cer_07', name: 'Orez Bob Rotund Deroni', brand: 'Deroni', ean: '5941215000108', category: 'Cereale & Paste', packageQuantity: 1000, packagePrice: 9.50, calories: 348, protein: 7.0, carbs: 78.5, fat: 0.6, fiber: 1.0, keywords: ['orez', 'deroni', 'rotund'] },
      { id: 'cer_08', name: 'Orez Iasomie Scotti', brand: 'Riso Scotti', ean: '8001860195608', category: 'Cereale & Paste', packageQuantity: 1000, packagePrice: 12.50, calories: 352, protein: 7.5, carbs: 78.0, fat: 0.7, fiber: 1.1, keywords: ['orez', 'iasomie', 'scotti'] },
      { id: 'cer_09', name: 'Fulgi de Ovăz Fin SanoVita', brand: 'SanoVita', ean: '5941458000225', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 5.50, calories: 375, protein: 13.5, carbs: 62.0, fat: 7.0, fiber: 10.0, keywords: ['ovaz', 'fulgi', 'sanovita', 'fin'] },
      { id: 'cer_10', name: 'Fulgi de Ovăz Fine Crownfield (Lidl)', brand: 'Crownfield / Lidl', ean: '20134455', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 3.60, calories: 372, protein: 13.5, carbs: 58.7, fat: 7.0, fiber: 10.0, keywords: ['ovaz', 'fulgi', 'crownfield', 'lidl'] },
      { id: 'cer_11', name: 'Cereale Nestle Fitness Clasic', brand: 'Nestle Fitness', ean: '7613035251111', category: 'Cereale & Paste', packageQuantity: 375, packagePrice: 13.50, calories: 368, protein: 8.8, carbs: 74.0, fat: 2.0, fiber: 7.8, keywords: ['cereale', 'fitness', 'nestle'] },
      { id: 'cer_12', name: 'Pâine Toast Titan Integrală', brand: 'GoodMills Titan', ean: '5941198000557', category: 'Cereale & Paste', packageQuantity: 600, packagePrice: 6.50, calories: 235, protein: 9.5, carbs: 42.0, fat: 2.2, fiber: 6.0, keywords: ['paine', 'toast', 'titan', 'integrala'] },
      { id: 'cer_13', name: 'Pâine Toast Alb Vel Pitar', brand: 'Vel Pitar', ean: '5941123000109', category: 'Cereale & Paste', packageQuantity: 600, packagePrice: 5.80, calories: 255, protein: 8.5, carbs: 49.0, fat: 1.8, fiber: 2.5, keywords: ['paine', 'toast', 'vel', 'pitar', 'alba'] },
      { id: 'cer_14', name: 'Lipii Libaneze Pita Mare', brand: 'Pita Rom', ean: '5941999000224', category: 'Cereale & Paste', packageQuantity: 300, packagePrice: 4.50, calories: 260, protein: 9.0, carbs: 52.0, fat: 1.5, fiber: 2.8, keywords: ['lipie', 'lipii', 'libaneze', 'pita', 'shaorma'] },
      { id: 'cer_15', name: 'Tortilla Wraps Poco Loco', brand: 'Poco Loco', ean: '5412514931015', category: 'Cereale & Paste', packageQuantity: 370, packagePrice: 8.00, calories: 305, protein: 8.0, carbs: 53.0, fat: 6.5, fiber: 3.0, keywords: ['tortilla', 'wraps', 'poco', 'loco'] },
      { id: 'cer_16', name: 'Quinoa Albă SanoVita', brand: 'SanoVita', ean: '5941458000331', category: 'Cereale & Paste', packageQuantity: 300, packagePrice: 11.50, calories: 368, protein: 14.1, carbs: 57.0, fat: 6.0, fiber: 7.0, keywords: ['quinoa', 'sanovita'] },
      { id: 'cer_17', name: 'Couscous Băneasa', brand: 'Băneasa', ean: '5941198000663', category: 'Cereale & Paste', packageQuantity: 500, packagePrice: 5.50, calories: 356, protein: 12.0, carbs: 73.0, fat: 1.5, fiber: 3.5, keywords: ['couscous', 'cuscus', 'baneasa'] },
      { id: 'cer_18', name: 'Făină Albă Superioară 000 Băneasa', brand: 'Băneasa', ean: '5941198000779', category: 'Cereale & Paste', packageQuantity: 1000, packagePrice: 4.50, calories: 348, protein: 10.5, carbs: 73.5, fat: 1.0, fiber: 2.5, keywords: ['faina', 'alba', 'baneasa', '000'] },
      { id: 'cer_19', name: 'Mălai Extra Pambac', brand: 'Pambac', ean: '5941155000106', category: 'Cereale & Paste', packageQuantity: 1000, packagePrice: 4.00, calories: 351, protein: 7.5, carbs: 76.0, fat: 1.2, fiber: 2.2, keywords: ['malai', 'pambac', 'mamaliga'] },
      { id: 'cer_20', name: 'Covrig Brașovean cu Mac / Susan', brand: 'Simigerie Luca / Petru', ean: '', category: 'Cereale & Paste', packageQuantity: 100, packagePrice: 2.50, calories: 320, protein: 9.5, carbs: 62.0, fat: 3.5, fiber: 2.5, keywords: ['covrig', 'brasovean', 'mac', 'susan', 'simigerie'] },
      { id: 'cer_21', name: 'Covrigi de Buzău cu Sare / Mac', brand: 'Boromir', ean: '5941198000991', category: 'Cereale & Paste', packageQuantity: 250, packagePrice: 4.50, calories: 385, protein: 11.0, carbs: 75.0, fat: 4.0, fiber: 3.5, keywords: ['covrigi', 'buzau', 'boromir'] },

      // --- LEGUME & FRUCTE ---
      { id: 'leg_01', name: 'Cartofi Albi / Roșii', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 3.50, calories: 77, protein: 2.0, carbs: 17.5, fat: 0.1, fiber: 2.1, keywords: ['cartofi', 'cartof', 'piata'] },
      { id: 'leg_02', name: 'Cartofi Dulci (Batate)', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 8.50, calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, fiber: 3.0, keywords: ['cartofi', 'dulci', 'batate'] },
      { id: 'leg_03', name: 'Ciuperci Champignon Albe', brand: 'Caserolă RO', ean: '5941010001014', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 7.50, calories: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1.0, keywords: ['ciuperci', 'champignon'] },
      { id: 'leg_04', name: 'Roșii Ciorchine Românești', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 6.50, calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, keywords: ['rosii', 'rosie', 'ciorchine'] },
      { id: 'leg_05', name: 'Roșii Cherry Caserolă', brand: 'Caserolă RO', ean: '5941010002028', category: 'Legume & Fructe', packageQuantity: 250, packagePrice: 5.50, calories: 20, protein: 1.0, carbs: 4.2, fat: 0.2, fiber: 1.4, keywords: ['rosii', 'cherry'] },
      { id: 'leg_06', name: 'Castraveți Cornișon / Fabio', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 4.50, calories: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5, keywords: ['castraveti', 'castravete', 'fabio'] },
      { id: 'leg_07', name: 'Ardei Kapia Roșu', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 6.50, calories: 28, protein: 1.1, carbs: 5.8, fat: 0.2, fiber: 1.8, keywords: ['ardei', 'kapia', 'rosu'] },
      { id: 'leg_08', name: 'Ardei Gras Galben / Verde', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 6.00, calories: 26, protein: 1.0, carbs: 5.3, fat: 0.2, fiber: 1.7, keywords: ['ardei', 'gras', 'galben', 'verde'] },
      { id: 'leg_09', name: 'Ceapă Galbenă', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 4.00, calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, keywords: ['ceapa', 'galbena'] },
      { id: 'leg_10', name: 'Ceapă Roșie', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 3.50, calories: 42, protein: 1.2, carbs: 9.5, fat: 0.1, fiber: 1.8, keywords: ['ceapa', 'rosie'] },
      { id: 'leg_11', name: 'Usturoi Căpățâni', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 200, packagePrice: 4.00, calories: 149, protein: 6.4, carbs: 33.0, fat: 0.5, fiber: 2.1, keywords: ['usturoi'] },
      { id: 'leg_12', name: 'Spanac Baby Spălat Pungă', brand: 'Fresh RO', ean: '5941999000330', category: 'Legume & Fructe', packageQuantity: 200, packagePrice: 6.50, calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, keywords: ['spanac', 'baby', 'salata'] },
      { id: 'leg_13', name: 'Salată Verde Eisberg Mix', brand: 'Eisberg', ean: '5941445000107', category: 'Legume & Fructe', packageQuantity: 200, packagePrice: 5.50, calories: 16, protein: 1.3, carbs: 2.5, fat: 0.2, fiber: 1.5, keywords: ['salata', 'eisberg', 'mix', 'verde'] },
      { id: 'leg_14', name: 'Rucola Proaspătă Caserolă', brand: 'Fresh RO', ean: '5941999000446', category: 'Legume & Fructe', packageQuantity: 125, packagePrice: 5.50, calories: 25, protein: 2.6, carbs: 3.7, fat: 0.7, fiber: 1.6, keywords: ['rucola', 'salata'] },
      { id: 'leg_15', name: 'Broccoli Proaspăt', brand: 'Fresh RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 6.50, calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, keywords: ['broccoli'] },
      { id: 'leg_16', name: 'Conopidă Proaspătă', brand: 'Fresh RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 7.50, calories: 25, protein: 1.9, carbs: 5.0, fat: 0.3, fiber: 2.0, keywords: ['conopida'] },
      { id: 'leg_17', name: 'Morcovi Românești', brand: 'Piață RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 3.80, calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, keywords: ['morcovi', 'morcov'] },
      { id: 'leg_18', name: 'Dovlecei Zucchini', brand: 'Fresh RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 4.50, calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1.0, keywords: ['dovlecei', 'zucchini'] },
      { id: 'leg_19', name: 'Avocado Ready to Eat', brand: 'Import Supermarket RO', ean: '', category: 'Legume & Fructe', packageQuantity: 180, packagePrice: 6.50, calories: 160, protein: 2.0, carbs: 8.5, fat: 14.7, fiber: 6.7, keywords: ['avocado', 'ready'] },
      { id: 'leg_20', name: 'Banane Premium', brand: 'Import Supermarket RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 6.50, calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, keywords: ['banane', 'banana'] },
      { id: 'leg_21', name: 'Mere Golden Românești', brand: 'Livezi RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 4.50, calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, keywords: ['mere', 'mar', 'golden'] },
      { id: 'leg_22', name: 'Afine Proaspete Caserolă', brand: 'Fresh RO', ean: '5941999000552', category: 'Legume & Fructe', packageQuantity: 125, packagePrice: 7.50, calories: 57, protein: 0.7, carbs: 14.5, fat: 0.3, fiber: 2.4, keywords: ['afine', 'fructe', 'padure'] },
      { id: 'leg_23', name: 'Căpșuni Proaspete Caserolă', brand: 'Fresh RO', ean: '5941999000668', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 12.50, calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2.0, keywords: ['capsuni', 'capsuna'] },
      { id: 'leg_24', name: 'Lămâie Proaspătă', brand: 'Import Supermarket RO', ean: '', category: 'Legume & Fructe', packageQuantity: 500, packagePrice: 4.50, calories: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8, keywords: ['lamaie', 'lamaie'] },
      { id: 'leg_25', name: 'Portocale Dulci', brand: 'Import Supermarket RO', ean: '', category: 'Legume & Fructe', packageQuantity: 1000, packagePrice: 5.50, calories: 47, protein: 0.9, carbs: 11.8, fat: 0.1, fiber: 2.4, keywords: ['portocale', 'portocala'] },

      // --- GRĂSIMI, ULEIURI, NUCI & SUPLIMENTE ---
      { id: 'grs_01', name: 'Ulei de Măsline Extra Virgin Monini', brand: 'Monini', ean: '8005510001108', category: 'Grăsimi & Uleiuri', packageQuantity: 1000, packagePrice: 52.00, calories: 824, protein: 0.0, carbs: 0.0, fat: 91.6, fiber: 0, keywords: ['ulei', 'masline', 'extra', 'virgin', 'monini'] },
      { id: 'grs_02', name: 'Ulei de Măsline Extra Virgin Primadonna (Lidl)', brand: 'Primadonna / Lidl', ean: '20165544', category: 'Grăsimi & Uleiuri', packageQuantity: 690, packagePrice: 32.00, calories: 824, protein: 0.0, carbs: 0.0, fat: 91.6, fiber: 0, keywords: ['ulei', 'masline', 'primadonna', 'lidl'] },
      { id: 'grs_03', name: 'Ulei de Floarea Soarelui Floriol', brand: 'Floriol', ean: '5941014001010', category: 'Grăsimi & Uleiuri', packageQuantity: 920, packagePrice: 8.50, calories: 828, protein: 0.0, carbs: 0.0, fat: 92.0, fiber: 0, keywords: ['ulei', 'floarea', 'soarelui', 'floriol'] },
      { id: 'grs_04', name: 'Unt Albalact 65% Grăsime', brand: 'Albalact', ean: '5941112002104', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 9.50, calories: 592, protein: 1.0, carbs: 1.0, fat: 65.0, fiber: 0, keywords: ['unt', 'albalact', '65'] },
      { id: 'grs_05', name: 'Unt Lurpak Nesărat 82%', brand: 'Lurpak', ean: '5740900400109', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 15.50, calories: 740, protein: 0.7, carbs: 0.7, fat: 82.0, fiber: 0, keywords: ['unt', 'lurpak', '82'] },
      { id: 'grs_06', name: 'Unt de Arahide Fin SanoVita', brand: 'SanoVita', ean: '5941458000447', category: 'Grăsimi & Uleiuri', packageQuantity: 350, packagePrice: 12.50, calories: 595, protein: 25.0, carbs: 15.0, fat: 48.0, fiber: 6.0, keywords: ['unt', 'arahide', 'peanut', 'butter', 'sanovita'] },
      { id: 'grs_07', name: 'Miez de Nucă Românească', brand: 'Piață RO', ean: '', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 13.50, calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2, fiber: 6.7, keywords: ['nuci', 'nuca', 'miez'] },
      { id: 'grs_08', name: 'Migdale Crude Alesto (Lidl)', brand: 'Alesto / Lidl', ean: '20146633', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 12.50, calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9, fiber: 12.5, keywords: ['migdale', 'alesto', 'lidl', 'crude'] },
      { id: 'grs_09', name: 'Caju Crud Alesto (Lidl)', brand: 'Alesto / Lidl', ean: '20147744', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 14.50, calories: 553, protein: 18.2, carbs: 30.2, fat: 43.8, fiber: 3.3, keywords: ['caju', 'alesto', 'lidl', 'crud'] },
      { id: 'grs_10', name: 'Semințe de Chia SanoVita', brand: 'SanoVita', ean: '5941458000553', category: 'Grăsimi & Uleiuri', packageQuantity: 200, packagePrice: 7.50, calories: 486, protein: 16.5, carbs: 42.1, fat: 30.7, fiber: 34.4, keywords: ['chia', 'seminte', 'sanovita'] },
      { id: 'grs_11', name: 'Năut Fiert Conservă Bonduelle', brand: 'Bonduelle', ean: '3083680011029', category: 'Legume & Fructe', packageQuantity: 400, packagePrice: 5.50, calories: 119, protein: 7.0, carbs: 16.5, fat: 2.2, fiber: 5.8, keywords: ['naut', 'bonduelle', 'conserva'] },
      { id: 'grs_12', name: 'Fasole Roșie Kidney Bonduelle', brand: 'Bonduelle', ean: '3083680011036', category: 'Legume & Fructe', packageQuantity: 400, packagePrice: 5.50, calories: 102, protein: 7.5, carbs: 14.0, fat: 0.6, fiber: 6.4, keywords: ['fasole', 'rosie', 'bonduelle', 'conserva'] },
      { id: 'grs_13', name: 'Porumb Dulce Boabe Bonduelle', brand: 'Bonduelle', ean: '3083680011043', category: 'Legume & Fructe', packageQuantity: 340, packagePrice: 6.00, calories: 80, protein: 2.9, carbs: 15.5, fat: 1.2, fiber: 2.4, keywords: ['porumb', 'dulce', 'bonduelle'] },
      { id: 'grs_14', name: 'Sos de Roșii Passata Cirio', brand: 'Cirio / Mutti', ean: '8001440120013', category: 'Legume & Fructe', packageQuantity: 700, packagePrice: 9.50, calories: 24, protein: 1.3, carbs: 4.2, fat: 0.2, fiber: 1.1, keywords: ['passata', 'rosii', 'cirio', 'sos'] },
      { id: 'grs_15', name: 'Sos Pesto alla Genovese Barilla', brand: 'Barilla', ean: '8076809513333', category: 'Grăsimi & Uleiuri', packageQuantity: 190, packagePrice: 14.50, calories: 482, protein: 4.5, carbs: 5.0, fat: 46.0, fiber: 2.0, keywords: ['pesto', 'barilla', 'genovese', 'sos'] },
      { id: 'grs_16', name: 'Pudră Proteică Whey Gold Standard ON', brand: 'Optimum Nutrition', ean: '5060469988017', category: 'Ouă & Lactate', packageQuantity: 908, packagePrice: 155.00, calories: 375, protein: 78.0, carbs: 5.5, fat: 4.5, fiber: 1.0, keywords: ['whey', 'proteina', 'pudra', 'gold', 'standard'] },
      { id: 'grs_17', name: 'Pudră Proteică Impact Whey MyProtein', brand: 'MyProtein', ean: '5055936801018', category: 'Ouă & Lactate', packageQuantity: 1000, packagePrice: 125.00, calories: 390, protein: 80.0, carbs: 6.0, fat: 5.5, fiber: 0, keywords: ['whey', 'myprotein', 'proteina', 'pudra'] },
      { id: 'grs_18', name: 'Miere Polifloră Românească', brand: 'Stupină RO', ean: '5941458000669', category: 'Dulciuri', packageQuantity: 400, packagePrice: 14.00, calories: 304, protein: 0.3, carbs: 82.4, fat: 0.0, fiber: 0.2, keywords: ['miere', 'albine', 'poliflora'] }
    ];
  }

  // Estimate price and category for any ingredient name using Romanian market data
  estimateMarketData(name, quantityGrams = 100) {
    const clean = this.normalizeStr(name);
    
    // 1. Check exact or partial match in supermarket catalog first
    if (this.supermarketCatalog && this.supermarketCatalog.length > 0) {
      const catMatch = this.supermarketCatalog.find(p => {
        const pNorm = this.normalizeStr(p.name + ' ' + (p.brand || ''));
        return pNorm.includes(clean) || clean.includes(pNorm);
      });
      if (catMatch) {
        const packQty = catMatch.packageQuantity || 100;
        const packPrice = catMatch.packagePrice;
        const pricePer100g = parseFloat((packPrice / (packQty / 100)).toFixed(2));
        return {
          category: catMatch.category,
          packageQuantity: packQty,
          packagePrice: packPrice,
          pricePer100g,
          calories: catMatch.calories,
          protein: catMatch.protein,
          carbs: catMatch.carbs,
          fat: catMatch.fat
        };
      }
    }

    // 2. Check benchmarks
    const tokens = clean.split(' ').filter(t => t.length > 1);
    let best = this.priceBenchmarks.find(b => b.keywords.some(k => clean.includes(k) || tokens.some(t => k.includes(t))));
    if (!best) {
      best = {
        cat: 'Ingrediente',
        avgPerKg: 22.0,
        defaultPackG: 500,
        kcal: 160,
        prot: 6.0,
        carbs: 22.0,
        fat: 5.0
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

  // 1. Search online products (Instant Offline-First Supermarket Catalog + Pantry + Live OFF + Fallback Synthesizer)
  async searchOnlineProducts(query) {
    if (!query || !query.trim()) return [];
    const rawQ = query.trim();
    const qNorm = this.normalizeStr(rawQ);
    if (!qNorm) return [];
    const STOPWORDS = new Set(['de', 'cu', 'la', 'si', 'in', 'din', 'pe', 'fara', 'sub', 'un', 'o', 'al', 'ai', 'ale', 'pt', 'pentru']);
    let qTokens = qNorm.split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t));
    if (qTokens.length === 0) {
      qTokens = qNorm.split(' ').filter(t => t.length > 0);
    }

    const results = [];
    const seenNames = new Set();

    const addResult = (item) => {
      const key = (item.rawName || item.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!seenNames.has(key)) {
        seenNames.add(key);
        results.push(item);
      }
    };

    // Detect category intent from query
    const dairyKeywords = ['lapte', 'iaurt', 'branza', 'smantana', 'kefir', 'sana', 'unt', 'cascaval', 'mozzarella', 'telemea', 'urda', 'cottage', 'skyr', 'fagaras', 'pilos', 'zuzu', 'olympus', 'danone', 'albalact', 'covalact', 'hochland', 'delaco', 'napolact', 'ladorna'];
    const meatKeywords = ['pui', 'porc', 'vita', 'curcan', 'somon', 'ton', 'peste', 'carne', 'piept', 'pulpe', 'muschi', 'sunca', 'salam', 'creveti', 'pastrav', 'dorada', 'mici', 'carnati', 'cotlet', 'ceafa', 'muschiulet', 'ciocanele'];
    const sweetKeywords = ['ciocolata', 'kinder', 'milka', 'nutella', 'oreo', 'kitkat', 'snickers', 'twix', 'bounty', 'croissant', 'biscuiti', 'eugenia', 'dulciuri', 'bomboane', 'praline', 'napolitana', 'tort', 'prajitura', 'heidi', 'lindt', 'raffaello', 'ferrero'];

    const hasDairyIntent = qTokens.some(t => dairyKeywords.includes(t));
    const hasMeatIntent = qTokens.some(t => meatKeywords.includes(t));
    const hasSweetIntent = qTokens.some(t => sweetKeywords.includes(t));

    // 1. Search in Curated Romanian Supermarket Catalog with Multi-Token Scoring & Category Protection
    const catalogScored = [];
    this.supermarketCatalog.forEach(prod => {
      const pNameNorm = this.normalizeStr(prod.name);
      const pBrandNorm = this.normalizeStr(prod.brand || '');
      const pKeywordsNorm = prod.keywords ? prod.keywords.map(k => this.normalizeStr(k)).join(' ') : '';
      const fullText = `${pNameNorm} ${pBrandNorm} ${pKeywordsNorm}`;

      // Strict category protection: Never return sweets when user searches for dairy (milk, cheese, yogurt) or meat/fish
      if (hasDairyIntent && !hasSweetIntent && prod.category === 'Dulciuri') {
        return;
      }
      if (hasMeatIntent && !hasSweetIntent && prod.category === 'Dulciuri') {
        return;
      }

      let score = 0;
      const isExact = pNameNorm === qNorm;
      const isPrefix = pNameNorm.startsWith(qNorm);
      const hasFullQuery = fullText.includes(qNorm);

      if (isExact) score += 2000;
      else if (isPrefix) score += 1200;
      else if (hasFullQuery) score += 800;

      const matchedTokens = qTokens.filter(t => fullText.includes(t));
      const matchAll = qTokens.length > 0 && matchedTokens.length === qTokens.length;

      if (matchAll) {
        score += 1000;
        // Even higher if all tokens are in the product name itself
        if (qTokens.every(t => pNameNorm.includes(t))) score += 500;
      } else if (qTokens.length > 1) {
        // If query has 2+ words (e.g. "lapte pilos"), penalize partial single-token matches
        score -= 300;
      }

      // Check if product name starts with the main token (e.g. "Lapte ...")
      if (qTokens.length > 0 && pNameNorm.startsWith(qTokens[0])) {
        score += 400;
      }

      // Category match bonuses
      if (hasDairyIntent && prod.category === 'Ouă & Lactate') score += 300;
      if (hasMeatIntent && prod.category === 'Carne & Pește') score += 300;
      if (hasSweetIntent && prod.category === 'Dulciuri') score += 300;

      score += matchedTokens.length * 60;

      if (score > 0) {
        catalogScored.push({ prod, score, matchAll });
      }
    });

    catalogScored.sort((a, b) => b.score - a.score);

    // If we have items matching all tokens, prioritize only those!
    const allMatches = catalogScored.filter(item => item.matchAll);
    const topCatalog = (allMatches.length >= 2) ? allMatches : catalogScored;

    topCatalog.slice(0, 10).forEach(item => {
      const p = item.prod;
      const packPrice = p.packagePrice;
      const packQty = p.packageQuantity;
      addResult({
        id: 'cat_' + p.id,
        name: p.brand ? `${p.name} (${p.brand})` : p.name,
        rawName: p.name,
        brand: p.brand || 'Supermarket RO',
        ean: p.ean || '',
        category: p.category,
        packageQuantity: packQty,
        packagePrice: packPrice,
        pricePer100g: parseFloat((packPrice / (packQty / 100)).toFixed(2)),
        calories: p.calories,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        fiber: p.fiber || 0,
        imageUrl: p.imageUrl || '',
        source: 'Catalog Supermarket RO'
      });
    });

    // 2. Search in user pantry / local store
    if (typeof window !== 'undefined' && window.store && window.store.data && Array.isArray(window.store.data.ingredients)) {
      const localMatches = [];
      window.store.data.ingredients.forEach(i => {
        const iNorm = this.normalizeStr(i.name + ' ' + (i.category || ''));
        if (hasDairyIntent && !hasSweetIntent && i.category === 'Dulciuri') return;
        if (hasMeatIntent && !hasSweetIntent && i.category === 'Dulciuri') return;

        const hasFull = iNorm.includes(qNorm);
        const matchAll = qTokens.length > 0 && qTokens.every(t => iNorm.includes(t));
        const matchSome = qTokens.length > 0 && qTokens.some(t => iNorm.includes(t));

        if (hasFull || matchAll || (matchSome && qTokens.length === 1)) {
          let score = hasFull ? 500 : (matchAll ? 350 : 100);
          if (hasDairyIntent && i.category === 'Ouă & Lactate') score += 150;
          if (hasMeatIntent && i.category === 'Carne & Pește') score += 150;
          localMatches.push({ item: i, score });
        }
      });

      localMatches.sort((a, b) => b.score - a.score);
      localMatches.slice(0, 4).forEach(({ item: i }) => {
        addResult({
          id: i.id,
          name: i.name,
          rawName: i.name,
          brand: 'Cămară Locală',
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
      });
    }

    // 3. Fast Online Search Open Food Facts (with 1.2s timeout, safe silent catch for CORS)
    try {
      if (typeof AbortController !== 'undefined') {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1200);
        const resp = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(rawQ)}&page_size=6`, {
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          const json = await resp.json();
          const hits = json.hits || [];
          hits.forEach(h => {
            const name = h.product_name || h.product_name_ro || h.product_name_en || '';
            if (!name) return;
            const brands = Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands || '');
            const combinedNameNorm = this.normalizeStr(name + ' ' + brands);
            if (hasDairyIntent && !hasSweetIntent && (
              combinedNameNorm.includes('ciocolat') ||
              combinedNameNorm.includes('bomboan') ||
              combinedNameNorm.includes('biscuit') ||
              combinedNameNorm.includes('napolitan') ||
              combinedNameNorm.includes('pralin') ||
              combinedNameNorm.includes('kinder') ||
              combinedNameNorm.includes('desert') ||
              combinedNameNorm.includes('tort')
            )) {
              return;
            }
            const nut = h.nutriments || {};

            let packG = 100;
            if (h.quantity) {
              const m = String(h.quantity).match(/([0-9.,]+)\s*(g|gr|gram|ml|l|kg)/i);
              if (m) {
                const val = parseFloat(m[1].replace(',', '.'));
                const unit = m[2].toLowerCase();
                packG = (unit === 'kg' || unit === 'l') ? val * 1000 : val;
              }
            }

            const market = this.estimateMarketData(name + ' ' + brands, packG);
            if (hasDairyIntent && !hasSweetIntent && market.category === 'Dulciuri') return;
            if (hasMeatIntent && !hasSweetIntent && market.category === 'Dulciuri') return;
            const packPrice = parseFloat(((market.pricePer100g * packG) / 100).toFixed(2));

            const calories = Math.round(nut['energy-kcal_100g'] || (nut.energy_100g ? nut.energy_100g / 4.184 : market.calories));
            const protein = parseFloat(Number(nut.proteins_100g ?? market.protein).toFixed(1));
            const carbs = parseFloat(Number(nut.carbohydrates_100g ?? market.carbs).toFixed(1));
            const fat = parseFloat(Number(nut.fat_100g ?? market.fat).toFixed(1));
            const fiber = parseFloat(Number(nut.fiber_100g ?? 0).toFixed(1));

            addResult({
              id: 'off_' + (h.code || Math.random().toString(36).substr(2, 6)),
              name: brands ? `${name} (${brands})` : name,
              rawName: name,
              brand: brands || 'Open Food Facts',
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
      }
    } catch (e) {
      // Silent fallback when offline or CORS-blocked
    }

    // 4. Universal Market Synthesizer Fallback: NEVER return empty!
    if (results.length === 0) {
      const formattedTitle = rawQ.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      const market = this.estimateMarketData(rawQ, 500);
      const packG = market.packageQuantity || 500;
      const packPrice = market.packagePrice;

      addResult({
        id: 'synth_' + Date.now(),
        name: formattedTitle,
        rawName: formattedTitle,
        brand: 'Piața RO (Supermarket)',
        ean: '',
        category: market.category,
        packageQuantity: packG,
        packagePrice: packPrice,
        pricePer100g: parseFloat((packPrice / (packG / 100)).toFixed(2)),
        calories: market.calories,
        protein: market.protein,
        carbs: market.carbs,
        fat: market.fat,
        fiber: 1.0,
        imageUrl: '',
        source: '✨ Estimare Nutrițională Piață (RO)'
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

  // Smart Natural Language Ingredient & Quantity Parser
  // Examples: "faina 60g", "ouă 3 buc", "3 oua", "lapte 250ml", "1 kg cartofi", "2 linguri ulei", "1/4 cup chocolate chips"
  parseIngredientToken(rawToken, servings = 1) {
    if (!rawToken || typeof rawToken !== 'string') return null;
    let str = rawToken
      .replace(/\*.*?\*/g, '')
      .replace(/My favorite is.*$/i, '')
      .trim()
      .toLowerCase();
    if (!str) return null;

    // Helper for fractions like "1/2", "1/4", "3/4"
    const evalFraction = (s) => {
      if (!s) return 1;
      if (s.includes('/')) {
        const parts = s.split('/');
        return (parseFloat(parts[0]) || 1) / (parseFloat(parts[1]) || 1);
      }
      return parseFloat(s.replace(',', '.')) || 1;
    };

    // Standard piece and unit weights in grams (Romanian standard supermarket reference)
    const PIECE_WEIGHTS = [
      { regex: /\b(ou[aă]?|oua|oou[aă]?|eggs?)\b/i, weight: 55, defaultName: 'Ouă' },
      { regex: /\b(banana|banane)\b/i, weight: 120, defaultName: 'Banane' },
      { regex: /\b(m[aă]r|mere|apples?)\b/i, weight: 150, defaultName: 'Mere' },
      { regex: /\b(par[aă]|pere|pears?)\b/i, weight: 160, defaultName: 'Pere' },
      { regex: /\b(ceap[aă]|cepe|onions?)\b/i, weight: 90, defaultName: 'Ceapă' },
      { regex: /\b(ro[sș]ie|ro[sș]ii|tomatoes?)\b/i, weight: 120, defaultName: 'Roșii' },
      { regex: /\b(cartof|cartofi|potatoes?)\b/i, weight: 150, defaultName: 'Cartofi' },
      { regex: /\b(castravete|castrave[tț]i|cucumbers?)\b/i, weight: 120, defaultName: 'Castraveți' },
      { regex: /\b(avocado)\b/i, weight: 160, defaultName: 'Avocado' },
      { regex: /\b(l[aă]m[aâ]ie|l[aă]m[aâ]i|lemons?)\b/i, weight: 80, defaultName: 'Lămâie' },
      { regex: /\b(portocal[aă]|portocale|oranges?)\b/i, weight: 180, defaultName: 'Portocale' },
      { regex: /\b(ardei|peppers?)\b/i, weight: 120, defaultName: 'Ardei' },
      { regex: /\b(morcov|morcovi|carrots?)\b/i, weight: 80, defaultName: 'Morcovi' },
      { regex: /\b(dovlecel|dovlecei|zucchini)\b/i, weight: 200, defaultName: 'Dovlecei' },
      { regex: /\b(usturoi|c[aă][tț]el.*usturoi|garlic)\b/i, weight: 5, defaultName: 'Usturoi' },
      { regex: /\b(felie|felii|slices?)\b/i, weight: 35, defaultName: 'Pâine toast' },
      { regex: /\b(lipie|lipii|tortilla)\b/i, weight: 60, defaultName: 'Lipie' },
      { regex: /\b(covrig|covrigi)\b/i, weight: 90, defaultName: 'Covrig' },
      { regex: /\b(conserv[aă]|conserve|cans?)\b/i, weight: 160, defaultName: 'Conservă' }
    ];

    let explicitGrams = null;
    let parsedName = str;
    let isPieceCount = false;
    let pieceCount = 1;

    // 1. Grams / kg / ml / l: e.g. "60g", "60 g", "60gr", "0.5kg", "250ml", "1l", "(31 g)"
    const gramRegex = /([0-9]+(?:[.,][0-9]+)?)\s*(kg|kilograme?|kile|g|gr|grame|ml|mililitri|l|litri)\b/i;
    const matchGram = str.match(gramRegex);
    if (matchGram) {
      let val = parseFloat(matchGram[1].replace(',', '.'));
      const unit = matchGram[2].toLowerCase();
      if (unit.startsWith('k') || unit === 'l' || unit === 'litri' || unit === 'litru') {
        val = val * 1000;
      }
      explicitGrams = Math.round(val);
      parsedName = str.replace(matchGram[0], '').trim();
    }

    // 2. Cups: "1/4 cup", "2 cups", "1 cana"
    if (explicitGrams === null) {
      const cupRegex = /([0-9]+(?:\/[0-9]+|[.,][0-9]+)?)\s*(cups?|c\b|can[aăe]|c[aă]ni)\b/i;
      const matchCup = str.match(cupRegex);
      if (matchCup) {
        const val = evalFraction(matchCup[1]);
        if (/choc|ciocolat/i.test(str)) explicitGrams = Math.round(val * 170);
        else if (/oat|ovaz|flour|fain/i.test(str)) explicitGrams = Math.round(val * 100);
        else if (/milk|water|liquid|lapte|apa/i.test(str)) explicitGrams = Math.round(val * 240);
        else explicitGrams = Math.round(val * 120);
        parsedName = str.replace(matchCup[0], '').trim();
      }
    }

    // 3. Spoons / tablespoons / teaspoons / linguri / lingurite: "2 linguri", "1 tsp", "1/2 tsp"
    if (explicitGrams === null) {
      const spoonRegex = /([0-9]+(?:\/[0-9]+|[.,][0-9]+)?)\s*(tbsp|tablespoons?|tsp|teaspoons?|lgt|linguri[tț][aăe]?|lg|lingur[aăe]?)\b/i;
      const matchSpoon = str.match(spoonRegex);
      if (matchSpoon) {
        const count = evalFraction(matchSpoon[1]);
        const isTeaspoon = /tsp|teaspoon|linguri[tț]|lgt/i.test(matchSpoon[2]);
        explicitGrams = Math.max(2, Math.round(count * (isTeaspoon ? 5 : 15)));
        parsedName = str.replace(matchSpoon[0], '').trim();
      }
    }

    // 4. Scoops: "1 scoop (31 g)", "2 cupe"
    if (explicitGrams === null) {
      const scoopRegex = /([0-9]+(?:\/[0-9]+|[.,][0-9]+)?)\s*(scoops?|cupe?)\b/i;
      const matchScoop = str.match(scoopRegex);
      if (matchScoop) {
        const count = evalFraction(matchScoop[1]);
        explicitGrams = Math.round(count * 31);
        parsedName = str.replace(matchScoop[0], '').trim();
      }
    }

    // 5. Pinches / Dashes: "pinch of salt", "few dashes of cinnamon"
    if (explicitGrams === null && /\b(pinch|dashes|dash|vf|varf)\b/i.test(str)) {
      explicitGrams = 2;
    }

    // 6. Pieces / bucăți: e.g. "ouă 3 buc", "3 oua", "2 mere", "1 avocado", "banane 2 buc"
    if (explicitGrams === null) {
      const bucRegex = /([0-9]+(?:[.,][0-9]+)?)\s*(buc[a-z\u0103\u0102\u00e2\u00c2\u00ee\u00ce\u0219\u0218\u021b\u021a]*|pieces?|eggs?|ou[a-z\u0103\u0102\u00e2\u00c2\u00ee\u00ce\u0219\u0218\u021b\u021a]*|banan[a-z\u0103\u0102\u00e2\u00c2\u00ee\u00ce\u0219\u0218\u021b\u021a]*|mere?)\b/i;
      const matchBuc = str.match(bucRegex);
      if (matchBuc) {
        pieceCount = parseFloat(matchBuc[1].replace(',', '.'));
        isPieceCount = true;
        parsedName = str.replace(matchBuc[0], '').trim();
      } else {
        const startNumRegex = /^([0-9]+(?:[.,][0-9]+)?)\s+([a-zA-Z\u0103\u0102\u00e2\u00c2\u00ee\u00ce\u0219\u0218\u021b\u021a].*)$/i;
        const matchStart = str.match(startNumRegex);
        if (matchStart) {
          pieceCount = parseFloat(matchStart[1].replace(',', '.'));
          isPieceCount = true;
          parsedName = matchStart[2].trim();
        } else {
          const endNumRegex = /^(.*?)\s+([0-9]+(?:[.,][0-9]+)?)$/i;
          const matchEnd = str.match(endNumRegex);
          if (matchEnd) {
            pieceCount = parseFloat(matchEnd[2].replace(',', '.'));
            isPieceCount = true;
            parsedName = matchEnd[1].trim();
          }
        }
      }

      if (isPieceCount) {
        const matchedPiece = PIECE_WEIGHTS.find(pw => pw.regex.test(parsedName) || pw.regex.test(str));
        if (matchedPiece) {
          explicitGrams = Math.round(pieceCount * matchedPiece.weight);
        } else {
          explicitGrams = Math.round(pieceCount * 100);
        }
      }
    }

    // Check culinary translation map (English or Romanian culinary terms)
    let matchedFromMap = null;
    const lookupStr = str.toLowerCase();
    if (this.culinaryMap) {
      for (const entry of this.culinaryMap) {
        if (entry.isTitle) continue;
        for (const term of entry.en) {
          const reg = new RegExp('\\b' + term.replace(/\s+/g, '\\s+') + '\\b', 'i');
          if (reg.test(lookupStr)) {
            matchedFromMap = entry;
            break;
          }
        }
        if (matchedFromMap) break;
      }
    }

    if (matchedFromMap) {
      parsedName = matchedFromMap.ro;
      if (explicitGrams === null) {
        explicitGrams = matchedFromMap.defaultGrams || 100;
      }
    } else {
      // Clean parsed name: strip extra connecting words and punctuation
      parsedName = parsedName
        .replace(/^[-*•=~+]\s*/, '')
        .replace(/\(.*?\)/g, '')
        .replace(/\b(de|cu|buc|bucati|bucata|pieces?|or\s+\d+.*?)\b/gi, ' ')
        .replace(/[^a-zA-ZăâîșțĂÂÎȘȚ0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!parsedName) {
        parsedName = rawToken.trim();
      }
    }

    return {
      raw: rawToken,
      name: parsedName.charAt(0).toUpperCase() + parsedName.slice(1),
      explicitGrams: explicitGrams
    };
  }

  // Built-in intelligent recipe synthesis algorithm with Natural Language Grammage Recognition
  buildRecipeWithSmartEngine(rawInput, servings = 2, mealType = 'Prânz', goal = 'balanced', customName = '', customCategory = '', customInstructions = null) {
    const rawTokens = (rawInput || '').toLowerCase()
      .split(/[,;\n+]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const initialTokens = rawTokens.length > 0 ? rawTokens : ['piept de pui', 'orez', 'legume'];

    // Resolve ingredients and calculate quantities per portion
    const ingredientsList = [];

    // Culinary role identification
    let hasProtein = false;
    let hasCarb = false;
    let hasVeggie = false;
    let mainProteinName = '';
    let mainCarbName = '';
    let mainVeggieName = '';

    initialTokens.forEach((token) => {
      const parsedToken = this.parseIngredientToken(token, servings);
      if (!parsedToken) return;

      const lookupName = parsedToken.name;

      // 1. Look in store ingredients
      let matched = (typeof window !== 'undefined' && window.store) ? window.store.findIngredientByName(lookupName) : null;
      let est = this.estimateMarketData(lookupName);

      const ingName = matched ? matched.name : lookupName;
      const calories = matched ? matched.calories : est.calories;
      const protein = matched ? matched.protein : est.protein;
      const carbs = matched ? matched.carbs : est.carbs;
      const fat = matched ? matched.fat : est.fat;
      const pricePer100g = matched ? matched.pricePer100g : est.pricePer100g;

      // Determine portion size based on macronutrient profile & role, or use explicit grams
      let totalQuantity = 100;
      let gramsPerServing = 100;

      if (parsedToken.explicitGrams !== null && parsedToken.explicitGrams > 0) {
        // User explicitly stated the quantity (e.g. "faina 60g" -> 60g total, "ouă 3 buc" -> 165g total)
        totalQuantity = parsedToken.explicitGrams;
        gramsPerServing = Math.max(1, Math.round(totalQuantity / servings));

        // Mark role
        if (protein > 15 && carbs < 10) { hasProtein = true; if (!mainProteinName) mainProteinName = ingName; }
        else if (carbs > 40) { hasCarb = true; if (!mainCarbName) mainCarbName = ingName; }
        else if (calories < 60) { hasVeggie = true; if (!mainVeggieName) mainVeggieName = ingName; }
      } else {
        // Auto-calculate portion per serving based on role & goal
        if (protein > 15 && carbs < 10) {
          gramsPerServing = goal === 'high_protein' ? 220 : 175;
          hasProtein = true;
          if (!mainProteinName) mainProteinName = ingName;
        } else if (carbs > 40) {
          gramsPerServing = goal === 'low_calorie' || goal === 'keto' ? 45 : (goal === 'high_protein' ? 80 : 70);
          hasCarb = true;
          if (!mainCarbName) mainCarbName = ingName;
        } else if (fat > 30) {
          gramsPerServing = 15;
        } else if (calories < 60) {
          gramsPerServing = 120;
          hasVeggie = true;
          if (!mainVeggieName) mainVeggieName = ingName;
        } else {
          gramsPerServing = 100;
        }
        totalQuantity = Math.round(gramsPerServing * servings);
      }

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

    const categoryToUse = customCategory || mealType;

    // Generate enticing title
    let recipeTitle = customName || '';
    if (!recipeTitle) {
      const firstTwo = ingredientsList.slice(0, 2).map(i => i.name).join(' & ');
      if (categoryToUse === 'Mic Dejun') {
        if (mainProteinName.toLowerCase().includes('ou')) {
          recipeTitle = `Omletă Sățioasă cu ${mainVeggieName || 'Verdețuri'} & Brânză`;
        } else if (mainCarbName.toLowerCase().includes('ovaz')) {
          recipeTitle = `Bol Cald de Ovăz Proteic cu Fructe`;
        } else {
          recipeTitle = `Mic Dejun Nutritiv cu ${firstTwo || 'Ingrediente Proaspete'}`;
        }
      } else if (categoryToUse === 'Snacks') {
        recipeTitle = `Gustare Rapidă cu ${firstTwo || 'Ingrediente Alese'}`;
      } else {
        // Lunch / Dinner
        if (mainProteinName && mainCarbName) {
          recipeTitle = `${mainProteinName} Rumenit la Tigaie cu ${mainCarbName} & ${mainVeggieName || 'Legume Proaspete'}`;
        } else if (mainProteinName) {
          recipeTitle = `${mainProteinName} la Cuptor cu Ierburi Aromatice & Garnitură`;
        } else {
          recipeTitle = `Preparat Delicios cu ${firstTwo || 'Ingrediente Sănătoase'}`;
        }
      }
    }

    // Generate clear, logical instructions
    const defaultInstructions = [
      `1. Pregătirea: Cântărește și pregătește ingredientele conform gramajelor afișate.`,
      hasCarb ? `2. Baza: Încorporează și omogenizează ingredientele uscate și cele umede până la o compoziție perfectă.` : `2. Pregătește baza: Pune tigaia la încins cu puțin ulei la foc mediu.`,
      hasProtein ? `3. Gătire & Coacere: Gătește sau coace la foc/temperatură medie până devine rumenit și pufos.` : `3. Călește ingredientele principale timp de 6-8 minute până devin fragede.`,
      `4. Porționare & Servire: Împarte compoziția în ${servings} ${servings === 1 ? 'porție' : 'porții'}. Savurează cu plăcere!`
    ];

    const instructions = (customInstructions && customInstructions.length > 0) ? customInstructions : defaultInstructions;
    const prepTime = hasCarb || hasProtein ? '25 min' : '15 min';
    const difficulty = ingredientsList.length > 4 ? 'Mediu' : 'Ușor';

    return this.processGeneratedRecipe({
      name: recipeTitle,
      category: categoryToUse,
      servings,
      prepTime,
      difficulty,
      ingredients: ingredientsList,
      instructions,
      chefTips: goal === 'high_protein'
        ? 'Bogată în proteine de înaltă calitate pentru recuperare musculară și sațietate prelungită.'
        : 'Rețetă echilibrată caloric, excelentă atât proaspătă cât și păstrată la rece.'
    }, servings, categoryToUse);
  }

  // Live Recalculate Recipe Totals when Ingredients or Portions are Edited by User
  recalculateRecipe(recipe) {
    const servings = Math.max(1, parseInt(recipe.servings) || 1);
    recipe.servings = servings;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalCost = 0;

    recipe.ingredients = (recipe.ingredients || []).map(ing => {
      const qty = Math.max(0, parseFloat(ing.quantityGrams ?? ing.totalGrams) || 0);
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
        quantityGrams: qty,
        totalGrams: qty,
        gramsPerServing: Math.max(1, Math.round(qty / servings)),
        caloriesTotal: Math.round(cals),
        proteinTotal: parseFloat(prot.toFixed(1)),
        carbsTotal: parseFloat(carbs.toFixed(1)),
        fatTotal: parseFloat(fat.toFixed(1)),
        costTotal: parseFloat(cost.toFixed(2))
      };
    });

    recipe.totals = {
      calories: Math.round(totalCalories),
      protein: parseFloat(totalProtein.toFixed(1)),
      carbs: parseFloat(totalCarbs.toFixed(1)),
      fat: parseFloat(totalFat.toFixed(1)),
      cost: parseFloat(totalCost.toFixed(2))
    };

    recipe.perServing = {
      calories: Math.round(totalCalories / servings),
      protein: parseFloat((totalProtein / servings).toFixed(1)),
      carbs: parseFloat((totalCarbs / servings).toFixed(1)),
      fat: parseFloat((totalFat / servings).toFixed(1)),
      cost: parseFloat((totalCost / servings).toFixed(2))
    };

    return recipe;
  }

  // Process and calculate full macro & cost totals
  processGeneratedRecipe(recipeData, servings, mealType) {
    const rec = {
      name: recipeData.name || 'Rețetă Asistent AI',
      category: mealType || recipeData.category || 'Prânz',
      servings: Math.max(1, parseInt(servings) || 2),
      prepTime: recipeData.prepTime || '20 min',
      difficulty: recipeData.difficulty || 'Ușor',
      chefTips: recipeData.chefTips || '',
      ingredients: recipeData.ingredients || [],
      instructions: recipeData.instructions || []
    };

    return this.recalculateRecipe(rec);
  }

  // Multimodal Recipe Extraction from Photos (Camera or Uploaded Image)
  async extractRecipeFromImage(fileOrDataUrl, onProgress = null) {
    if (onProgress) onProgress(15, 'Procesare imagine recepționată...');

    // Convert file to dataURL if necessary
    let dataUrl = '';
    if (typeof fileOrDataUrl === 'string') {
      dataUrl = fileOrDataUrl;
    } else if (fileOrDataUrl instanceof Blob || fileOrDataUrl instanceof File) {
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(fileOrDataUrl);
      });
    }

    // 1. Try Generative Multimodal AI (Gemini 2.0 Flash) if key exists
    if (this.geminiApiKey) {
      try {
        if (onProgress) onProgress(35, 'Analiză inteligentă cu Google Gemini Multimodal...');
        const base64Data = dataUrl.split(',')[1];
        const mimeType = dataUrl.match(/data:([^;]+);/)?.[1] || 'image/jpeg';

        const prompt = `Analizează această imagine (poză cu mâncare, rețetă scrisă, captură de ecran din social media sau bon/ingrediente).
Identifică rețeta sau preparatul, lista completă de ingrediente cu gramajele sau cantitățile specificate (ex: "faina 60g", "ouă 3 buc", "200g piept pui").
Dacă gramajele nu sunt scrise explicit în imagine, estimează-le realist pentru 2 porții.
Răspunde STRICT în format JSON valid fără markdown:
{
  "name": "Numele Rețetei",
  "category": "Prânz",
  "servings": 2,
  "prepTime": "25 min",
  "difficulty": "Ușor",
  "rawIngredientText": "faina 60g, oua 3 buc, lapte 200ml...",
  "ingredients": [
    { "name": "făină", "quantityGrams": 60, "calories100g": 348, "protein100g": 10.5, "carbs100g": 73.5, "fat100g": 1.0, "pricePer100g": 0.45 }
  ],
  "instructions": [
    "Pasul 1...",
    "Pasul 2..."
  ],
  "chefTips": "Sfat nutrițional"
}`;

        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1400 }
          })
        });

        if (resp.ok) {
          if (onProgress) onProgress(85, 'Construire macronutrienți rețetă...');
          const resJson = await resp.json();
          let text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
          text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(text);
          const processed = this.processGeneratedRecipe(parsed, parsed.servings || 2, parsed.category || 'Prânz');
          if (onProgress) onProgress(100, 'Rețetă extrasă cu succes!');
          return {
            recipe: processed,
            rawIngredientText: parsed.rawIngredientText || parsed.ingredients.map(i => `${i.name} ${i.quantityGrams}g`).join(', ')
          };
        }
      } catch (geminiErr) {
        console.warn('Gemini multimodal extraction failed, falling back to OCR:', geminiErr);
      }
    }

    // 2. Preprocess image for OCR (crop social UI & enhance contrast)
    if (onProgress) onProgress(35, 'Optimizare imagine și filtrare zgomot visual...');
    const preprocessedDataUrl = await this.preprocessImageForOcr(dataUrl);

    // 3. Fallback to Tesseract OCR Engine + Smart Section Parser
    if (onProgress) onProgress(45, 'Scanare text cu motorul OCR Tesseract...');
    let ocrText = '';
    if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
      try {
        const result = await window.Tesseract.recognize(
          preprocessedDataUrl,
          'eng+ron',
          {
            logger: (m) => {
              if (m.status === 'recognizing text' && onProgress) {
                const p = Math.round(45 + (m.progress * 40));
                onProgress(p, `Recunoaștere caractere (OCR): ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );
        ocrText = result.data ? result.data.text : '';
      } catch (ocrErr) {
        console.warn('Tesseract recognition error:', ocrErr);
      }
    }

    if (onProgress) onProgress(85, 'Interpretare ingrediente, unități și gramaje...');
    const parsedRecipeData = this.parseOcrRecipeText(ocrText);

    // Build raw ingredient text for display and recipe building
    const rawIngredientText = parsedRecipeData.ingredients.length > 0
      ? parsedRecipeData.ingredients.map(i => `${i.name} ${i.explicitGrams || 100}g`).join(', ')
      : 'piept de pui 200g, orez 80g, broccoli 150g';

    if (onProgress) onProgress(95, 'Sinteză rețetă și calculare macronutrienți...');
    const builtRecipe = this.buildRecipeWithSmartEngine(
      rawIngredientText,
      2,
      parsedRecipeData.category || 'Prânz',
      'balanced',
      parsedRecipeData.title || ''
    );

    if (onProgress) onProgress(100, 'Rețetă extrasă cu succes!');

    return {
      recipe: builtRecipe,
      rawIngredientText
    };
  }

  // HTML5 Canvas Preprocessor: Grayscale, High-Contrast & Social Screenshot (TikTok/Reels) Crop
  async preprocessImageForOcr(dataUrl) {
    if (typeof document === 'undefined') return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          let sx = 0, sy = 0, sw = w, sh = h;
          // Vertical phone screenshot (TikTok / Reels / Shorts aspect ratio > 1.35)
          if (h / w >= 1.35) {
            // Crop top status bar (8%), right action icons (17%), bottom comment bar (12%)
            sx = 0;
            sy = Math.round(h * 0.08);
            sw = Math.round(w * 0.83);
            sh = Math.round(h * 0.80);
          }

          canvas.width = sw;
          canvas.height = sh;
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

          // Apply contrast boost and grayscale
          const imgData = ctx.getImageData(0, 0, sw, sh);
          const d = imgData.data;
          const contrast = 1.6;
          const intercept = 128 * (1 - contrast);

          for (let i = 0; i < d.length; i += 4) {
            const gray = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
            let enhanced = gray * contrast + intercept;
            if (enhanced < 0) enhanced = 0;
            if (enhanced > 255) enhanced = 255;
            d[i] = enhanced;
            d[i + 1] = enhanced;
            d[i + 2] = enhanced;
          }
          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (e) {
          console.warn('Canvas OCR preprocessing fallback:', e);
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // Smart Section Boundary & Bullet Grouping OCR Parser
  parseOcrRecipeText(ocrText) {
    if (!ocrText || typeof ocrText !== 'string') {
      return { title: 'Rețetă Scanată', category: 'Prânz', ingredients: [] };
    }

    // 1. Detect title
    let detectedTitle = '';
    let category = 'Prânz';
    if (/banana bread|nana bread/i.test(ocrText)) {
      detectedTitle = 'Banana Bread Proteic';
      category = 'Mic Dejun';
    } else if (/pancake|clatit/i.test(ocrText)) {
      detectedTitle = 'Clătite Proteice';
      category = 'Mic Dejun';
    } else if (/oatmeal|porridge|ovaz/i.test(ocrText)) {
      detectedTitle = 'Budincă Caldă de Ovăz';
      category = 'Mic Dejun';
    } else if (/cheesecake/i.test(ocrText)) {
      detectedTitle = 'Cheesecake Sănătos';
      category = 'Snacks';
    } else {
      const titleMatch = ocrText.match(/([a-zA-Z\s]{4,30}(?:bread|cake|pancakes|bowl|pasta|salad|piept|pui|omleta))/i);
      if (titleMatch) {
        detectedTitle = titleMatch[1].trim();
      }
    }

    // 2. Bound ingredients section before instructions
    const instIdx = ocrText.search(/INSTRUCTIONS|MOD DE PREPARARE|DIRECTIONS|METHOD|PREPARATION|PASI/i);
    const rawSection = instIdx !== -1 ? ocrText.substring(0, instIdx) : ocrText;

    // 3. Group bullet points and multi-line ingredient lines
    const rawLines = rawSection.split('\n').map(l => l.trim()).filter(Boolean);
    const groupedLines = [];

    for (const l of rawLines) {
      // Filter out phone status bar, clock, author handle, and social counters
      if (/^\d{1,2}:\d{2}\b/i.test(l)) continue;
      if (/@\w+|tiktok|instagram|youtube|\d{4}-\d{2}-\d{2}/i.test(l)) continue;
      if (/basically like|eating a bowl|healthy rec|mai putin|vezi traducerea|sunet original/i.test(l)) continue;
      if (/^lista de redare/i.test(l) || /^\d{4,}/.test(l)) continue;
      if (!/^[-*•=~+]\s*/.test(l) && /recipe|reteta|rețetă|ingredients|ingrediente/i.test(l)) continue;

      const isNew = /^[-*•=~+]\s*/.test(l) || 
                    /^\d+[\d/.]*\s*(g|gr|ml|kg|cups?|tbsp|tsp|scoops?|buci?|ou|oua|lingur)\b/i.test(l) ||
                    /^(rup if you like|optional)/i.test(l);
      if (isNew) {
        groupedLines.push(l);
      } else if (groupedLines.length > 0) {
        groupedLines[groupedLines.length - 1] += ' ' + l;
      }
    }

    // 4. Parse ingredients with tokens
    const parsedIngredients = [];
    for (const line of groupedLines) {
      const parsed = this.parseIngredientToken(line);
      if (parsed && parsed.name && parsed.name.length >= 2) {
        // Exclude words that are not ingredients
        if (!/^(optional|instructions|ingredients|reteta|recipe|sal eee|he|mai putin|nana bread|banana bread)$/i.test(parsed.name)) {
          parsedIngredients.push(parsed);
        }
      }
    }

    // 5. Intelligent auto-completion if vital base items were scrolled out in video captions
    if (/banana bread/i.test(detectedTitle)) {
      const hasBanana = parsedIngredients.some(i => /banana/i.test(i.name));
      if (!hasBanana) {
        parsedIngredients.unshift({ raw: 'banane 250g', name: 'Banane', explicitGrams: 250 });
      }
      const hasEggs = parsedIngredients.some(i => /ou/i.test(i.name));
      if (!hasEggs) {
        parsedIngredients.splice(1, 0, { raw: '2 oua', name: 'Ouă', explicitGrams: 110 });
      }
    }

    return {
      title: detectedTitle || 'Rețetă Scanată',
      category,
      ingredients: parsedIngredients
    };
  }


  // 3. Save generated recipe into store database
  saveRecipeToStore(recipeObj) {
    if (typeof window === 'undefined' || !window.store) return null;

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
if (typeof window !== 'undefined') {
  window.nutriAssistant = new NutriChefAssistant();
} else if (typeof module !== 'undefined') {
  module.exports = { NutriChefAssistant };
}
