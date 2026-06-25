// Runs ahead of EmulatorJS to make sure database is ready
(function() {
  const TARGET_DB = 'EmulatorJS-states'; 
  const REQUIRED_STORE = 'states';       

  console.debug("[Health Check] Checking database integrity...");

  const req = window.indexedDB.open(TARGET_DB);
  let createdDummyDB = false;

  // 1. If this runs, the DB didn't exist (or is upgrading). 
  // We mark it as a "Dummy" so we don't get stuck in a loop.
  req.onupgradeneeded = function(e) {
    createdDummyDB = true;
  };

  req.onsuccess = function(e) {
    const db = e.target.result;

    // CASE A: We just created this DB during this check.
    // It's empty, but that's normal. We need to delete it so the Emulator
    // can run its own creation logic properly.
    if (createdDummyDB) {
      console.debug("[Health Check] No existing DB found (Clean slate). Cleaning up check...");
      db.close();
      window.indexedDB.deleteDatabase(TARGET_DB); // Remove our dummy trace
      return;
    }

    // CASE B: The DB already existed (it's old). 
    // Now we check if it's corrupted (missing the store).
    if (!db.objectStoreNames.contains(REQUIRED_STORE)) {
      console.error(`[Health Check] CORRUPTION FOUND: '${TARGET_DB}' exists but is missing '${REQUIRED_STORE}'.`);
      db.close();

      // Delete the broken DB and reload to force a fresh start
      const deleteReq = window.indexedDB.deleteDatabase(TARGET_DB);
      deleteReq.onsuccess = () => {
        console.debug("[Health Check] Corrupted DB deleted. Reloading to initialize...");
        window.location.reload();
      };
    } else {
      // CASE C: DB exists and has the store. All good.
      console.debug("[Health Check] Database is healthy.");
      db.close();
    }
  };

  req.onerror = function(e) {
    console.debug("[Health Check] Could not open DB (Blocked or Private Mode).");
  };
})();
