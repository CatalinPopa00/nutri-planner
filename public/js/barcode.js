// Barcode & EAN scanning + Open Food Facts API client
class BarcodeScannerService {
  constructor() {
    this.videoStream = null;
    this.isScanning = false;
    this.hasBarcodeDetector = 'BarcodeDetector' in window;
    this.detector = null;
    if (this.hasBarcodeDetector) {
      try {
        this.detector = new window.BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']
        });
      } catch (e) {
        console.warn('BarcodeDetector format init error:', e);
      }
    }
  }

  async startCamera(videoElement, onDetected) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported on this device/browser.');
    }

    try {
      this.videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      videoElement.srcObject = this.videoStream;
      await videoElement.play();
      this.isScanning = true;

      this.runDetectionLoop(videoElement, onDetected);
      return true;
    } catch (err) {
      console.error('Error opening camera stream:', err);
      throw err;
    }
  }

  stopCamera() {
    this.isScanning = false;
    if (this.videoStream) {
      this.videoStream.getTracks().forEach(track => track.stop());
      this.videoStream = null;
    }
  }

  async runDetectionLoop(videoElement, onDetected) {
    if (!this.isScanning) return;

    if (this.hasBarcodeDetector && this.detector && videoElement.readyState >= 2) {
      try {
        const barcodes = await this.detector.detect(videoElement);
        if (barcodes && barcodes.length > 0) {
          const rawValue = barcodes[0].rawValue;
          if (rawValue) {
            this.stopCamera();
            onDetected(rawValue);
            return;
          }
        }
      } catch (err) {
        // detection frame error
      }
    }

    if (this.isScanning) {
      requestAnimationFrame(() => this.runDetectionLoop(videoElement, onDetected));
    }
  }

  async lookupEan(ean) {
    const cleanEan = String(ean).trim().replace(/[^0-9]/g, '');
    if (!cleanEan) {
      throw new Error('Codul de bare este invalid.');
    }

    // 1. Check local DB first
    const existing = (window.store ? window.store.data.ingredients : []).find(i => i.ean === cleanEan);
    if (existing) {
      return {
        source: 'local_db',
        isExisting: true,
        ingredient: existing,
        data: {
          ean: cleanEan,
          name: existing.name,
          category: existing.category,
          packageQuantity: existing.packageQuantity,
          packagePrice: existing.packagePrice,
          calories: existing.calories,
          protein: existing.protein,
          carbs: existing.carbs,
          fat: existing.fat
        }
      };
    }

    // 2. Check sample catalog
    const sample = (window.INITIAL_DATA?.sampleBarcodes || []).find(s => s.ean === cleanEan);
    if (sample) {
      return {
        source: 'sample_db',
        isExisting: false,
        data: {
          ean: cleanEan,
          name: sample.name,
          category: sample.category,
          packageQuantity: sample.packageQuantity,
          packagePrice: sample.packagePrice || '',
          calories: sample.calories,
          protein: sample.protein,
          carbs: sample.carbs,
          fat: sample.fat,
          brand: sample.brand || ''
        }
      };
    }

    // 3. Query Open Food Facts API
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${cleanEan}.json?fields=product_name,product_name_ro,brands,quantity,nutriments,image_url,categories_tags`;
      const resp = await fetch(url);
      if (resp.ok) {
        const json = await resp.json();
        if (json.status === 1 && json.product) {
          const p = json.product;
          const nut = p.nutriments || {};

          // Parse quantity grams
          let qtyGrams = 100;
          if (p.quantity) {
            const matchG = p.quantity.match(/([0-9.,]+)\s*(g|gr|gram|ml|l|kg)/i);
            if (matchG) {
              const val = parseFloat(matchG[1].replace(',', '.'));
              const unit = matchG[2].toLowerCase();
              if (unit === 'kg' || unit === 'l') {
                qtyGrams = val * 1000;
              } else {
                qtyGrams = val;
              }
            }
          }

          // Guess category
          let category = 'Ingrediente';
          const cats = (p.categories_tags || []).join(' ').toLowerCase();
          const pName = (p.product_name_ro || p.product_name || '').toLowerCase();
          if (cats.includes('dairy') || cats.includes('milk') || cats.includes('cheese') || pName.includes('lapte') || pName.includes('iaurt') || pName.includes('branza') || pName.includes('ou')) {
            category = 'Ouă & Lactate';
          } else if (cats.includes('meat') || cats.includes('fish') || pName.includes('pui') || pName.includes('porc') || pName.includes('vita') || pName.includes('somon') || pName.includes('ton')) {
            category = 'Carne & Pește';
          } else if (cats.includes('cereal') || cats.includes('pasta') || pName.includes('orez') || pName.includes('paste') || pName.includes('ovaz') || pName.includes('paine')) {
            category = 'Cereale & Paste';
          } else if (cats.includes('vegetable') || cats.includes('fruit') || pName.includes('mar') || pName.includes('banana') || pName.includes('cartof') || pName.includes('rosii')) {
            category = 'Legume & Fructe';
          } else if (cats.includes('oil') || cats.includes('fat') || pName.includes('ulei') || pName.includes('unt')) {
            category = 'Grăsimi & Uleiuri';
          } else if (cats.includes('sweet') || cats.includes('chocolate') || pName.includes('ciocolata') || pName.includes('biscuit')) {
            category = 'Dulciuri';
          }

          const calories = Math.round(nut['energy-kcal_100g'] || (nut.energy_100g ? nut.energy_100g / 4.184 : 0));
          const protein = parseFloat(Number(nut.proteins_100g || 0).toFixed(1));
          const carbs = parseFloat(Number(nut.carbohydrates_100g || 0).toFixed(1));
          const fat = parseFloat(Number(nut.fat_100g || 0).toFixed(1));
          const prodTitle = p.product_name_ro || p.product_name || (p.brands ? p.brands + ' Produs' : `Produs EAN ${cleanEan}`);

          return {
            source: 'open_food_facts',
            isExisting: false,
            data: {
              ean: cleanEan,
              name: prodTitle,
              category,
              packageQuantity: qtyGrams,
              packagePrice: '',
              calories,
              protein,
              carbs,
              fat,
              imageUrl: p.image_url || null,
              brand: p.brands || ''
            }
          };
        }
      }
    } catch (err) {
      console.warn('Open Food Facts API error:', err);
    }

    // Default template if not found online
    return {
      source: 'unknown',
      isExisting: false,
      data: {
        ean: cleanEan,
        name: `Produs nou (${cleanEan})`,
        category: 'Ingrediente',
        packageQuantity: 500,
        packagePrice: '',
        calories: 100,
        protein: 5,
        carbs: 10,
        fat: 2
      }
    };
  }
}

window.barcodeScanner = new BarcodeScannerService();
