export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (req.method !== "POST") {
    return json({
      ok: false,
      error: "Method not allowed"
    }, 405, headers);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return json({
      ok: false,
      error: "OPENAI_API_KEY fehlt in Netlify."
    }, 500, headers);
  }

  try {
    const body = await req.json();

    const query = String(
      body?.query ||
      body?.payload?.query ||
      ""
    ).trim();

    if (!query) {
      return json({
        ok: false,
        error: "Keine Recherchefrage angegeben."
      }, 400, headers);
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          tools: [
            {
              type: "web_search"
            }
          ],
          input: [
            {
              role: "system",
              content:
                "Du bist der Research-Agent von LUCEN. " +
                "Recherchiere sorgfältig im Web. " +
                "Bevorzuge aktuelle und zuverlässige Quellen. " +
                "Trenne Fakten, Unsicherheiten und Schlussfolgerungen. " +
                "Antworte auf Deutsch, wenn die Anfrage Deutsch ist."
            },
            {
              role: "user",
              content: query
            }
          ]
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "LUCEN RESEARCH ERROR:",
        raw
      );

      return json({
        ok: false,
        error: "Research API Fehler",
        status: response.status,
        details: raw
      }, response.status, headers);
    }

    const data = JSON.parse(raw);

    const answer =
      extractResponseText(data);

    return json({
      ok: true,
      action: "research",
      query,
      answer,
      responseId: data.id || null,
      raw: data
    }, 200, headers);

  } catch (error) {

    console.error(
      "LUCEN RESEARCH SERVER ERROR:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Research-Fehler."
    }, 500, headers);
  }
};


function extractResponseText(data) {

  if (
    typeof data?.output_text === "string"
  ) {
    return data.output_text;
  }

  const parts = [];

  for (const item of data?.output || []) {

    if (item?.type !== "message") {
      continue;
    }

    for (const content of item?.content || []) {

      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n\n").trim();
}


function json(data, status, headers) {
  return new Response(
    JSON.stringify(data, null, 2),
    {
      status,
      headers: {
        ...headers,
        "Content-Type":
          "application/json; charset=utf-8"
      }
    }
  );
}
