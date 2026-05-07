const API = "http://localhost:3000";

async function testApi() {
  const endpoints = [
    "/api/leave-requests/all",
    "/api/hr-documents",
    "/api/announcements?page=1&limit=5&status=published"
  ];

  for (const path of endpoints) {
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { "Content-Type": "application/json" }
      });
      console.log(`[${path}] Status: ${res.status}`);
      const body = await res.json();
      console.log(`[${path}] Body:`, JSON.stringify(body, null, 2));
    } catch (err: any) {
      console.error(`[${path}] FAILED:`, err.message);
    }
  }
}

testApi();
