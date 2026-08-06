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

async function run() {
  const token = await getKeycloakAdminToken();
  if (!token) return;

  const usersUrl = `${process.env.KEYCLOAK_AUTH_SERVER_URL}/admin/realms/${process.env.KEYCLOAK_REALM}/users`;
  try {
    const res = await fetch(usersUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.ok) {
      const users = await res.json();
      console.log('Keycloak Users:', users.map(u => ({ id: u.id, username: u.username, email: u.email })));
    } else {
      console.error('Failed to fetch users:', await res.text());
    }
  } catch (err) {
    console.error(err);
  }
}

run();
