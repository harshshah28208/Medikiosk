import http from 'http';

function testUpload() {
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  let body = '';
  
  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="patientId"\r\n\r\n';
  body += '11111111-1111-1111-1111-111111111111\r\n';

  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="title"\r\n\r\n';
  body += 'Cardiology Previous Prescription 2025\r\n';

  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="fileType"\r\n\r\n';
  body += 'PRESCRIPTION\r\n';

  body += '--' + boundary + '\r\n';
  body += 'Content-Disposition: form-data; name="file"; filename="prescription.pdf"\r\n';
  body += 'Content-Type: application/pdf\r\n\r\n';
  body += '%PDF-1.4 Mock PDF Content For Medical Record\r\n';
  body += '--' + boundary + '--\r\n';

  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/documents/upload',
    method: 'POST',
    headers: {
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': Buffer.byteLength(body)
    }
  }, (res) => {
    let resBody = '';
    res.on('data', d => resBody += d);
    res.on('end', () => {
      console.log('Upload response status:', res.statusCode);
      console.log('Upload response body:', resBody);
    });
  });

  req.on('error', (err) => console.error('Upload request error:', err));
  req.write(body);
  req.end();
}

testUpload();
