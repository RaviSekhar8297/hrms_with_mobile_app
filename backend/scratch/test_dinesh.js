async function test() {
  const tryLogin = async (username) => {
    const res = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: '123' })
    });
    const data = await res.json();
    console.log(`Login with ${username}:`, res.status, data);
  };

  await tryLogin('1234');
  await tryLogin('dinesh@brihaspathi.com');
}
test();
