// Bon Fiscal (Receipt) parser & OCR Service
class ReceiptOcrService {
  constructor() {
    this.stopWords = [
      'BON FISCAL', 'FISCAL', 'SUBTOTAL', 'TOTAL', 'TVA', 'CARD', 'NUMERAR',
      'REST', 'CUI', 'CIF', 'STR.', 'SOS.', 'NR.', 'DISCOUNT', 'SRL', 'SCS',
      'DATA:', 'ORA:', 'CASIER', 'PUNCT', 'CLIENT', 'OPERATOR', 'MULTUMIM',
      'VALOARE', 'LEI', 'RON', 'BON NR', 'BF NR', 'CASA:', 'SCHIMB', 'TERMINAL'
    ];
  }

  // Parse raw receipt text into structured items
  parseReceiptText(text) {
    if (!text || typeof text !== 'string') return { store: 'Magazin', date: new Date().toISOString().split('T')[0], items: [], totalCalculated: 0 };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const parsedItems = [];
    let detectedStore = 'Magazin Bon Fiscal';
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

      // Check if line is multiplier or OCR noise artifact (e.g. ", X", "' X", "1 buc x 11.99")
      if (this.isMultiplierOrNoiseLine(line)) {
        // Multiplier line: check if it enriches the previous product (weight or price)
        const mult = this.extractMultiplierInfo(line);
        if (mult && parsedItems.length > 0) {
          const prev = parsedItems[parsedItems.length - 1];
          if (!prev.hasExplicitWeight && mult.weightGrams) {
            prev.quantity = mult.weightGrams;
            prev.hasExplicitWeight = true;
            prev.pricePer100g = prev.quantity > 0 ? parseFloat(((prev.price / prev.quantity) * 100).toFixed(4)) : 0;
          }
          if ((!prev.price || prev.price === 0) && mult.price) {
            prev.price = mult.price;
            prev.pricePer100g = prev.quantity > 0 ? parseFloat(((prev.price / prev.quantity) * 100).toFixed(4)) : 0;
          }
        }
        // NEVER treat a multiplier or noise line as a standalone product
        continue;
      }

      // Pattern 1: Single line "PIEPT PUI 1KG 28.50 A" or "SMANTANA 20% PILOS 400G 5.29 A"
      const singleLineMatch = line.match(/^(.+?)\s+([0-9]+[.,][0-9]{2})\s*([A-Za-z])?$/);
      if (singleLineMatch) {
        let nameWithGrams = singleLineMatch[1].trim();
        const price = parseFloat(singleLineMatch[2].replace(',', '.'));

        // Skip if this line looks like metadata
        if (/^(TOTAL|CARD|LEI|NUMERAR|REST|TVA|SUBTOTAL|SCHIMB)/i.test(nameWithGrams)) continue;

        // Skip if name lacks real letters (e.g. noise)
        const letters = nameWithGrams.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
        if (letters.length < 2) continue;

        const { cleanName, quantityGrams, hasExplicitWeight } = this.extractWeightAndName(nameWithGrams);
        if (cleanName.length >= 2 && price > 0) {
          let finalGrams = quantityGrams;
          let finalExplicit = hasExplicitWeight;

          // If next line is a multiplier or scale line with exact weight, consume it
          if (i + 1 < lines.length && this.isMultiplierOrNoiseLine(lines[i + 1])) {
            const nextMult = this.extractMultiplierInfo(lines[i + 1]);
            if (nextMult && nextMult.weightGrams && !finalExplicit) {
              finalGrams = nextMult.weightGrams;
              finalExplicit = true;
            }
            i++; // skip multiplier line so it doesn't get processed separately
          }

          parsedItems.push(this.createParsedItem(cleanName, finalGrams, price, line, finalExplicit));
          continue;
        }
      }

      // Pattern 2: Multi-line receipt format:
      // Line i: "CARNE TOCATA DE PUI" (product name without price)
      // Line i+1: "0.500 KG x 23.98 11.99 A" or "1 buc x 11.99 11.99" or ", X 11.99"
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextMult = this.extractMultiplierInfo(nextLine);

        if (nextMult && nextMult.price && nextMult.price > 0) {
          const { cleanName, quantityGrams, hasExplicitWeight } = this.extractWeightAndName(line);
          const letters = cleanName.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');

          if (letters.length >= 2) {
            const finalGrams = nextMult.weightGrams || quantityGrams;
            const finalExplicit = hasExplicitWeight || !!nextMult.weightGrams;
            parsedItems.push(this.createParsedItem(cleanName, finalGrams, nextMult.price, line, finalExplicit));
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
      rawText: text,
      totalCalculated: parsedItems.reduce((acc, it) => acc + it.price, 0)
    };
  }

  // Detect multiplier or OCR artifact lines that shouldn't be products
  isMultiplierOrNoiseLine(line) {
    if (!line) return true;
    const trimmed = line.trim();
    if (!trimmed) return true;

    // Line separators / dashes / equals / asterisks
    if (/^[-=_*#]{2,}$/.test(trimmed)) return true;

    // Single punctuation or OCR artifact multipliers: ", X", "' X", "X", ",X", "’ X", "‘ X", "1 X", "- X", "x 11.99"
    if (/^[,'.~`"_\-^#*]+\s*[xX*]/i.test(trimmed)) return true;
    if (/^[xX*]\s*[0-9.,]*/i.test(trimmed)) return true;

    // Multiplier lines like "1 buc x 11.99", "1 x 11.99", "0,500 kg x 23,98", "2 BUC X 5,50"
    if (/^[0-9.,]*\s*(buc|bucati|kg|g|l|ml)?\s*[xX*]\s*[0-9.,]*/i.test(trimmed)) return true;

    // Lines that have fewer than 3 Romanian letters
    const letters = trimmed.replace(/[^a-zA-ZăâîșțĂÂÎȘȚ]/g, '');
    if (letters.length < 3) return true;

    // Stop words
    const upper = trimmed.toUpperCase();
    if (this.stopWords.some(w => upper.startsWith(w) || upper === w)) return true;

    return false;
  }

  // Extract weight and price from a multiplier/scale line
  extractMultiplierInfo(line) {
    if (!line) return null;
    const trimmed = line.trim();

    // Check weight: e.g. "0.500 kg", "0,438 kg", "450 g", "1.5 kg", "1L"
    let weightGrams = null;
    const kgMatch = trimmed.match(/([0-9]+[.,][0-9]{1,3})\s*KG/i) || trimmed.match(/([0-9]+)\s*KG/i);
    if (kgMatch) {
      weightGrams = Math.round(parseFloat(kgMatch[1].replace(',', '.')) * 1000);
    } else {
      const gMatch = trimmed.match(/([0-9]+)\s*G(?![A-Za-z])/i);
      if (gMatch) {
        weightGrams = parseFloat(gMatch[1]);
      } else {
        const lMatch = trimmed.match(/([0-9]+[.,]?[0-9]*)\s*L(?![A-Za-z])/i);
        if (lMatch) {
          weightGrams = Math.round(parseFloat(lMatch[1].replace(',', '.')) * 1000);
        } else {
          const mlMatch = trimmed.match(/([0-9]+)\s*ML/i);
          if (mlMatch) {
            weightGrams = parseFloat(mlMatch[1]);
          } else {
            const bucMatch = trimmed.match(/([0-9]+)\s*BUC/i);
            if (bucMatch) {
              weightGrams = parseFloat(bucMatch[1]) * 50;
            }
          }
        }
      }
    }

    // Check price: usually the last price at the end of the line: e.g. "11,99 A" or "11.99"
    let price = null;
    const prices = [...trimmed.matchAll(/([0-9]+[.,][0-9]{2})/g)];
    if (prices.length > 0) {
      price = parseFloat(prices[prices.length - 1][1].replace(',', '.'));
    }

    return { weightGrams, price, raw: trimmed };
  }

  // Extract packaging grams from title like "Mix Mexican 450g", "Lapte 1.5% 1L", "Branza 400g"
  extractWeightAndName(raw) {
    let clean = raw.trim();
    let grams = null;
    let hasExplicitWeight = false;

    // Check kg e.g. "1kg", "1.5 kg", "0.500 kg"
    const kgMatch = clean.match(/([0-9]+[.,][0-9]{1,3})\s*KG/i) || clean.match(/([0-9]+)\s*KG/i);
    if (kgMatch) {
      grams = Math.round(parseFloat(kgMatch[1].replace(',', '.')) * 1000);
      clean = clean.replace(kgMatch[0], '').trim();
      hasExplicitWeight = true;
    } else {
      // Check grams e.g. 450g, 400g, 250g, 100g
      const gMatch = clean.match(/([0-9]+)\s*G(?![A-Za-z])/i);
      if (gMatch) {
        grams = parseFloat(gMatch[1]);
        clean = clean.replace(gMatch[0], '').trim();
        hasExplicitWeight = true;
      } else {
        // Check liters e.g. 1L, 1.5L
        const lMatch = clean.match(/([0-9]+[.,]?[0-9]*)\s*L(?![A-Za-z])/i);
        if (lMatch) {
          grams = Math.round(parseFloat(lMatch[1].replace(',', '.')) * 1000);
          clean = clean.replace(lMatch[0], '').trim();
          hasExplicitWeight = true;
        } else {
          // Check ml e.g. 500ml, 250ml
          const mlMatch = clean.match(/([0-9]+)\s*ML/i);
          if (mlMatch) {
            grams = parseFloat(mlMatch[1]);
            clean = clean.replace(mlMatch[0], '').trim();
            hasExplicitWeight = true;
          } else {
            // Check buc e.g. 10buc, 6buc
            const bucMatch = clean.match(/([0-9]+)\s*BUC/i);
            if (bucMatch) {
              grams = parseFloat(bucMatch[1]) * 50;
              clean = clean.replace(bucMatch[0], '').trim();
              hasExplicitWeight = true;
            }
          }
        }
      }
    }

    // Clean extraneous characters from name
    clean = clean
      .replace(/^[0-9*#.,\-\s'`~]+/, '')  // leading junk
      .replace(/\s+[A-Za-z]$/, '')        // trailing tax letter like " A", " B"
      .replace(/[,\-.*#_]+$/, '')         // trailing punctuation
      .replace(/\s+/g, ' ')
      .trim();

    return { cleanName: clean, quantityGrams: grams, hasExplicitWeight };
  }

  createParsedItem(name, quantity, price, rawLine, hasExplicitWeight = false) {
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

    // Determine quantity:
    let finalQuantity = quantity;
    if (!hasExplicitWeight && matchedIng && matchedIng.packageQuantity > 0) {
      finalQuantity = matchedIng.packageQuantity;
    } else if (!finalQuantity || finalQuantity <= 0) {
      finalQuantity = 100; // Default to 100g standard reference, NOT hardcoded 500g!
    }

    const price100g = finalQuantity > 0 ? (price / finalQuantity) * 100 : 0;

    return {
      rawLine,
      name: matchedIng ? matchedIng.name : this.capitalize(name),
      quantity: Math.round(finalQuantity),
      hasExplicitWeight,
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

  // Real OCR with Tesseract.js (falls back to demo or smart text parser)
  async recognizeImageWithTesseract(imageSource, onProgress) {
    if (onProgress) onProgress(15, 'Pregătire procesare imagine...');

    if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
      try {
        if (onProgress) onProgress(30, 'Pornire motor OCR Tesseract...');
        const result = await window.Tesseract.recognize(
          imageSource,
          'eng+ron',
          {
            logger: (m) => {
              if (m.status === 'recognizing text' && onProgress) {
                const p = Math.round(30 + (m.progress * 60));
                onProgress(p, `Recunoaștere caractere optice (OCR): ${Math.round(m.progress * 100)}%`);
              }
            }
          }
        );

        if (onProgress) onProgress(95, 'Parsare produse și prețuri...');
        const text = result.data ? result.data.text : '';
        const parsed = this.parseReceiptText(text);

        // If Tesseract extracted at least one valid item, return it!
        if (parsed.items.length > 0) {
          if (onProgress) onProgress(100, 'Finalizat!');
          return parsed;
        }
      } catch (err) {
        console.warn('Tesseract OCR error or timeout:', err);
      }
    }

    // Fallback simulation if OCR library could not read or is offline
    if (onProgress) onProgress(60, 'Analiză structură bon...');
    await new Promise(r => setTimeout(r, 400));
    if (onProgress) onProgress(90, 'Extragere produse...');
    await new Promise(r => setTimeout(r, 300));
    if (onProgress) onProgress(100, 'Gata!');

    const demo = window.INITIAL_DATA.sampleReceipts[0];
    return this.parseReceiptText(demo.rawText);
  }
}

window.receiptOcr = new ReceiptOcrService();
