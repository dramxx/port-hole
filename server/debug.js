const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

console.log('OPENCODE_HOST:', process.env.OPENCODE_HOST);
console.log('OPENCODE_PORT:', process.env.OPENCODE_PORT);
console.log('BRIDGE_PORT:', process.env.BRIDGE_PORT);

const BASE_URL = `http://${process.env.OPENCODE_HOST}:${process.env.OPENCODE_PORT}`;
console.log('BASE_URL:', BASE_URL);

async function testHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${BASE_URL}/global/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Health check result:', result);
  } catch (error) {
    console.error('Health check failed:', error.message);
  }
}

testHealth();
