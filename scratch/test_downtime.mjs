import assert from 'node:assert';
import { apiClient, setApiBaseUrl, ApiError } from '../src/api/index.js';

setApiBaseUrl('http://127.0.0.1:8000/api/v1');

async function testDowntime() {
  console.log('Testing connection to stopped backend on port 8000...');
  try {
    await apiClient.analyzeRepository('https://github.com/pallets/flask');
    assert.fail('Should have failed due to server offline');
  } catch (err) {
    assert(err instanceof ApiError);
    assert.strictEqual(err.code, 'BACKEND_UNAVAILABLE');
    assert(err.message.includes('backend is unreachable'));
    console.log('PASS: Correctly reported BACKEND_UNAVAILABLE with message:');
    console.log('   ', err.message);
  }
}

testDowntime().catch((err) => {
  console.error(err);
  process.exit(1);
});
