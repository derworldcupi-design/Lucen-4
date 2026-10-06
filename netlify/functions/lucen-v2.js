const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json"
    }
  });
}

async function callOpenAI(body) {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("OPENAI_API_KEY fehlt in Netlify.");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const raw = await response.text();

  let data;

  try {
    data = JSON.parse(raw);
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error("OPENAI:", response.status, raw);

    throw new Error(
      data?.error?.message ||
      `OpenAI HTTP ${response.status}`
    );
  }

  return data;
}

function getText(data) {
  if (data?.output_text) {
    return data.output_text.trim();
  }

  let text = "";

  for (const item of data?.output || []) {
    if (item.type !== "message") continue;

    for (const content of item.content || []) {
      if (
        content.type === "output_text" &&
        content.text
      ) {
        text += content.text;
      }
    }
  }

  return text.trim();
}

export default async function handler(req) {

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS
    });
  }

  if (req.method !== "POST") {
    return json({
      ok: false,
      error: "Method not allowed"
    }, 405);
  }

  try {

    const body = await req.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return json({
        ok: false,
        error: "Keine Nachricht erhalten."
      }, 400);
    }

    /*
     * ---------------------------------------
     * LUCEN INTERNET SEARCH
     * ---------------------------------------
     */

    const searchWords = [
      "suche",
      "such",
      "internet",
      "web",
      "recherche",
      "recherchiere",
      "aktuell",
      "aktuelle",
      "aktuellen",
      "heute",
      "heutige",
      "jetzt",
      "nachrichten",
      "news",
      "preis",
      "preise",
      "wetter",
      "öffnungszeiten",
      "quelle",
      "quellen"
    ];

    const lower = message.toLowerCase();

    const useWebSearch =
      searchWords.some(word =>
        lower.includes(word)
      );

    /*
     * ---------------------------------------
     * WEB SEARCH
     * ---------------------------------------
     */

    if (useWebSearch) {

      console.log(
        "LUCEN WEB SEARCH:",
        message
      );

      const data = await callOpenAI({

        model: "gpt-5-mini",

        tools: [
          {
            type: "web_search"
          }
        ],

        input: [
          {
            role: "system",
            content: `
Du bist LUCEN.

Der Benutzer möchte eine aktuelle
Internet-Recherche.

Nutze die Websuche.

Arbeite sorgfältig:
- aktuelle Informationen
- mehrere Quellen wenn sinnvoll
- keine erfundenen Informationen
- keine erfundenen Quellen
- Deutsch wenn der Benutzer Deutsch spricht
- kurz und verständlich antworten

Wenn Quelleninformationen verfügbar sind,
nenne die wichtigsten Quellen am Ende.
            `.trim()
          },
          {
            role: "user",
            content: message
          }
        ]
      });

      const answer = getText(data);

      return json({
        ok: true,
        success: true,
        type: "research",
        intent: "research",

        reply:
          answer ||
          "Die Websuche hat keine Antwort zurückgegeben.",

        analysis: {
          status: "complete",
          modules: [
            "ANALYSIS",
            "WORLD SEARCH",
            "WEB SEARCH",
            "SOURCE PROCESSING",
            "RESPONSE"
          ]
        }
      });
    }

    /*
     * ---------------------------------------
     * NORMAL CHAT
     * ---------------------------------------
     */

    const data = await callOpenAI({

      model: "gpt-5-mini",

      input: [
        {
          role: "system",
          content: `
Du bist LUCEN, ein hochentwickelter
persönlicher KI-Assistent.

Sprich Deutsch, wenn der Benutzer Deutsch spricht.

Sei:
ruhig,
intelligent,
präzise,
natürlich
und hilfreich.

Keine unnötig langen Antworten.
          `.trim()
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    return json({
      ok: true,
      success: true,
      type: "chat",
      intent: "chat",

      reply:
        getText(data) ||
        "Verstanden.",

      analysis: {
        status: "complete",
        modules: [
          "ANALYSIS",
          "AI CORE",
          "RESPONSE"
        ]
      }
    });

  } catch (error) {

    console.error(
      "LUCEN ERROR:",
      error
    );

    return json({
      ok: false,
      success: false,

      error:
        error?.message ||
        "Unbekannter Fehler",

      reply:
        "Die Internetverbindung von LUCEN konnte nicht hergestellt werden."
    }, 500);
  }
}
