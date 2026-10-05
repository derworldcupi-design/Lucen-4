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

    const message = String(
      body?.message ||
      body?.input ||
      ""
    ).trim();

    if (!message) {
      return json({
        ok: false,
        error: "Keine Anfrage angegeben."
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

          instructions: `
Du bist der zentrale Agent von LUCEN.

Deine Aufgabe ist es, Benutzeranfragen zu analysieren
und zu entscheiden, welche Fähigkeit benötigt wird.

Mögliche Fähigkeiten:

- chat
- research
- calculator
- reminder
- calendar
- notification
- memory
- document
- task
- navigation

Antworte IMMER mit gültigem JSON.

Format:

{
  "intent": "...",
  "needsAction": true,
  "action": "...",
  "payload": {},
  "reply": "..."
}

Regeln:

1. Verwende "research", wenn aktuelle Informationen
   aus dem Internet benötigt werden.

2. Verwende "calculator" für Berechnungen.

3. Verwende "reminder" für Erinnerungen.

4. Verwende "calendar" für Termine.

5. Verwende "notification" für Benachrichtigungen.

6. Verwende "memory", wenn der Benutzer ausdrücklich
   möchte, dass LUCEN sich etwas merkt oder vergisst.

7. Verwende "document", wenn eine Datei oder ein
   Dokument erstellt werden soll.

8. Verwende "task" für Aufgaben und To-do-Aktionen.

9. Verwende "navigation" wenn eine Website oder URL
   geöffnet werden soll.

10. Verwende "chat", wenn keine externe Aktion
    erforderlich ist.

Niemals behaupten, eine Aktion sei bereits ausgeführt,
wenn sie lediglich vorbereitet wurde.
          `.trim(),

          input: message
        })
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      console.error(
        "LUCEN AGENT ERROR:",
        raw
      );

      return json({
        ok: false,
        error: "Agent API Fehler",
        status: response.status,
        details: raw
      }, response.status, headers);
    }

    const data = JSON.parse(raw);

    const text =
      extractResponseText(data);

    const decision =
      parseAgentJSON(text);

    return json({
      ok: true,
      agent: "LUCEN",
      decision,
      responseId:
        data.id || null
    }, 200, headers);

  } catch (error) {

    console.error(
      "LUCEN AGENT SERVER ERROR:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Agent-Fehler."
    }, 500, headers);
  }
};


function extractResponseText(data) {

  if (
    typeof data?.output_text === "string"
  ) {
    return data.output_text.trim();
  }

  const parts = [];

  for (const item of data?.output || []) {

    if (item?.type !== "message") {
      continue;
    }

    for (const content of item?.content || []) {

      if (
        content?.type === "output_text" &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("\n").trim();
}


function parseAgentJSON(text) {

  try {
    return JSON.parse(text);
  } catch {}

  const match =
    text.match(/\{[\s\S]*\}/);

  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  return {
    intent: "chat",
    needsAction: false,
    action: "chat",
    payload: {},
    reply: text
  };
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
