const DB_NAME = "task-manager-cache"
const DB_VERSION = 2

const SNAPSHOT_STORE = "snapshots"
const OPERATIONS_STORE = "operations"

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    )

    request.onupgradeneeded = () => {
      const db = request.result

      if (
        !db.objectStoreNames.contains(
          SNAPSHOT_STORE
        )
      ) {
        db.createObjectStore(
          SNAPSHOT_STORE,
          {
            keyPath: "key",
          }
        )
      }

      let operationsStore

      if (
        !db.objectStoreNames.contains(
          OPERATIONS_STORE
        )
      ) {
        operationsStore =
          db.createObjectStore(
            OPERATIONS_STORE,
            {
              keyPath: "id",
            }
          )
      } else {
        operationsStore =
          request.transaction.objectStore(
            OPERATIONS_STORE
          )
      }

      if (
        !operationsStore.indexNames.contains(
          "userKey"
        )
      ) {
        operationsStore.createIndex(
          "userKey",
          "userKey",
          {
            unique: false,
          }
        )
      }
    }

    request.onsuccess = () =>
      resolve(request.result)

    request.onerror = () =>
      reject(request.error)
  })
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () =>
      resolve(request.result)

    request.onerror = () =>
      reject(request.error)
  })
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()

    transaction.onerror = () =>
      reject(transaction.error)

    transaction.onabort = () =>
      reject(transaction.error)
  })
}

function sectionKey(userKey, section) {
  return `${userKey}:${section}`
}

export async function saveCachedSection(
  userKey,
  section,
  value
) {
  if (!userKey) return

  const db = await openDb()

  try {
    const transaction = db.transaction(
      SNAPSHOT_STORE,
      "readwrite"
    )

    transaction
      .objectStore(SNAPSHOT_STORE)
      .put({
        key: sectionKey(
          userKey,
          section
        ),
        userKey,
        section,
        value,
        savedAt:
          new Date().toISOString(),
      })

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function loadCachedState(
  userKey
) {
  if (!userKey) return null

  const db = await openDb()

  try {
    const transaction = db.transaction(
      SNAPSHOT_STORE,
      "readonly"
    )

    const store =
      transaction.objectStore(
        SNAPSHOT_STORE
      )

    const sections = [
      "tasks",
      "buddyTasks",
      "buddySharedTasks",
      "appState",
    ]

    const results =
      await Promise.all(
        sections.map(section =>
          requestResult(
            store.get(
              sectionKey(
                userKey,
                section
              )
            )
          )
        )
      )

    const snapshot = {}

    sections.forEach(
      (section, index) => {
        if (results[index]) {
          snapshot[section] =
            results[index].value
        }
      }
    )

    return Object.keys(snapshot).length
      ? snapshot
      : null
  } finally {
    db.close()
  }
}

export async function clearCachedState(
  userKey
) {
  if (!userKey) return

  const db = await openDb()

  try {
    const transaction = db.transaction(
      SNAPSHOT_STORE,
      "readwrite"
    )

    const store =
      transaction.objectStore(
        SNAPSHOT_STORE
      )

    const sections = [
      "tasks",
      "buddyTasks",
      "buddySharedTasks",
      "appState",
    ]

    sections.forEach(section => {
      store.delete(
        sectionKey(
          userKey,
          section
        )
      )
    })

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

// Atomically persist the optimistic task list
// AND its corresponding outbox operation.
//
// This prevents a crash between:
//   1. showing the local task
//   2. saving the synchronization request.
export async function queueTaskCreate(
  userKey,
  tasks,
  operation
) {
  if (!userKey) return

  const db = await openDb()

  try {
    const transaction = db.transaction(
      [
        SNAPSHOT_STORE,
        OPERATIONS_STORE,
      ],
      "readwrite"
    )

    transaction
      .objectStore(SNAPSHOT_STORE)
      .put({
        key: sectionKey(
          userKey,
          "tasks"
        ),
        userKey,
        section: "tasks",
        value: tasks,
        savedAt:
          new Date().toISOString(),
      })

    transaction
      .objectStore(OPERATIONS_STORE)
      .put({
        ...operation,
        userKey,
      })

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export async function getPendingOperations(
  userKey
) {
  if (!userKey) return []

  const db = await openDb()

  try {
    const transaction = db.transaction(
      OPERATIONS_STORE,
      "readonly"
    )

    const store =
      transaction.objectStore(
        OPERATIONS_STORE
      )

    const index =
      store.index("userKey")

    const operations =
      await requestResult(
        index.getAll(userKey)
      )

    return operations.sort(
      (a, b) =>
        a.createdAt.localeCompare(
          b.createdAt
        )
    )
  } finally {
    db.close()
  }
}

export async function deletePendingOperation(
  operationId
) {
  const db = await openDb()

  try {
    const transaction = db.transaction(
      OPERATIONS_STORE,
      "readwrite"
    )

    transaction
      .objectStore(OPERATIONS_STORE)
      .delete(operationId)

    await transactionDone(transaction)
  } finally {
    db.close()
  }
}