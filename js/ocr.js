// Bon Fiscal (Receipt) parser & OCR Service
class ReceiptOcrService {
  constructor() {
    this.stopWords = [
      'BON FISCAL', 'FISCAL', 'SUBTOTAL', 'TOTAL', 'TVA', 'CARD', 'NUMERAR',
      'REST', 'CUI', 'CIF', 'STR.', 'SOS.', 'NR.', 'DISCOUNT', 'SRL', 'SCS',
      'DATA:', 'ORA:', 'CASIER', 'PUNCT', 'CLIENT', 'OPERATOR', 'MULTUMIM',
      'VALOARE', 'LEI', 'RON', 'BON NR', 'BF NR'
    ];
  }

  // Parse raw receipt text into structured items
  parseReceiptText(text) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedItems = [];
    let detectedStore = 'Magazin necunoscut';
    let detectedDate = new Date().toISOString().split('T')[0];

    // Detect store
    const upperText = text.toUpperCase();
    if (upperText.includes('LIDL')) detectedStore = 'Lidl România';
    else if (upperText.includes('KAUFLAND')) detectedStore = 'Kaufland România';
    else if (upperText.includes('CARREFOUR')) detectedStore = 'Carrefour';
    else if (upperText.includes('MEGA IMAGE')) detectedStore = 'Mega Image';
    else if (upperText.includes('PENNY')) detectedStore = 'Penny Market';
    else if (upperText.includes('PROFI')) detectedStore = 'Profi';
    else if (upperText.includes('AUCHAN')) detectedStore = 'Auchan';

    // Detect date
    const dateMatch = text.match(/(\d{2})[-/.](\d{2})[-/.](\d{2,4})/);
    if (dateMatch) {
      const year = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
      detectedDate = `${year}-${dateMatch[2]}-${dateMatch[1]}`;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Check if line is a metadata/header/footer line
      const isStopLine = this.stopWords.some(w => upperLine.startsWith(w) || upperLine === w);
      if (isStopLine) continue;
      if (/^[-=_*]{3,}$/.test(line)) continue;
      if (/^TOTAL/i.test(line)) continue;

      // Pattern 1: Single line "PIEPT PUI 1KG 28.50 A" or "CARTOFI ALBI 4.00"
      // Regex looks for price at the end, optional tax letter (A, B, C)
      const singleLineMatch = line.match(/^(.+?)\s+([0-9]+[.,][0-9]{2})\s*([A-Za-z])?$/);
      if (singleLineMatch) {
        let nameWithGrams = singleLineMatch[1].trim();
        const price = parseFloat(singleLineMatch[2].replace(',', '.'));

        // Skip if this line looks like "TOTAL LEI 74.46" or "CARD 74.46"
        if (/^(TOTAL|CARD|LEI|NUMERAR|REST|TVA|SUBTOTAL)/i.test(nameWithGrams)) continue;

        const { cleanName, quantityGrams } = this.extractWeightAndName(nameWithGrams);
        if (cleanName.length >= 2 && price > 0) {
          parsedItems.push(this.createParsedItem(cleanName, quantityGrams, price, line));
          continue;
        }
      }

      // Pattern 2: Multi-line receipt format:
      // Line i: "PIEPT PUI DEZOSAT"
      // Line i+1: "1.000 KG x 28.50 28.50 A" or "1 BUC x 12.00"
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const multiMatch = nextLine.match(/([0-9.,]+)\s*(KG|G|BUC|L|ML)?\s*[xX*]\s*([0-9.,]+)\s+([0-9.,]+)/i);
        if (multiMatch) {
          const qty = parseFloat(multiMatch[1].replace(',', '.'));
          const unit = (multiMatch[2] || 'g').toUpperCase();
          const unitPrice = parseFloat(multiMatch[3].replace(',', '.'));
          const totalPrice = parseFloat(multiMatch[4].replace(',', '.'));

          let grams = 100;
          if (unit === 'KG' || unit === 'L') grams = qty * 1000;
          else if (unit === 'G' || unit === 'ML') grams = qty;
          else grams = 100;

          const { cleanName } = this.extractWeightAndName(line);
          if (cleanName.length >= 2) {
            parsedItems.push(this.createParsedItem(cleanName, grams, totalPrice || unitPrice, line));
            i++; // skip nextLine
            continue;
          }
        }
      }
    }

    return {
      store: detectedStore,
      date: detectedDate,
      items: parsedItems,
      totalCalculated: parsedItems.reduce((acc, it) => acc + it.price, 0)
    };
  }

  // Extract packaging grams from title like "Mix Mexican 450g" or "Lapte 1L"
  extractWeightAndName(raw) {
    let clean = raw.trim();
    let grams = 500; // default assumption if not specified

    // Check 1kg or 1.5kg
    const kgMatch = clean.match(/([0-9.,]+)\s*KG/i);
    if (kgMatch) {
      grams = parseFloat(kgMatch[1].replace(',', '.')) * 1000;
      clean = clean.replace(kgMatch[0], '').trim();
    } else {
      // Check grams e.g. 450g, 400g, 250g
      const gMatch = clean.match(/([0-9]+)\s*G(?![A-Za-z])/i);
      if (gMatch) {
        grams = parseFloat(gMatch[1]);
        clean = clean.replace(gMatch[0], '').trim();
      } else {
        // Check liters e.g. 1L
        const lMatch = clean.match(/([0-9.,]+)\s*L(?![A-Za-z])/i);
        if (lMatch) {
          grams = parseFloat(lMatch[1].replace(',', '.')) * 1000;
          clean = clean.replace(lMatch[0], '').trim();
        } else {
          // Check buc e.g. 10buc
          const bucMatch = clean.match(/([0-9]+)\s*BUC/i);
          if (bucMatch) {
            grams = parseFloat(bucMatch[1]) * 50; // estimate 50g per unit e.g. eggs
            clean = clean.replace(bucMatch[0], '').trim();
          }
        }
      }
    }

    // Clean extraneous characters
    clean = clean.replace(/^[0-9*#.\-\s]+/, '').replace(/\s+/g, ' ').trim();

    return { cleanName: clean, quantityGrams: grams };
  }

  createParsedItem(name, quantity, price, rawLine) {
    // Fuzzy match with database ingredients
    let matchedIng = null;
    let confidence = 0;

    if (window.store) {
      const dbIngs = window.store.data.ingredients;
      const lowerName = name.toLowerCase();

      // 1. Exact or contains match
      for (const ing of dbIngs) {
        const dbLower = ing.name.toLowerCase();
        if (dbLower === lowerName) {
          matchedIng = ing;
          confidence = 1.0;
          break;
        }
        if (dbLower.includes(lowerName) || lowerName.includes(dbLower)) {
          matchedIng = ing;
          confidence = 0.85;
          break;
        }

        // Word overlap
        const nameWords = lowerName.split(' ').filter(w => w.length > 2);
        const dbWords = dbLower.split(' ').filter(w => w.length > 2);
        const common = nameWords.filter(w => dbWords.includes(w));
        if (common.length >= 2 && common.length / Math.max(nameWords.length, dbWords.length) > 0.5) {
          matchedIng = ing;
          confidence = 0.75;
          break;
        }
      }
    }

    const price100g = quantity > 0 ? (price / quantity) * 100 : 0;

    return {
      rawLine,
      name: matchedIng ? matchedIng.name : this.capitalize(name),
      quantity,
      price,
      pricePer100g: parseFloat(price100g.toFixed(4)),
      isMatched: !!matchedIng,
      matchedIngredientId: matchedIng ? matchedIng.id : null,
      matchedIngredient: matchedIng,
      confidence,
      updatePriceChecked: !!matchedIng,
      isNew: !matchedIng
    };
  }

  capitalize(str) {
    return str.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());
  }

  // Simulate reading an image and extracting receipt lines
  async processReceiptImage(file, onProgress) {
    if (onProgress) onProgress(20, 'Încărcare imagine bon fiscal...');
    await new Promise(r => setTimeout(r, 400));

    if (onProgress) onProgress(50, 'Detectare text și contrast...');
    await new Promise(r => setTimeout(r, 400));

    if (onProgress) onProgress(80, 'Extragere produse, gramaj și prețuri...');
    await new Promise(r => setTimeout(r, 300));

    // Return parsed items from Lidl demo or intelligent text
    const demo = window.INITIAL_DATA.sampleReceipts[0];
    const result = this.parseReceiptText(demo.rawText);

    if (onProgress) onProgress(100, 'Procesare finalizată!');
    return result;
  }
}

window.receiptOcr = new ReceiptOcrService();
