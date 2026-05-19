const fs = require('fs/promises');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { createRxDatabase } = require('rxdb');
const { getRxStorageMemory } = require('rxdb/plugins/storage-memory');
const { wrappedValidateAjvStorage } = require('rxdb/plugins/validate-ajv');

const DATA_DIR = path.join(__dirname, 'data');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'notifications.snapshot.json');

const notificationSchema = {
  title: 'notification schema',
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id:         { type: 'string', maxLength: 100 },
    user_id:    { type: 'string', maxLength: 100 },
    type:       { type: 'string', maxLength: 50 },
    message:    { type: 'string', maxLength: 500 },
    statut:     { type: 'string', maxLength: 20 },
    created_at: { type: 'string', maxLength: 50 },
  },
  required: ['id', 'user_id', 'type', 'message', 'statut', 'created_at'],
  indexes: ['user_id'],
};

async function hashFunction(input) {
  if (input instanceof ArrayBuffer) input = Buffer.from(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob)
    input = Buffer.from(await input.arrayBuffer());
  if (!Buffer.isBuffer(input)) input = Buffer.from(String(input));
  return createHash('sha256').update(input).digest('hex');
}

async function loadSnapshot() {
  try {
    const raw = await fs.readFile(SNAPSHOT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

async function persistNotifications(collection) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const docs = await collection.find().exec();
  await fs.writeFile(
    SNAPSHOT_FILE,
    JSON.stringify(docs.map((d) => d.toJSON()), null, 2),
    'utf8'
  );
}

async function initDatabase() {
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const db = await createRxDatabase({
    name: 'notifications-db',
    storage,
    eventReduce: true,
    multiInstance: false,
    hashFunction,
  });
  await db.addCollections({ notifications: { schema: notificationSchema } });
  const initial = await loadSnapshot();
  if (initial.length > 0) await db.notifications.bulkInsert(initial);
  return {
    db,
    notifications: db.notifications,
    persistNotifications,
    createId: () => randomUUID(),
  };
}

module.exports = initDatabase();