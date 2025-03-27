
import * as schema from './schema.js';
console.log('Schema loaded successfully:');
console.log('Tables:', Object.keys(schema).filter(key => typeof schema[key] === 'object'));
