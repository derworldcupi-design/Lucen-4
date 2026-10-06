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
        Authorization: `Bearer ${key}`,
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
    console.error("OPENAI ERROR:", response.status, raw);

    throw new Error(
      data?.error?.message ||
      `OpenAI HTTP ${response.status}`
    );
  }

  return data;
}


/* -------------------------------------------------------
   TEXT AUS RESPONSE HOLEN
------------------------------------------------------- */

function getText(data) {

  if (
    typeof data?.output_text === "string" &&
    data.output_text.trim()
  ) {
    return data.output_text.trim();
  }

  let text = "";

  for (const item of data?.output || []) {

    if (item?.type !== "message") continue;

    for (const content of item?.content || []) {

      if (
        content?.type === "output_text" &&
        typeof content?.text === "string"
      ) {
        text += content.text;
      }

    }
  }

  return text.trim();
}


/* -------------------------------------------------------
   QUELLEN AUS WEB-SEARCH EXTRAHIEREN
------------------------------------------------------- */

function extractSources(data) {

  const sources = [];
  const seen = new Set();

  function addSource(source) {

    if (!source) return;

    const url =
      source.url ||
      source.href ||
      source.link;

    if (!url) return;

    if (seen.has(url)) return;

    seen.add(url);

    let domain = "";

    try {
      domain = new URL(url).hostname
        .replace(/^www\./, "");
    } catch {
      domain = "";
    }

    sources.push({
      id: `SRC-${String(sources.length + 1).padStart(2, "0")}`,

      title:
        source.title ||
        source.name ||
        domain ||
        "Webquelle",

      domain,

      url,

      snippet:
        source.snippet ||
        source.description ||
        "",

      status: "FOUND"
    });
  }


  /* -----------------------------------------------
     Responses API Output durchsuchen
  ------------------------------------------------ */

  for (const item of data?.output || []) {

    /*
      Web Search kann unterschiedliche Output-Strukturen
      liefern. Deshalb durchsuchen wir mehrere bekannte
      Ebenen.
    */

    if (
      item?.type === "web_search_call" ||
      item?.type === "web_search"
    ) {

      for (const result of item?.results || []) {
        addSource(result);
      }

      for (const result of item?.search_results || []) {
        addSource(result);
      }
    }


    /* Message / Output Text */

    if (item?.type === "message") {

      for (const content of item?.content || []) {

        const annotations =
          content?.annotations || [];

        for (const annotation of annotations) {

          if (
            annotation?.type ===
              "url_citation"
          ) {

            addSource({
              title:
                annotation.title ||
                annotation.text ||
                "Webquelle",

              url:
                annotation.url
            });

          }

        }

      }

    }
  }


  /* -----------------------------------------------
     Fallback: rekursiv nach URL-Citations suchen
  ------------------------------------------------ */

  function scan(value, depth = 0) {

    if (depth > 8) return;

    if (!value) return;

    if (Array.isArray(value)) {

      for (const item of value) {
        scan(item, depth + 1);
      }

      return;
    }

    if (typeof value !== "object") {
      return;
    }


    if (
      value.type === "url_citation" &&
      value.url
    ) {

      addSource({
        title:
          value.title ||
          value.text ||
          "Webquelle",

        url: value.url
      });
    }


    for (const key of Object.keys(value)) {

      if (
        key === "output_text" ||
        key === "instructions"
      ) {
        continue;
      }

      scan(value[key], depth + 1);
    }
  }

  scan(data);


  return sources.slice(0, 12);
}


/* -------------------------------------------------------
   ANALYSE-PHASEN
------------------------------------------------------- */

function buildAnalysis(sources, usedSearch) {

  if (!usedSearch) {

    return {
      status: "complete",

      modules: [
        "ANALYSIS",
        "AI CORE",
        "REASONING",
        "RESPONSE"
      ],

      phases: [
        {
          id: "analysis",
          label: "ANALYSIS",
          status: "complete"
        },
        {
          id: "ai",
          label: "AI CORE",
          status: "complete"
        },
        {
          id: "response",
          label: "RESPONSE",
          status: "complete"
        }
      ]
    };
  }


  return {

    status: "complete",

    modules: [
      "QUERY ANALYSIS",
      "WORLD SEARCH",
      "SOURCE DISCOVERY",
      "SOURCE PROCESSING",
      "CROSS CHECK",
      "SYNTHESIS",
      "RESPONSE"
    ],

    phases: [

      {
        id: "query",
        label: "QUERY ANALYSIS",
        status: "complete"
      },

      {
        id: "world",
        label: "WORLD SEARCH",
        status: "complete"
      },

      {
        id: "sources",
        label: "SOURCE DISCOVERY",
        status: sources.length
          ? "complete"
          : "partial",
        count: sources.length
      },

      {
        id: "processing",
        label: "SOURCE PROCESSING",
        status: "complete"
      },

      {
        id: "crosscheck",
        label: "CROSS CHECK",
        status: sources.length > 1
          ? "complete"
          : "partial"
      },

      {
        id: "synthesis",
        label: "SYNTHESIS",
        status: "complete"
      },

      {
        id: "response",
        label: "RESPONSE",
        status: "complete"
      }
    ]
  };
}


/* -------------------------------------------------------
   SUCHERKENNUNG
------------------------------------------------------- */

function shouldSearch(message) {

  const words = [

    "suche",
    "such",
    "internet",
    "web",
    "recherche",
    "recherchiere",

    "aktuell",
    "aktuelle",
    "aktuellen",
    "aktueller",

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
    "quellen",

    "vergleich",
    "vergleiche",

    "wer",
    "was",
    "wo",
    "wann",

    "latest",
    "recent"
  ];

  const lower =
    message.toLowerCase();

  return words.some(word =>
    lower.includes(word)
  );
}


/* -------------------------------------------------------
   SYSTEM
------------------------------------------------------- */

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

    const body =
      await req.json();

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


    const useWebSearch =
      shouldSearch(message);


    console.log(
      "LUCEN REQUEST:",
      message
    );

    console.log(
      "WEB SEARCH:",
      useWebSearch
    );


    /* =====================================================
       ECHTE WEB-RECHERCHE
    ===================================================== */

    if (useWebSearch) {

      const data =
        await callOpenAI({

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

Du führst eine echte aktuelle
Internet-Recherche für den Benutzer durch.

WICHTIGE REGELN:

1. Nutze die Websuche.
2. Verwende aktuelle Informationen.
3. Prüfe Informationen kritisch.
4. Erfinde niemals Quellen.
5. Erfinde niemals URLs.
6. Wenn mehrere Quellen verfügbar sind,
   vergleiche sie.
7. Antworte auf Deutsch, wenn der Benutzer
   Deutsch spricht.
8. Sei präzise und verständlich.
9. Gib am Ende eine kompakte Antwort.
10. Verwende Quellen aus der tatsächlichen
    Webrecherche.

LUCEN soll wie ein hochentwickelter
persönlicher Intelligence-Assistent arbeiten.
              `.trim()
            },

            {
              role: "user",

              content: message
            }

          ]
        });


      const answer =
        getText(data);


      const sources =
        extractSources(data);


      const analysis =
        buildAnalysis(
          sources,
          true
        );


      console.log(
        "SOURCES FOUND:",
        sources.length
      );


      return json({

        ok: true,

        success: true,

        type: "research",

        intent: "research",

        reply:
          answer ||
          "Die Recherche wurde durchgeführt, aber es konnte keine Antwort erzeugt werden.",

        sources,

        sourceCount:
          sources.length,

        analysis,

        research: {

          active: true,

          query: message,

          status: "complete",

          sources,

          sourceCount:
            sources.length,

          phases:
            analysis.phases

        },

        meta: {

          model: "gpt-5-mini",

          webSearch: true,

          generatedAt:
            new Date().toISOString()

        }

      });

    }


    /* =====================================================
       NORMALER CHAT
    ===================================================== */

    const data =
      await callOpenAI({

        model: "gpt-5-mini",

        input: [

          {
            role: "system",

            content: `
Du bist LUCEN, ein hochentwickelter
persönlicher KI-Assistent.

Sprich Deutsch, wenn der Benutzer
Deutsch spricht.

Sei:

ruhig,
intelligent,
präzise,
natürlich,
hilfreich.

Keine unnötig langen Antworten.

Wenn keine Internetrecherche
angefordert wurde, beantworte
die Frage direkt.
            `.trim()
          },

          {
            role: "user",

            content: message
          }

        ]

      });


    const answer =
      getText(data);


    return json({

      ok: true,

      success: true,

      type: "chat",

      intent: "chat",

      reply:
        answer ||
        "Verstanden.",

      sources: [],

      sourceCount: 0,

      analysis:
        buildAnalysis(
          [],
          false
        ),

      research: {

        active: false,

        query: null,

        status: "idle",

        sources: [],

        sourceCount: 0,

        phases: []

      },

      meta: {

        model: "gpt-5-mini",

        webSearch: false,

        generatedAt:
          new Date().toISOString()

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
        "LUCEN konnte die Anfrage momentan nicht verarbeiten."

    }, 500);

  }

}
