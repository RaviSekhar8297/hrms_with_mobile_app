async function testFetch() {
  const token = 'mock_token_employee_ravi@brihaspathi.com';
  const companyId = 'aba6cb1b-1487-437e-8949-f846cfc48a14';
  const headers = { 'Authorization': `Bearer ${token}` };

  try {
    const resLeave = await fetch(`http://127.0.0.1:5000/api/v1/leave-requests?companyId=${companyId}`, { headers });
    const dataLeave = await resLeave.json();
    console.log('1027 Leave Requests Count:', dataLeave.requests?.length, dataLeave.requests);

    const resReg = await fetch(`http://127.0.0.1:5000/api/v1/attendance/regularizations?companyId=${companyId}`, { headers });
    const dataReg = await resReg.json();
    console.log('1027 Regularization Requests Count:', dataReg.regularizations?.length, dataReg.regularizations);

    const resPerm = await fetch(`http://127.0.0.1:5000/api/v1/attendance/permissions?companyId=${companyId}`, { headers });
    const dataPerm = await resPerm.json();
    console.log('1027 Permission Requests Count:', dataPerm.permissions?.length, dataPerm.permissions);
  } catch (err) {
    console.error(err);
  }
}
testFetch();
