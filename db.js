// db.js — IndexedDB layer for Woodland Restoration Calculator constants

const DB_NAME    = 'WoodlandRestorationCalculator';
const LEGACY_DB  = 'PAWSModeller';
const DB_VERSION = 1;
const STORE      = 'constants';
const RECORD_ID  = 'woodland_v2';
const SEED_URL   = './data/constants.json';

// ─────────────────────────────────────────────────
// Internal: open the database and seed if empty
// ─────────────────────────────────────────────────

function _openRaw() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    // FIX [1b Firefox]: delete the store before recreating on version upgrade
    // so schema changes don't leave stale object stores behind.
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE, { keyPath: 'id' });
    };

    req.onsuccess  = (event) => resolve(event.target.result);
    req.onerror    = (event) => reject(event.target.error);
    req.onblocked  = ()      => reject(new Error('Woodland DB: open blocked by another tab'));
  });
}

function _getRecord(db) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(RECORD_ID);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

function _putRecord(db, data) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put({ id: RECORD_ID, ...data });
    req.onsuccess = () => resolve();
    req.onerror   = (e) => reject(e.target.error);
  });
}

async function _seed(db) {
  const response = await fetch(SEED_URL);
  if (!response.ok) {
    throw new Error(`Woodland DB: failed to fetch seed file (${response.status})`);
  }
  const constants = await response.json();
  await _putRecord(db, constants);
  console.info('Woodland DB seeded from constants.json');
  return constants;
}

// ─────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────

let _db = null;

/**
 * openDB()
 * Opens (and seeds if empty) the IndexedDB.
 * Returns Promise<IDBDatabase>.
 * Subsequent calls return the cached connection.
 */
export async function openDB() {
  if (_db) return _db;

  // Best-effort removal of the pre-2.0 PAWS-only database
  try { indexedDB.deleteDatabase(LEGACY_DB); } catch { /* ignore */ }

  _db = await _openRaw();
  const existing = await _getRecord(_db);

  if (existing) {
    console.info('Woodland DB: loaded existing constants');
  } else {
    await _seed(_db);
  }

  return _db;
}

/**
 * getConstants()
 * Returns the full constants object (single record, id='woodland_v2').
 */
export async function getConstants() {
  const db     = await openDB();
  const record = await _getRecord(db);

  if (!record) {
    // Shouldn't happen after openDB() seeds, but guard anyway
    throw new Error('Woodland DB: constants record missing — try resetConstants()');
  }

  // Return a copy without the internal 'id' key
  const { id: _id, ...constants } = record;
  return constants;
}

/**
 * saveConstants(constants)
 * Overwrites the constants record with a user-modified version.
 * Used by the Advanced Settings override panel.
 */
export async function saveConstants(constants) {
  const db = await openDB();
  await _putRecord(db, constants);
  console.info('Woodland DB: constants saved (user overrides applied)');
}

/**
 * resetConstants()
 * Resets constants to the JSON seed file defaults.
 */
export async function resetConstants() {
  const db = await openDB();
  await _seed(db);
  console.info('Woodland DB: constants reset to seed defaults');
}

/**
 * dbReady
 * Promise that resolves once the DB is open and seeded.
 * app.js awaits this before the first calculation.
 */
export const dbReady = openDB();
