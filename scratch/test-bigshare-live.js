const axios = require('axios');

const STATUS_PAGE = "https://ipo.bigshareonline.com/IPO_Status.html";
const CHECK_URL = "https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails";
const PAN = "HNVPP4633P";

async function getIPOs() {
  const html = (await axios.get(STATUS_PAGE, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
  })).data;
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, "");
  const selectMatch = withoutComments.match(/<select[^>]*id="ddlCompany"[^>]*>([\s\S]*?)<\/select>/i);
  if (!selectMatch) { console.log("NO DROPDOWN FOUND"); return []; }
  const optionRe = /<option\s+value="(\d+)"\s*>([^<]+)<\/option>/gi;
  const ipos = [];
  let m;
  while ((m = optionRe.exec(selectMatch[1])) !== null) ipos.push({ id: m[1], name: m[2].trim() });
  return ipos;
}

async function check(companyId, name) {
  try {
    const response = await axios.post(CHECK_URL, {
      Applicationno: "", Company: companyId, SelectionType: "PN", PanNo: PAN,
      txtcsdl: "", txtDPID: "", txtClId: "", ddlType: "", lang: "en",
    }, { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }});
    console.log(`[${companyId}] ${name} => status ${response.status}`);
    console.log("  data:", JSON.stringify(response.data));
  } catch (error) {
    console.error(`[${companyId}] ${name} ERROR ${error.response?.status}: ${error.message}`);
    console.error("  body:", JSON.stringify(error.response?.data)?.slice(0, 500));
  }
}

(async () => {
  const ipos = await getIPOs();
  console.log("Found IPOs:", ipos.length);
  console.log(ipos.slice(0, 10));
  // test first few
  for (const ipo of ipos.slice(0, 3)) await check(ipo.id, ipo.name);
})();
