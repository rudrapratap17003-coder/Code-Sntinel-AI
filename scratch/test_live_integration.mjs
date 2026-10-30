import assert from 'node:assert';
import { apiClient, setApiBaseUrl, ApiError } from '../src/api/index.js';

console.log('================================================================');
console.log('  CODESENTINEL AI: LIVE FRONTEND-BACKEND INTEGRATION TESTS');
console.log('================================================================\n');

setApiBaseUrl('http://127.0.0.1:8000/api/v1');

async function run() {
  console.log('1. Testing Live Backend Health Endpoint...');
  const health = await apiClient.checkHealth();
  console.log('   Health response:', JSON.stringify(health));
  assert.strictEqual(health.status, 'healthy');
  assert(health.engine_name?.includes('CodeSentinel') || health.service?.includes('CodeSentinel'));
  assert(health.supported_languages.includes('python'));
  console.log('   PASS: Live backend health verified.\n');

  console.log('2. Testing Backend Ingestion Rejection (Insecure HTTP)...');
  await assert.rejects(
    async () => apiClient.analyzeRepository('http://github.com/pallets/flask'),
    (err) => {
      assert(err instanceof ApiError);
      assert.strictEqual(err.code, 'VALIDATION_OR_INGESTION_ERROR');
      assert(err.message.includes('Insecure Protocol') || err.message.includes('HTTPS'));
      return true;
    }
  );
  console.log('   PASS: Backend strictly rejected insecure HTTP protocol.\n');

  console.log('3. Testing Backend Ingestion Rejection (Embedded Credentials)...');
  await assert.rejects(
    async () => apiClient.analyzeRepository('https://user:pass@github.com/pallets/flask'),
    (err) => {
      assert(err instanceof ApiError);
      assert.strictEqual(err.code, 'VALIDATION_OR_INGESTION_ERROR');
      assert(err.message.includes('Security Warning') || err.message.includes('credentials'));
      return true;
    }
  );
  console.log('   PASS: Backend strictly rejected embedded credentials.\n');

  console.log('4. Testing Backend Ingestion Rejection (Non-GitHub Domain)...');
  await assert.rejects(
    async () => apiClient.analyzeRepository('https://malicious.example.com/owner/repo'),
    (err) => {
      assert(err instanceof ApiError);
      assert.strictEqual(err.code, 'VALIDATION_OR_INGESTION_ERROR');
      return true;
    }
  );
  console.log('   PASS: Backend strictly rejected non-GitHub domain.\n');

  console.log('5. Testing Historical Analyses Listing (/api/v1/analyses)...');
  const historyList = await apiClient.getAnalyses();
  console.log(`   Found ${historyList.length} analysis records in SQLite backend.`);
  assert(Array.isArray(historyList));
  console.log('   PASS: Analyses history retrieved from SQLite.\n');

  console.log('================================================================');
  console.log('  ALL LIVE FRONTEND-BACKEND INTEGRATION TESTS PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('LIVE INTEGRATION TEST FAILED:', err);
  process.exit(1);
});
