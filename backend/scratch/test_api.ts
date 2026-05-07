import axios from "axios";

async function check() {
  try {
    const res = await axios.get("http://localhost:3000/api/announcements?limit=5", {
      headers: { "Content-Type": "application/json" }
    });
    console.log("ANNOUNCEMENTS API STATUS:", res.status);
    console.log("DATA LENGTH:", res.data.announcements?.length);
    console.log("FIRST ITEM:", JSON.stringify(res.data.announcements?.[0], null, 2));
  } catch (e: any) {
    console.error("API Error:", e.response?.status, e.message);
    if (e.response?.data) console.error("Details:", e.response.data);
  }
}
check();
