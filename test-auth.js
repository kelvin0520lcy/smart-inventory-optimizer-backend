// Simple script to test the authentication endpoints
const fetch = require('node-fetch');

async function testAuth() {
  const apiUrl = process.argv[2] || 'https://api.smart-io.online';
  
  console.log(`Testing authentication on ${apiUrl}`);
  
  // Test OPTIONS request first (preflight)
  try {
    console.log('\nTesting OPTIONS preflight...');
    const optionsRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://smart-io.online',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    console.log('Status:', optionsRes.status);
    console.log('Headers:', Object.fromEntries(optionsRes.headers.entries()));
  } catch (error) {
    console.error('OPTIONS Error:', error.message);
  }
  
  // Now test the actual login
  try {
    console.log('\nTesting POST login...');
    const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://smart-io.online'
      },
      body: JSON.stringify({
        username: 'demo',
        password: 'demo'
      })
    });
    
    console.log('Status:', loginRes.status);
    console.log('Headers:', Object.fromEntries(loginRes.headers.entries()));
    
    if (loginRes.ok) {
      const data = await loginRes.json();
      console.log('Response:', data);
    } else {
      const text = await loginRes.text();
      console.log('Error response:', text);
    }
  } catch (error) {
    console.error('POST Error:', error.message);
  }
}

testAuth().catch(console.error); 