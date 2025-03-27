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
    console.log(`Clearing table ${tableName} in target database...`);
    await client.query(`DELETE FROM ${tableName}`);
    console.log(`Table ${tableName} cleared successfully.`);
  } catch (error) {
    console.error(`Error clearing table ${tableName}:`, error.message);
    if (error.message.includes('does not exist')) {
      console.log(`Creating table ${tableName} in target database...`);
      // We'll handle table creation in another function
    } else {
      throw error;
    }
  }
}

async function getTableSchema(sourceClient, tableName) {
  const result = await sourceClient.query(`
    SELECT 
      column_name, 
      data_type,
      character_maximum_length,
      column_default,
      is_nullable
    FROM 
      information_schema.columns
    WHERE 
      table_name = $1
    ORDER BY 
      ordinal_position
  `, [tableName]);
  
  return result.rows;
}

async function createTable(targetClient, tableName, schema) {
  let columns = schema.map(col => {
    let colDef = `"${col.column_name}" ${col.data_type}`;
    
    if (col.character_maximum_length) {
      colDef += `(${col.character_maximum_length})`;
    }
    
    if (col.column_default && col.column_default.includes('nextval')) {
      // Handle serial columns
      if (col.column_name === 'id') {
        colDef += ' PRIMARY KEY';
      }
    }
    
    if (col.is_nullable === 'NO') {
      colDef += ' NOT NULL';
    }
    
    return colDef;
  }).join(', ');
  
  const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
  
  try {
    await targetClient.query(createTableSQL);
    console.log(`Table ${tableName} created successfully in target database.`);
    
    // Create sequence for id column if needed
    if (schema.some(col => col.column_name === 'id' && col.column_default && col.column_default.includes('nextval'))) {
      try {
        await targetClient.query(`
          CREATE SEQUENCE IF NOT EXISTS ${tableName}_id_seq
          OWNED BY ${tableName}.id
        `);
        await targetClient.query(`
          ALTER TABLE ${tableName} ALTER COLUMN id SET DEFAULT nextval('${tableName}_id_seq')
        `);
        console.log(`Sequence for ${tableName}.id created successfully.`);
      } catch (error) {
        console.error(`Error creating sequence for ${tableName}.id:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error.message);
    throw error;
  }
}

async function migrateData(sourceClient, targetClient, tableName) {
  try {
    // Get all data from source table
    const { rows: sourceData } = await sourceClient.query(`SELECT * FROM ${tableName}`);
    
    if (sourceData.length === 0) {
      console.log(`No data to migrate for table ${tableName}.`);
      return;
    }
    
    console.log(`Migrating ${sourceData.length} rows from table ${tableName}...`);
    
    // Get column names
    const columns = Object.keys(sourceData[0]);
    const columnNames = columns.map(col => `"${col}"`).join(', ');
    
    // Prepare values for batch insert
    for (let i = 0; i < sourceData.length; i++) {
      const row = sourceData[i];
      const values = columns.map(col => row[col]);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      
      const insertSQL = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;
      
      await targetClient.query(insertSQL, values);
    }
    
    console.log(`Successfully migrated ${sourceData.length} rows to ${tableName}.`);
    
    // Update sequence if table has id column
    if (columns.includes('id')) {
      try {
        const { rows: maxId } = await sourceClient.query(`SELECT MAX(id) FROM ${tableName}`);
        if (maxId[0].max) {
          await targetClient.query(`
            SELECT setval('${tableName}_id_seq', ${maxId[0].max}, true)
          `);
          console.log(`Updated sequence for ${tableName}_id_seq to ${maxId[0].max}.`);
        }
      } catch (error) {
        console.error(`Error updating sequence for ${tableName}:`, error.message);
      }
    }
  } catch (error) {
    console.error(`Error migrating data for table ${tableName}:`, error.message);
    throw error;
  }
}

async function migrateDatabase() {
  let sourceClient;
  let targetClient;
  
  try {
    console.log('Starting database migration to Supabase...');
    
    sourceClient = await sourcePool.connect();
    console.log('Connected to source database.');
    
    targetClient = await targetPool.connect();
    console.log('Connected to target database (Supabase).');
    
    // Process each table
    for (const tableName of tables) {
      // Get table schema from source
      const schema = await getTableSchema(sourceClient, tableName);
      
      // Clear table in target database
      try {
        await clearTable(targetClient, tableName);
      } catch (error) {
        // If table doesn't exist, create it
        if (error.message.includes('does not exist')) {
          await createTable(targetClient, tableName, schema);
        } else {
          throw error;
        }
      }
      
      // Migrate data
      await migrateData(sourceClient, targetClient, tableName);
    }
    
    console.log('Database migration completed successfully!');
    
  } catch (error) {
    console.error('Database migration failed:', error);
  } finally {
    if (sourceClient) {
      sourceClient.release();
    }
    if (targetClient) {
      targetClient.release();
    }
    
    // Close pools
    await sourcePool.end();
    await targetPool.end();
  }
}

migrateDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 