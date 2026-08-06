const jwt = require('jsonwebtoken');
const jwksRsa = require('jwks-rsa');
const dotenv = require('dotenv');

dotenv.config();

const token = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJ2Si04N0RkRlo5eElMcWY0WnJ1RWxiUHhONGtZcU5iUkVpQk8xR0NuNjJzIn0.eyJleHAiOjE3ODQxMTg3MTAsImlhdCI6MTc4NDExODQxMCwianRpIjoiYWJkYWVhMGEtZDliMS00OGYwLWJjZmEtMWZkMGVhZDE2NDliIiwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgwL3JlYWxtcy9ocm1zIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjE1Yjk5MGQ1LThkZDUtNGIxYi1hMjA1LTJjMzYyYTIzMzBkMCIsInR5cCI6IkJlYXJlciIsImF6pCI6ImhybXMtYmFja2VuZC1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiY2NjNTU5Y2UtYjEyMS00YWIyLWI4ZTctZjhmMzVlOWVhNWMyIiwiYWNyIjoiMSIsImFsbG93ZWQtb3JpZ2lucyI6WyIvKiJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJkZWZhdWx0LXJvbGVzLWhybXMiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoicHJvZmlsZSBlbWFpbCIsInNpZCI6ImNjYzU1OWNlLWIxMjEtNGFiMi1iOGU3LWY4ZjM1ZTllYTVjMiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwibmFtZSI6InJhamFzZWtoYXIgcGFwb2x1IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic3VwZXJhZG1pbiIsImdpdmVuX25hbWUiOiJyYWphc2VraGFyIiwiZmFtaWx5X25hbWUiOiJwYXBvbHUiLCJlbWFpbCI6Im1kQGJyaWhhc3BhdGhpLmNvbSJ9.lWTy1rHUnsXlovePaIQCzFzjd46NaT-q6mc45Jg9Ch1ySZHI4f_HknigO4xW6LsfLUqq_OFPa21JpppiBxyqVYRt7qEZxl7_xhXglTJ8sLj8WcAL-k2E-5XftWLH9CW_YXoAyGt8fNMOOxd_mJqQUBrNZ7apbexf_bQ7MU2fGJoLVBBmbSZ9ow6RTZR0BdVdYKDtSihstjUV_lfPieHhgrVzguI1LdjZrGW5SYh9PdxxuwH4eB9Wzy1HWyS70YM_tMDkVnKjwe1aX6BB7PsWtfMOUIFCD-GtWH_hrrjKJE2qSTjqS9GNNHPXu45Vrgo2ti6QBEHjongz6YFeHASGUw';

const keycloakUrl = process.env.KEYCLOAK_AUTH_SERVER_URL;
const realm = process.env.KEYCLOAK_REALM;

console.log('Keycloak URL:', keycloakUrl);
console.log('Realm:', realm);

const jwksClientInstance = jwksRsa({
  jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header, callback) {
  if (!header.kid) {
    return callback(new Error('JWT kid header is missing'));
  }
  jwksClientInstance.getSigningKey(header.kid, (err, key) => {
    if (err || !key) {
      return callback(err || new Error('Public key not found'));
    }
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

// 1. Decode token
const decoded = jwt.decode(token, { complete: true });
console.log('\nDecoded Token Header:', JSON.stringify(decoded.header, null, 2));
console.log('Decoded Token Payload:', JSON.stringify(decoded.payload, null, 2));

const now = Math.floor(Date.now() / 1000);
console.log('\nCurrent time (unix):', now);
console.log('Token expiration (unix):', decoded.payload.exp);
console.log('Expired?', now > decoded.payload.exp ? 'YES' : 'NO');
console.log('Seconds until expiration:', decoded.payload.exp - now);

// 2. Verify token
jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, verified) => {
  if (err) {
    console.error('\nVerification failed with error:', err);
  } else {
    console.log('\nVerification succeeded! Decoded:', verified);
  }
});
