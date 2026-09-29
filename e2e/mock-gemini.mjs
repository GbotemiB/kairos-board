// Minimal stand-in for the Gemini API used by end-to-end tests. The app's
// Gemini SDK is pointed here with GOOGLE_GEMINI_BASE_URL, so no test-only code
// exists in the app itself. Records requests so tests can assert on them.
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_GEMINI_PORT ?? 4010);

export const EXTRACTION = {
  title: "Robotics Summer School 2027",
  organization: "Example Tech University",
  type: "PROGRAM",
  opensAt: null,
  deadline: "2027-03-01",
  deadlineType: "FIXED",
  eligibility: ["Master's students in robotics or mechanical engineering"],
  location: "Delft, Netherlands",
  field: "Robotics",
  funding: "Free tuition and a 500 EUR travel grant",
  applicationsClosed: false,
  openToMasters: "YES",
};

let requests = [];

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function json(res, status, value) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/__health") return json(res, 200, { ok: true });
  if (req.method === "GET" && req.url === "/__requests") return json(res, 200, requests);
  if (req.method === "POST" && req.url === "/__reset") {
    requests = [];
    return json(res, 200, { ok: true });
  }
  if (req.method === "POST" && req.url?.includes(":generateContent")) {
    const body = JSON.parse(await readBody(req));
    const prompt = body.contents?.[0]?.parts?.map((part) => part.text).join("") ?? "";
    requests.push({ url: req.url, prompt });
    return json(res, 200, {
      candidates: [
        {
          content: { role: "model", parts: [{ text: JSON.stringify(EXTRACTION) }] },
          finishReason: "STOP",
        },
      ],
    });
  }
  json(res, 404, {
    error: { code: 404, message: `mock-gemini: no route for ${req.method} ${req.url}` },
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`mock-gemini listening on http://127.0.0.1:${PORT}`);
});
