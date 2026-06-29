const axios = require('axios');

async function test() {
  try {
    const response = await axios.get("https://ipo.bigshareonline.com/IPO_Status.html", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Length:", response.data.length);
    // Find captcha mentions
    const matches = response.data.match(/captcha/gi);
    console.log("Captcha occurrences:", matches ? matches.length : 0);
    // Let's print form fields/input fields or scripts related to FetchIpodetails
    const lines = response.data.split('\n');
    lines.forEach(line => {
      if (line.includes('FetchIpodetails') || line.includes('captcha') || line.includes('Captcha')) {
        console.log(line.trim());
      }
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
