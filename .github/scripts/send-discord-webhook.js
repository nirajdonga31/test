const https = require('https');
const url = require('url');

function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const content = process.env.CONTENT;

  if (!webhookUrl) {
    console.error('Missing secret DISCORD_WEBHOOK_URL');
    process.exit(1);
  }

  const parsed = new url.URL(webhookUrl);
  const body = JSON.stringify({ content });

  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(data);
      } else {
        console.error(`Webhook failed with status ${res.statusCode}: ${data}`);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`Request error: ${err.message}`);
    process.exit(1);
  });

  req.write(body);
  req.end();
}

main();
