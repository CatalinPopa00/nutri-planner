// Cloud Sync & Authentication Module with Firebase / Google Cloud Firestore
class NutriCloudSync {
  constructor(store) {
    this.store = store;
    this.auth = null;
    this.db = null;
    this.user = null;
    this.isSyncing = false;
    this.lastSyncedAt = null;
    this.unsubscribeSnapshot = null;
    this.statusListeners = [];
    this.authListeners = [];

    // Configuration storage key
    this.CONFIG_KEY = 'nutri_firebase_config';
    this.STATUS_KEY = 'nutri_cloud_sync_meta';

    // Load saved config & metadata
    this.config = this.loadConfig();
    this.loadMeta();

    // Auto-init if config exists and Firebase is loaded
    if (this.config && this.hasFirebaseSdk()) {
      this.initFirebase(this.config);
    }
  }

  hasFirebaseSdk() {
    return typeof window.firebase !== 'undefined' && 
           typeof window.firebase.initializeApp === 'function' &&
           typeof window.firebase.auth === 'function' &&
           typeof window.firebase.firestore === 'function';
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(this.CONFIG_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn('Could not load Firebase config from localStorage:', e);
    }
    return null;
  }

  saveConfig(cfg) {
    this.config = cfg;
    try {
      if (cfg) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(cfg));
      } else {
        localStorage.removeItem(this.CONFIG_KEY);
      }
    } catch (e) {
      console.error('Failed to save Firebase config:', e);
    }
  }

  loadMeta() {
    try {
      const meta = localStorage.getItem(this.STATUS_KEY);
      if (meta) {
        const parsed = JSON.parse(meta);
        this.lastSyncedAt = parsed.lastSyncedAt ? new Date(parsed.lastSyncedAt) : null;
      }
    } catch (e) {}
  }

  saveMeta() {
    try {
      localStorage.setItem(this.STATUS_KEY, JSON.stringify({
        lastSyncedAt: this.lastSyncedAt ? this.lastSyncedAt.toISOString() : null
      }));
    } catch (e) {}
  }

  onStatusChange(cb) {
    this.statusListeners.push(cb);
    return () => { this.statusListeners = this.statusListeners.filter(l => l !== cb); };
  }

  onAuthChange(cb) {
    this.authListeners.push(cb);
    return () => { this.authListeners = this.authListeners.filter(l => l !== cb); };
  }

  notifyStatus(status, detail = '') {
    this.statusListeners.forEach(cb => {
      try { cb({ status, detail, lastSyncedAt: this.lastSyncedAt, user: this.user }); } catch (e) {}
    });
  }

  notifyAuth(user) {
    this.authListeners.forEach(cb => {
      try { cb(user); } catch (e) {}
    });
  }

  initFirebase(config) {
    if (!this.hasFirebaseSdk()) {
      console.warn('Firebase SDK is not loaded on window.');
      this.notifyStatus('error', 'SDK-ul Firebase nu a fost încărcat.');
      return false;
    }

    try {
      // Avoid initializing duplicate apps
      let app;
      if (window.firebase.apps && window.firebase.apps.length > 0) {
        app = window.firebase.apps[0];
      } else {
        app = window.firebase.initializeApp(config);
      }

      this.auth = window.firebase.auth(app);
      this.db = window.firebase.firestore(app);

      // Listen to auth state changes
      this.auth.onAuthStateChanged((user) => {
        this.user = user;
        this.notifyAuth(user);
        if (user) {
          this.notifyStatus('connected', `Conectat: ${user.email || user.displayName || 'Utilizator'}`);
          this.startRealtimeSync();
        } else {
          this.stopRealtimeSync();
          this.notifyStatus('disconnected', 'Deconectat');
        }
      });

      this.saveConfig(config);
      return true;
    } catch (err) {
      console.error('Eroare la inițializarea Firebase:', err);
      this.notifyStatus('error', err.message || 'Eroare la inițializare Firebase');
      return false;
    }
  }

  // Google Sign-In
  async signInWithGoogle() {
    if (!this.auth) throw new Error('Firebase nu este configurat.');
    const provider = new window.firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    return await this.auth.signInWithPopup(provider);
  }

  // Email / Password Login
  async signInWithEmail(email, password) {
    if (!this.auth) throw new Error('Firebase nu este configurat.');
    return await this.auth.signInWithEmailAndPassword(email.trim(), password);
  }

  // Email / Password Registration
  async signUpWithEmail(email, password, displayName = '') {
    if (!this.auth) throw new Error('Firebase nu este configurat.');
    const cred = await this.auth.createUserWithEmailAndPassword(email.trim(), password);
    if (displayName && cred.user) {
      await cred.user.updateProfile({ displayName: displayName.trim() });
    }
    return cred;
  }

  // Sign out
  async signOut() {
    this.stopRealtimeSync();
    if (this.auth) {
      await this.auth.signOut();
    }
    this.user = null;
    this.notifyAuth(null);
    this.notifyStatus('disconnected', 'Deconectat');
  }

  // Start Realtime Firestore Sync
  startRealtimeSync() {
    if (!this.db || !this.user) return;
    this.stopRealtimeSync();

    const docRef = this.db.collection('users').doc(this.user.uid).collection('data').doc('nutri_planner_v1');

    // Subscribe to cloud changes
    this.unsubscribeSnapshot = docRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const cloudPayload = doc.data();
          if (cloudPayload && cloudPayload.data) {
            const cloudUpdatedAt = cloudPayload.updatedAt || 0;
            const localUpdatedAt = this.store.data.lastUpdatedAt || 0;

            // If cloud data is newer than local state, update local store
            if (cloudUpdatedAt > localUpdatedAt) {
              console.log('Sincronizare Cloud: Date mai noi recepționate din Firestore:', new Date(cloudUpdatedAt));
              this.applyCloudData(cloudPayload.data, cloudUpdatedAt);
            }
          }
        } else {
          // If no cloud data exists yet for this user, upload the current local state immediately
          console.log('Utilizator nou în Cloud: Se încarcă starea locală inițială...');
          this.uploadCurrentState(true);
        }
      },
      (err) => {
        console.error('Eroare la ascultarea modificărilor în timp real din Firestore:', err);
        this.notifyStatus('error', 'Eroare conexiune Firestore');
      }
    );

    // Also attach hook to store so every future local modification gets pushed to Cloud
    if (this.store && !this.storeHookAttached) {
      this.store.subscribe((data) => {
        if (this.user && !this.applyingRemoteUpdate) {
          this.debouncedUpload();
        }
      });
      this.storeHookAttached = true;
    }
  }

  stopRealtimeSync() {
    if (this.unsubscribeSnapshot) {
      this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
  }

  // Debounced cloud upload to prevent high frequency Firestore writes
  debouncedUpload() {
    if (this.uploadTimer) clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => {
      this.uploadCurrentState();
    }, 1200);
  }

  // Upload current store state to Cloud Firestore
  async uploadCurrentState(force = false) {
    if (!this.db || !this.user) return;
    if (this.isSyncing && !force) return;

    this.isSyncing = true;
    this.notifyStatus('syncing', 'Se sincronizează...');

    try {
      const now = Date.now();
      const stateToUpload = JSON.parse(JSON.stringify(this.store.data));
      stateToUpload.lastUpdatedAt = now;
      this.store.data.lastUpdatedAt = now;

      const docRef = this.db.collection('users').doc(this.user.uid).collection('data').doc('nutri_planner_v1');

      await docRef.set({
        data: stateToUpload,
        updatedAt: now,
        clientUserAgent: navigator.userAgent,
        userEmail: this.user.email || this.user.displayName || 'Utilizator'
      }, { merge: true });

      this.lastSyncedAt = new Date();
      this.saveMeta();
      this.notifyStatus('connected', 'Sincronizat cu succes');
    } catch (err) {
      console.error('Eroare la încărcarea stării în Firestore:', err);
      this.notifyStatus('error', 'Eșec sincronizare Cloud');
    } finally {
      this.isSyncing = false;
    }
  }

  // Apply cloud data to local store
  applyCloudData(cloudData, cloudUpdatedAt) {
    try {
      this.applyingRemoteUpdate = true;

      // Update store state safely
      this.store.data = cloudData;
      this.store.data.lastUpdatedAt = cloudUpdatedAt;
      this.store.saveState();

      this.lastSyncedAt = new Date();
      this.saveMeta();
      this.notifyStatus('connected', 'Date actualizate din Cloud');

      // Re-render app view if app instance is available
      if (window.app && typeof window.app.renderCurrentView === 'function') {
        window.app.renderCurrentView();
        window.app.updateHeaderProfile();
        window.app.showToast('Datele au fost sincronizate în timp real din Cloud!', 'info');
      }
    } catch (e) {
      console.error('Eroare la aplicarea datelor Cloud:', e);
    } finally {
      setTimeout(() => {
        this.applyingRemoteUpdate = false;
      }, 500);
    }
  }
}

// Global instance helper
window.NutriCloudSync = NutriCloudSync;
