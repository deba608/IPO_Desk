const axios = require('axios');

async function test() {
  try {
    const response = await axios.get("http://localhost:3000/api/logs");
    console.log("Total logs:", response.data.total);
    console.log("Logs:", JSON.stringify(response.data.logs, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

test();
