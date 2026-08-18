const token = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ2Si04N0RkRlo5eElMcWY0WnJ1RWxiUHhONGtZcU5iUkVpQk8xR0NuNjJzIn0.eyJleHAiOjE3ODQxMTg3MTAsImlhdCI6MTc4NDExODQxMCwianRpIjoiYWJkYWVhMGEtZDliMS00OGYwLWJjZmEtMWZkMGVhZDE2NDliIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgwL3JlYWxtcy9ocm1zIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjE1Yjk5MGQ1LThkZDUtNGIxYi1hMjA1LTJjMzYyYTIzMzBkMCIsInR5cCI6IkJlYXJlciIsImF6pCI6ImhybXMtYmFja2VuZC1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiY2NjNTU5Y2UtYjEyMS00YWIyLWI4ZTctZjhmMzVlOWVhNWMyIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIvKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJkZWZhdWx0LXJvbGVzLWhybXMiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCIsInNpZCI6ImNjYzU1OWNlLWIxMjEtNGFiMi1iOGU3LWY4ZjM1ZTllYTVjMiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwibmFtZSI6InJhamFzZWtoYXIgcGFwb2x1IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic3VwZXJhZG1pbiIsImdpdmVuX25hbWUiOiJyYWphc2VraGFyIiwiZmFtaWx5X25hbWUiOiJwYXBvbHUiLCJlbWFpbCI6Im1kQGJyaWhhc3BhdGhpLmNvbSJ9.lWTy1rHUnsXlovePaIQCzFzjd46NaT-q6mc45Jg9Ch1ySZHI4f_HknigO4xW6LsfLUqq_OFPa21JpppiBxyqVYRt7qEZxl7_xhXglTJ8sLj8WcAL-k2E-5XftWLH9CW_YXoAyGt8fNMOOxd_mJqQUBrNZ7apbexf_bQ7MU2fGJoLVBBmbSZ9ow6RTZR0BdVdYKDtSihstjUV_lfPieHhgrVzguI1LdjZrGW5SYh9PdxxuwH4eB9Wzy1HWyS70YM_tMDkVnKjwe1aX6BB7PsWtfMOUIFCD-GtWH_hrrjKJE2qSTjqS9GNNHPXu45Vrgo2ti6QBEHjongz6YFeHASGUw';

async function test() {
  try {
    const urls = [
      'http://localhost:5005/api/v1/companies',
      'http://localhost:5005/api/v1/permissions',
      'http://localhost:5005/api/v1/roles'
    ];
    for (const url of urls) {
      console.log(`\nTesting GET ${url}...`);
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('Status:', res.status);
      try {
        const json = await res.json();
        console.log('Response:', JSON.stringify(json, null, 2));
      } catch (err) {
        const text = await res.text();
        console.log('Text Response:', text);
      }
    }
  } catch (err) {
    console.error('Error during fetch:', err);
  }
}

test();
