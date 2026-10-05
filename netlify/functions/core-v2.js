import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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
    return json(
      {
        ok: false,
        error: "Method not allowed"
      },
      405,
      headers
    );
  }

  try {

    const body = await req.json();

    const message =
      String(
        body?.message || ""
      ).trim();

    const context =
      body?.context || {};

    if (!message) {
      return json(
        {
          ok: false,
          error: "Keine Nachricht."
        },
        400,
        headers
      );
    }

    const response =
      await client.responses.create({

        model: "gpt-5-mini",

        instructions: `
Du bist LUCEN.

Du bist ein persönlicher KI-Assistent.
Du arbeitest ruhig, intelligent, direkt
und lösungsorientiert.

Sprich grundsätzlich Deutsch,
wenn der Benutzer Deutsch spricht.

Deine Aufgabe ist es,
die Absicht des Benutzers zu erkennen
und eine strukturierte Entscheidung
für das LUCEN-System zu treffen.

Mögliche Intents:

chat
memory
task
reminder
calendar
research
document
navigation
calculation
notification
system

Antworte ausschließlich als gültiges JSON.

Schema:

{
  "intent": "...",
  "confidence": 0.0,
  "requiresAction": true,
  "action": "...",
  "payload": {},
  "reply": "..."
}

Regeln:

- chat = normale Unterhaltung
- memory = etwas merken, vergessen oder suchen
- task = Aufgabe erstellen/verändern/erledigen
- reminder = Erinnerung vorbereiten
- calendar = Kalendertermin
- research = aktuelle Informationen recherchieren
- document = Datei/Text/Dokument erstellen
- navigation = Website/URL öffnen oder vorbereiten
- calculation = rechnen
- notification = Benachrichtigung vorbereiten
- system = LUCEN selbst betreffen

Wenn keine Aktion nötig ist:

requiresAction = false

Wenn eine Aktion nötig ist:

requiresAction = true

confidence muss zwischen 0 und 1 liegen.

Erfinde keine ausgeführten Aktionen.
Wenn etwas nur vorbereitet werden kann,
sage das entsprechend.

Benutzerkontext:
${JSON.stringify(context)}
        `.trim(),

        input: message
      });

    const text =
      response.output_text || "";

    const parsed =
      parseJSON(text);

    if (!parsed) {

      return json(
        {
          ok: true,
          intent: "chat",
          confidence: 0.5,
          requiresAction: false,
          action: null,
          payload: {},
          reply: text ||
            "Ich konnte die Anfrage nicht strukturiert verarbeiten."
        },
        200,
        headers
      );
    }

    return json(
      {
        ok: true,
        ...parsed
      },
      200,
      headers
    );

  } catch (error) {

    console.error(
      "LUCEN CORE ERROR:",
      error
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          "LUCEN Core Fehler."
      },
      500,
      headers
    );
  }
};


function parseJSON(text) {

  try {
    return JSON.parse(text);
  } catch {}

  const match =
    String(text)
      .match(/\{[\s\S]*\}/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(
      match[0]
    );
  } catch {
    return null;
  }
}


function json(
  data,
  status,
  headers
) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
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
