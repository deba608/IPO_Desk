const axios = require('axios');

async function test() {
  try {
    const response = await axios.get("https://ipo.bigshareonline.com/IPO_Status.html", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const html = response.data;
    const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
    const selectMatch = withoutComments.match(/<select[^>]*id="ddlCompany"[^>]*>([\s\S]*?)<\/select>/i);
    if (!selectMatch) {
      console.log("No ddlCompany select found!");
      return;
    }
    const optionRe = /<option\s+value="(\d+)"\s*>([^<]+)<\/option>/gi;
    let match;
    const ipos = [];
    while ((match = optionRe.exec(selectMatch[1])) !== null) {
      ipos.push({ id: match[1], name: match[2].trim() });
    }
    console.log("Found", ipos.length, "IPOs:");
    console.log(ipos.slice(0, 10));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
