const DB_NAME = "task-manager-cache"
const DB_VERSION = 1
const STORE_NAME = "snapshots"

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "key",
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

function sectionKey(userKey, section) {
  return `${userKey}:${section}`
}

export async function saveCachedSection(userKey, section, value) {
  if (!userKey) return

  const db = await openDb()

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")

    transaction.objectStore(STORE_NAME).put({
      key: sectionKey(userKey, section),
      userKey,
      section,
      value,
      savedAt: new Date().toISOString(),
    })

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function loadCachedState(userKey) {
  if (!userKey) return null

  const db = await openDb()

  try {
    const transaction = db.transaction(STORE_NAME, "readonly")
    const store = transaction.objectStore(STORE_NAME)

    const sections = [
      "tasks",
      "buddyTasks",
      "buddySharedTasks",
      "appState",
    ]

    const results = await Promise.all(
      sections.map(section =>
        requestResult(
          store.get(sectionKey(userKey, section))
        )
      )
    )

    const snapshot = {}

    sections.forEach((section, index) => {
      if (results[index]) {
        snapshot[section] = results[index].value
      }
    })

    return Object.keys(snapshot).length
      ? snapshot
      : null
  } finally {
    db.close()
  }
}

export async function clearCachedState(userKey) {
  if (!userKey) return

  const db = await openDb()

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite")
    const store = transaction.objectStore(STORE_NAME)

    const sections = [
      "tasks",
      "buddyTasks",
      "buddySharedTasks",
      "appState",
    ]

    sections.forEach(section => {
      store.delete(sectionKey(userKey, section))
    })

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}