const dotenv = require('dotenv');
dotenv.config();

// Configuration
const keycloakUrl = process.env.KEYCLOAK_AUTH_SERVER_URL || 'http://localhost:8080';
const realm = process.env.KEYCLOAK_REALM || 'hrms';
const clientId = process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api';

// USER credentials to test
const username = process.argv[2] || 'rajasekhar'; 
const password = process.argv[3] || '123'; 

async function getAccessToken() {
  const tokenUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/token`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('client_id', clientId);
  params.append('username', username);
  params.append('password', password);

  if (process.env.KEYCLOAK_CLIENT_SECRET && process.env.KEYCLOAK_CLIENT_SECRET !== 'your-keycloak-client-secret') {
    params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
  }

  try {
    console.log(`Fetching token from: ${tokenUrl}`);
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();
    if (response.ok) {
      console.log('\n✅ Access Token Retrieved Successfully:\n');
      console.log('Bearer ' + data.access_token);
      console.log('\nUse this token in the Authorization header of your API requests.');
    } else {
      console.error('\n❌ Failed to fetch token:', data);
    }
  } catch (error) {
    console.error('\n❌ Connection Error:', error.message);
  }
}

getAccessToken();
