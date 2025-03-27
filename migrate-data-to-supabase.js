import pg from 'pg';
const { Pool } = pg;

// Source database (local PostgreSQL)
const sourcePool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'leecyaqu110205',
  database: 'smart_inventory'
});

// Target database (Supabase PostgreSQL)
const targetPool = new Pool({
  connectionString: 'postgresql://postgres:leecyaqu110205@db.gxjxbccpzuuqaxzzmxjf.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false // Required for Supabase connection
  }
});

// Tables to migrate in the correct order to maintain referential integrity
const tables = [
  'users',
  'suppliers',
  'products',
  'product_suppliers',
  'sales',
  'forecasts',
  'integrations'
];

async function clearTable(client, tableName) {
  try {
    console.log(`Clearing table ${tableName} in Supabase...`);
    await client.query(`DELETE FROM ${tableName}`);
    console.log(`Table ${tableName} cleared successfully.`);
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error.message);
    // Continue even if there's an error
  }
}

async function migrateTable(sourceClient, targetClient, tableName) {
  try {
    // Get all data from source table
    const { rows: data } = await sourceClient.query(`SELECT * FROM ${tableName}`);
    
    if (data.length === 0) {
      console.log(`No data to migrate for table ${tableName}.`);
      return;
    }
    
    console.log(`Migrating ${data.length} rows to table ${tableName}...`);
    
    // For each row, insert one by one
    for (const row of data) {
      const columns = Object.keys(row);
      const columnsList = columns.join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const values = columns.map(c => row[c]);
      
      try {
        await targetClient.query(
          `INSERT INTO ${tableName} (${columnsList}) VALUES (${placeholders})`,
          values
        );
      } catch (insertError) {
        console.error(`Error inserting row in ${tableName}:`, insertError.message);
        // Continue with next row
      }
    }
    
    console.log(`Migration completed for table ${tableName}.`);
    
    // Update sequence if needed
    try {
      const { rows: maxId } = await sourceClient.query(`SELECT MAX(id) as max_id FROM ${tableName}`);
      if (maxId[0].max_id) {
        await targetClient.query(`SELECT setval('${tableName}_id_seq', ${maxId[0].max_id}, true)`);
        console.log(`Updated sequence for ${tableName} to ${maxId[0].max_id}.`);
      }
    } catch (seqError) {
      console.error(`Error updating sequence for ${tableName}:`, seqError.message);
      // Continue even if sequence update fails
    }
  } catch (error) {
    console.error(`Failed to migrate table ${tableName}:`, error.message);
  }
}

async function updateSequence(client, tableName) {
  try {
    const { rows } = await client.query(`SELECT MAX(id) as max_id FROM ${tableName}`);
    if (rows[0].max_id) {
      await client.query(`SELECT setval('${tableName}_id_seq', ${rows[0].max_id}, true)`);
      console.log(`Updated sequence for ${tableName} to ${rows[0].max_id}.`);
    }
  } catch (error) {
    console.error(`Error updating sequence for ${tableName}:`, error.message);
    // Continue even if sequence update fails
  }
}

async function migrateData() {
  const sourceClient = await sourcePool.connect();
  const targetClient = await targetPool.connect();
  
  try {
    console.log('Connected to source database and Supabase');
    
    // Disable all foreign key constraints temporarily
    await targetClient.query('BEGIN');
    await targetClient.query('SET CONSTRAINTS ALL DEFERRED');
    
    // Tables to migrate in order
    const tables = ['users', 'suppliers', 'products', 'product_suppliers', 'sales', 'forecasts', 'integrations'];
    
    // Clear tables in reverse order to avoid foreign key constraint issues
    for (let i = tables.length - 1; i >= 0; i--) {
      const table = tables[i];
      try {
        await clearTable(targetClient, table);
      } catch (error) {
        console.error(`Error clearing table ${table}:`, error.message);
        // Continue despite errors
      }
    }
    
    // Migrate data in the correct order
    for (const table of tables) {
      await migrateTable(sourceClient, targetClient, table);
    }
    
    // Update sequences for each table that has an ID
    for (const table of tables) {
      await updateSequence(targetClient, table);
    }
    
    // Re-enable foreign key constraints
    await targetClient.query('COMMIT');
    console.log('Migration completed successfully');
    
  } catch (err) {
    console.error('Migration error:', err);
    await targetClient.query('ROLLBACK');
  } finally {
    sourceClient.release();
    targetClient.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

migrateData().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 