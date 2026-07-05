export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method tidak didukung." });
  }

  const backendUrl = process.env.BACKEND_URL?.replace(/\/$/, "");

  if (!backendUrl) {
    return response.status(500).json({
      error: "BACKEND_URL belum diset di environment variable Vercel.",
    });
  }

  try {
    const backendResponse = await fetch(`${backendUrl}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body || {}),
    });
    const payload = await backendResponse.json();

    return response.status(backendResponse.status).json(payload);
  } catch (error) {
    return response.status(502).json({
      error: `Gagal menghubungi backend model: ${error.message}`,
    });
  }
}
