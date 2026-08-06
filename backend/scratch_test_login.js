async function testLogin() {
  try {
    const res1027 = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '1027', password: '123' })
    });
    const data1027 = await res1027.json();
    console.log('1027 Response:', data1027);

    const res1413 = await fetch('http://127.0.0.1:5000/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '1413', password: '123' })
    });
    const data1413 = await res1413.json();
    console.log('1413 Response:', data1413);
  } catch (err) {
    console.error(err);
  }
}
testLogin();
