import 'server-only'

import { MongoClient, type Db } from 'mongodb'

const globalForMongo = globalThis as typeof globalThis & {
  mongoClient?: MongoClient
  mongoClientPromise?: Promise<MongoClient>
}

function getDbName() {
  return process.env.MONGODB_DB_NAME || 'topsell-run'
}

async function connectWithFallback(): Promise<MongoClient> {
  const standardUri = process.env.MONGODB_URI_STANDARD
  const srvUri = process.env.MONGODB_URI

  if (standardUri) {
    try {
      const client = new MongoClient(standardUri)
      await client.connect()
      return client
    } catch (error) {
      if (!srvUri) throw error
      console.warn('MongoDB standard URI connection failed, trying SRV URI:', error)
    }
  }

  const uri = srvUri || standardUri
  if (!uri) {
    throw new Error('MONGODB_URI or MONGODB_URI_STANDARD must be configured.')
  }

  const client = new MongoClient(uri)
  await client.connect()
  return client
}

export async function getMongoClient() {
  if (globalForMongo.mongoClient) return globalForMongo.mongoClient

  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = connectWithFallback().then((client) => {
      globalForMongo.mongoClient = client
      return client
    })
  }

  return globalForMongo.mongoClientPromise
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db(getDbName())
}

export async function ensureIndexes() {
  const db = await getDb()

  await Promise.all([
    db.collection('communities').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
      { key: { community_code: 1 }, unique: true },
    ]),
    db.collection('participants').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { community_id: 1 } },
      { key: { registration_id: 1 } },
      { key: { participant_code: 1 }, unique: true, partialFilterExpression: { participant_code: { $type: 'string' } } },
      { key: { payment_status: 1 } },
    ]),
    db.collection('registrations').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { community_id: 1 } },
      { key: { status: 1 } },
    ]),
    db.collection('payments').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { registration_id: 1 } },
      { key: { payment_reference: 1 }, unique: true },
      { key: { xendit_session_id: 1 }, sparse: true },
      { key: { status: 1 } },
    ]),
    db.collection('app_settings').createIndexes([{ key: { key: 1 }, unique: true }]),
    db.collection('community_auth').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
    ]),
    db.collection('families').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
      { key: { family_code: 1 }, unique: true },
    ]),
    db.collection('family_participants').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { family_id: 1 } },
      { key: { registration_id: 1 } },
      { key: { participant_code: 1 }, unique: true, partialFilterExpression: { participant_code: { $type: 'string' } } },
      { key: { payment_status: 1 } },
    ]),
    db.collection('family_registrations').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { family_id: 1 } },
      { key: { status: 1 } },
    ]),
    db.collection('family_payments').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { registration_id: 1 } },
      { key: { payment_reference: 1 }, unique: true },
      { key: { xendit_session_id: 1 }, sparse: true },
      { key: { status: 1 } },
    ]),
    db.collection('family_auth').createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
    ]),
  ])
}
