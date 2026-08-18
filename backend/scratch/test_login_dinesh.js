async function test() {
  const tryLogin = async (username, password) => {
    const res = await fetch('http://127.0.0.1:5005/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    console.log(`Login ${username} / ${password}:`, res.status, data);
    return res.status === 200;
  };

  const passwords = ['Welcome@123', '123', 'Welcome@2026', 'Welcome@2025'];
  for (const pw of passwords) {
    if (await tryLogin('1234', pw)) break;
    if (await tryLogin('dinesh@brihaspathi.com', pw)) break;
  }
}
test();
