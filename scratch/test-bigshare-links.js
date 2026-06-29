const axios = require('axios');

async function test() {
  try {
    const response = await axios.get("https://www.bigshareonline.com/ipo_Allotment.html", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    console.log("Length:", response.data.length);
    // Find all links (href)
    const links = response.data.match(/href="([^"]+)"/gi) || [];
    console.log("Links found:", links.length);
    links.forEach(link => {
      if (link.includes('bigshareonline') || link.includes('ipo')) {
        console.log(link);
      }
    });
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
