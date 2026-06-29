const axios = require('axios');

async function test() {
  try {
    const response = await axios.post(
      "https://ipo.bigshareonline.com/Data.aspx/FetchIpodetails",
      {
        Applicationno: "",
        Company: "1", // dummy company
        SelectionType: "PN",
        PanNo: "ABCDE1234F",
        txtcsdl: "",
        txtDPID: "",
        txtClId: "",
        ddlType: "",
        lang: "en",
      },
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      }
    );
    console.log("Status:", response.status);
    console.log("Data:", response.data);
  } catch (error) {
    console.error("Error status:", error.response?.status);
    console.error("Error headers:", error.response?.headers);
    console.error("Error data:", error.response?.data);
    console.error("Error message:", error.message);
  }
}

test();
