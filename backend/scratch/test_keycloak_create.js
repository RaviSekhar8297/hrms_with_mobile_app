require('dotenv').config();

async function getKeycloakAdminToken() {
  const tokenUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/token`;
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', process.env.KEYCLOAK_CLIENT_ID || 'hrms-backend-api');
  if (process.env.KEYCLOAK_CLIENT_SECRET) {
    params.append('client_secret', process.env.KEYCLOAK_CLIENT_SECRET);
  }

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    if (!res.ok) {
      console.error('Failed to get Keycloak admin token:', await res.text());
      return null;
    }

    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error('Error fetching admin token from Keycloak:', err);
    return null;
  }
}

async function testCreateUser() {
  console.log('Testing Keycloak token acquisition...');
  const token = await getKeycloakAdminToken();
  if (!token) {
    console.log('❌ Token acquisition failed. Check if Keycloak is running at', process.env.KEYCLOAK_AUTH_SERVER_URL);
    return;
  }
  console.log('✅ Token acquired successfully! Length:', token.length);

  const email = `test_keycloak_${Date.now()}@example.com`;
  console.log(`Attempting to create user with email: ${email}`);

  const createUserUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
  const userPayload = {
    username: email,
    email: email,
    enabled: true,
    emailVerified: true,
    firstName: 'Test',
    lastName: 'KeycloakUser',
    credentials: [
      {
        type: 'password',
        value: 'TempPassword@123',
        temporary: true
      }
    ]
  };

  try {
    const res = await fetch(createUserUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userPayload)
    });

    if (res.status === 201) {
      console.log('✅ Success! Keycloak user created successfully!');
    } else {
      console.log(`❌ Failed! Response Status: ${res.status}`);
      console.log(await res.text());
    }
  } catch (err) {
    console.error('Network error during user creation:', err);
  }
}

testCreateUser();
