const axios = require('axios');

async function test() {
  try {
    const response = await axios.post("http://localhost:3000/api/check", {
      pans: ["ABCDE1234F"],
      ipoClientId: "bigshare-9040"
    });
    console.log("Status:", response.status);
    console.log("Data:", response.data);
  } catch (error) {
    console.error("Error status:", error.response?.status);
    console.error("Error data:", error.response?.data);
    console.error("Error message:", error.message);
  }
}

test();
