
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI tidak ditemukan di .env.local');
  process.exit(1);
}

async function cleanDuplicates(collectionName) {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection(collectionName);

    console.log(`🔍 Memeriksa duplikat di ${collectionName}...`);

    // Langkah 1: Dapatkan semua dokumen
    const allDocs = await collection.find({}).sort({ created_at: 1 }).toArray();
    console.log(`✅ Total ${allDocs.length} dokumen ditemukan`);

    // Langkah 2: Grup berdasarkan email dan phone (case-insensitive untuk email)
    const emailMap = new Map();
    const phoneMap = new Map();
    const toDelete = new Set();
    const toKeep = new Map();

    // Aturan prioritas untuk status pembayaran
    const statusPriority = {
      paid: 3,
      pending: 2,
      expired: 1,
      failed: 1,
    };

    for (const doc of allDocs) {
      const email = doc.email?.toLowerCase() || null;
      const phone = doc.phone || null;

      let shouldKeep = true;
      let conflictId = null;

      if (email) {
        if (emailMap.has(email)) {
          const existing = emailMap.get(email);
          shouldKeep = compareDocs(doc, existing, statusPriority);
          conflictId = existing.id;
          if (shouldKeep) {
            toDelete.add(conflictId);
            toKeep.delete(conflictId);
            emailMap.set(email, doc);
            toKeep.set(doc.id, doc);
            if (existing.phone) {
              phoneMap.delete(existing.phone);
            }
          } else {
            toDelete.add(doc.id);
            continue;
          }
        } else {
          emailMap.set(email, doc);
          toKeep.set(doc.id, doc);
        }
      }

      if (phone) {
        if (phoneMap.has(phone)) {
          const existing = phoneMap.get(phone);
          shouldKeep = compareDocs(doc, existing, statusPriority);
          conflictId = existing.id;
          if (shouldKeep) {
            toDelete.add(conflictId);
            toKeep.delete(conflictId);
            phoneMap.set(phone, doc);
            toKeep.set(doc.id, doc);
            if (existing.email?.toLowerCase()) {
              emailMap.delete(existing.email?.toLowerCase());
            }
          } else {
            toDelete.add(doc.id);
            continue;
          }
        } else {
          phoneMap.set(phone, doc);
          toKeep.set(doc.id, doc);
        }
      }
    }

    if (toDelete.size === 0) {
      console.log('✅ Tidak ada duplikat yang perlu dihapus');
      return { deleted: 0 };
    }

    console.log(`⚠️ Ditemukan ${toDelete.size} dokumen duplikat`);

    // Tampilkan preview dokumen yang akan dihapus
    const docsToDelete = allDocs.filter(d => toDelete.has(d.id));
    console.log('\n📋 Preview dokumen yang akan dihapus:');
    docsToDelete.forEach((doc, i) => {
      if (i < 20) {
        console.log(`- [${i + 1}] ID: ${doc.id}, Nama: ${doc.full_name}, Email: ${doc.email}, Phone: ${doc.phone}, Status: ${doc.payment_status}, Created: ${doc.created_at}`);
      }
    });
    if (docsToDelete.length > 20) {
      console.log(`... dan ${docsToDelete.length - 20} dokumen lainnya`);
    }

    if (dryRun) {
      console.log('\n🔍 Mode Dry-Run: Tidak ada dokumen yang dihapus');
      return { deleted: 0, dryRun: true };
    }

    // Langkah 3: Hapus duplikat
    const result = await collection.deleteMany({ id: { $in: [...toDelete] } });
    console.log(`\n✅ Sukses menghapus ${result.deletedCount} dokumen duplikat dari ${collectionName}`);
    return { deleted: result.deletedCount, dryRun: false };
  } finally {
    await client.close();
  }
}

function compareDocs(newDoc, existingDoc, statusPriority) {
  const newStatus = newDoc.payment_status || 'expired';
  const existingStatus = existingDoc.payment_status || 'expired';
  
  const newPriority = statusPriority[newStatus] || 0;
  const existingPriority = statusPriority[existingStatus] || 0;
  
  if (newPriority > existingPriority) {
    return true; // keep new doc (higher priority)
  }
  
  if (newPriority === existingPriority) {
    const newDate = new Date(newDoc.created_at || 0);
    const existingDate = new Date(existingDoc.created_at || 0);
    return newDate < existingDate; // keep older doc if same status
  }
  
  return false; // keep existing doc
}

async function main() {
  console.log('🧹 Mulai memeriksa data duplikat di database...');
  if (dryRun) {
    console.log('ℹ️ Mode Dry-Run aktif (tidak menghapus data)\n');
  } else {
    console.log('⚠️ Mode Aktif: Data akan dihapus permanen!\n');
  }

  try {
    await cleanDuplicates('participants');
    console.log('\n');
    await cleanDuplicates('family_participants');
    
    if (dryRun) {
      console.log('\n🔍 Selesai dry-run! Gunakan tanpa --dry-run untuk menghapus duplikat.');
    } else {
      console.log('\n🎉 Selesai membersihkan duplikat!');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
