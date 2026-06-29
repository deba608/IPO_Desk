const axios = require('axios');

async function checkMirrorActiveIPOs(domain) {
  const started = Date.now();
  try {
    const response = await axios.get(
      `https://${domain}/IPO_Status.html`,
      {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }
    );
    console.log(`${domain} - Status: ${response.status}, Length: ${response.data.length}, Time: ${Date.now() - started}ms`);
  } catch (error) {
    console.error(`${domain} - Error: ${error.message}, Time: ${Date.now() - started}ms`);
  }
}

async function test() {
  await checkMirrorActiveIPOs("ipo.bigshareonline.com");
  await checkMirrorActiveIPOs("ipo1.bigshareonline.com");
  await checkMirrorActiveIPOs("ipo2.bigshareonline.com");
}

test();
