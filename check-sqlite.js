const Database = require('better-sqlite3');

try {
  // Open the database
  const db = new Database('data.db');
  console.log('Successfully opened the database');

  // List all tables
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables in the database:');
  if (tables.length === 0) {
    console.log('No tables found');
  } else {
    tables.forEach(table => {
      console.log(`- ${table.name}`);
    });
  }

  // Close the database
  db.close();
} catch (error) {
  console.error('Error accessing the database:', error);
} 