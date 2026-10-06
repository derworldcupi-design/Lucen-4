// LUCEN v2 — MASTER TEXT + INTERNET CORE
// Voice / realtime.js bleibt unangetastet.

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
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

async function openAI(body) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt in Netlify.");
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error("OPENAI ERROR:", response.status, text);

    throw new Error(
      data?.error?.message ||
      `OpenAI Fehler ${response.status}`
    );
  }

  return data;
}

function getOutputText(data) {
  if (typeof data?.output_text === "string") {
    return data.output_text.trim();
  }

  let result = "";

  for (const item of data?.output || []) {
    if (item?.type !== "message") continue;

    for (const content of item?.content || []) {
      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        result += content.text;
      }
    }
  }

  return result.trim();
}

function wantsWebSearch(message) {
  const text = message.toLowerCase();

  const keywords = [
    "internet",
    "web",
    "online",
    "suche",
    "such",
    "recherchiere",
    "recherche",
    "aktuell",
    "aktuelle",
    "aktuellen",
    "heute",
    "heutige",
    "jetzt",
    "momentan",
    "news",
    "nachrichten",
    "preis",
    "preise",
    "kosten",
    "öffnungszeiten",
    "wetter",
    "google",
    "quelle",
    "quellen"
  ];

  return keywords.some(word => text.includes(word));
}

async function normalChat(message, context = "") {
  const data = await openAI({
    model: "gpt-5-mini",

    input: [
      {
        role: "system",
        content: `
Du bist LUCEN, ein hochentwickelter persönlicher KI-Assistent.

Sprache:
Antworte auf Deutsch, wenn der Benutzer Deutsch spricht.

Persönlichkeit:
ruhig, intelligent, souverän, natürlich,
präzise und hilfreich.

Sprich nicht unnötig lang.
Keine Roboterformulierungen.
Keine erfundenen Fakten.

Du bist der Text-Core von LUCEN.
        `.trim()
      },
      {
        role: "user",
        content: context
          ? `Kontext:\n${context}\n\nBenutzer:\n${message}`
          : message
      }
    ]
  });

  return getOutputText(data);
}

async function webSearch(message, context = "") {
  const data = await openAI({
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
Du bist LUCENs Internet-Rechercheeinheit.

Nutze die Websuche für aktuelle oder externe Informationen.

WICHTIG:
- Recherchiere tatsächlich im Internet.
- Erfinde keine Quellen.
- Wenn Informationen zeitabhängig sind, bevorzuge aktuelle Ergebnisse.
- Vergleiche Informationen, wenn mehrere Quellen sinnvoll sind.
- Antworte auf Deutsch, wenn der Benutzer Deutsch spricht.
- Sei präzise und verständlich.
- Nenne am Ende die wichtigsten verwendeten Quellen,
  sofern Quelleninformationen verfügbar sind.

Du kannst Informationen aus dem Internet analysieren
und anschließend verständlich für den Benutzer zusammenfassen.
        `.trim()
      },
      {
        role: "user",
        content: context
          ? `Kontext:\n${context}\n\nRechercheauftrag:\n${message}`
          : message
      }
    ]
  });

  return getOutputText(data);
}

async function calculate(message) {
  const expression = message
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-")
    .replace(/[^\d+\-*/().% ]/g, "")
    .trim();

  if (!expression) {
    return null;
  }

  if (!/^[\d+\-*/().% ]+$/.test(expression)) {
    return null;
  }

  try {
    const result = Function(
      `"use strict"; return (${expression})`
    )();

    if (!Number.isFinite(result)) {
      return null;
    }

    return result;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS
    });
  }

  // Nur POST
  if (req.method !== "POST") {
    return json(
      {
        ok: false,
        success: false,
        error: "Method not allowed"
      },
      405
    );
  }

  try {
    const body = await req.json();

    const message =
      typeof body?.message === "string"
        ? body.message.trim()
        : "";

    const context =
      typeof body?.context === "string"
        ? body.context
        : "";

    if (!message) {
      return json(
        {
          ok: false,
          success: false,
          error: "Keine Nachricht erhalten."
        },
        400
      );
    }

    console.log("LUCEN REQUEST:", message);

    // -----------------------------------------
    // CALCULATOR
    // -----------------------------------------

    const calculation =
      await calculate(message);

    const looksLikeCalculation =
      /^[\d\s()+\-*/%.×÷−]+$/.test(message);

    if (
      calculation !== null &&
      looksLikeCalculation
    ) {
      return json({
        ok: true,
        success: true,
        type: "calculation",
        intent: "calculation",

        reply:
          `Das Ergebnis ist ${calculation}.`,

        result: calculation,

        analysis: {
          status: "complete",
          modules: [
            "ANALYSIS",
            "CALCULATION"
          ]
        }
      });
    }

    // -----------------------------------------
    // INTERNET
    // -----------------------------------------

    if (wantsWebSearch(message)) {
      console.log("LUCEN MODE: WEB SEARCH");

      const answer =
        await webSearch(message, context);

      return json({
        ok: true,
        success: true,

        type: "research",
        intent: "research",

        reply:
          answer ||
          "Ich konnte keine verwertbare Information aus der Websuche erhalten.",

        query: message,

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

    // -----------------------------------------
    // NORMAL CHAT
    // -----------------------------------------

    console.log("LUCEN MODE: CHAT");

    const answer =
      await normalChat(message, context);

    return json({
      ok: true,
      success: true,

      type: "chat",
      intent: "chat",

      reply:
        answer ||
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
      "LUCEN MASTER ERROR:",
      error
    );

    return json(
      {
        ok: false,
        success: false,

        error:
          error?.message ||
          "Unbekannter Fehler",

        reply:
          "LUCEN konnte den KI-Core momentan nicht erreichen."
      },
      500
    );
  }
}
