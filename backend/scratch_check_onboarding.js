const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/onboarding',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer mock_token_dev_bypass'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    const parsed = JSON.parse(data);
    console.log('Onboarding Records Count:', Array.isArray(parsed) ? parsed.length : parsed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('Sample Record:', parsed[0].onboarding_code, parsed[0].candidate_name, parsed[0].onboarding_status);
    }
  });
});

req.on('error', (e) => {
  console.error('Problem with request:', e.message);
});

req.end();
