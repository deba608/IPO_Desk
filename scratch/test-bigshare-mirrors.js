const axios = require('axios');

async function checkMirror(domain) {
  const started = Date.now();
  try {
    const response = await axios.post(
      `https://${domain}/Data.aspx/FetchIpodetails`,
      {
        Applicationno: "",
        Company: "9040",
        SelectionType: "PN",
        PanNo: "ABCDE1234F",
        txtcsdl: "",
        txtDPID: "",
        txtClId: "",
        ddlType: "",
        lang: "en",
      },
      {
        timeout: 5000,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }
    );
    console.log(`${domain} - Status: ${response.status}, Time: ${Date.now() - started}ms, Result:`, response.data?.d?.DPID);
  } catch (error) {
    console.error(`${domain} - Error: ${error.message}, Time: ${Date.now() - started}ms`);
  }
}

async function test() {
  await checkMirror("ipo.bigshareonline.com");
  await checkMirror("ipo1.bigshareonline.com");
  await checkMirror("ipo2.bigshareonline.com");
}

test();
