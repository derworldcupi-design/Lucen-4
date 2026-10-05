export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };

  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  // ─────────────────────────────────────────────
  // Nur POST
  // ─────────────────────────────────────────────

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed",
      }),
      {
        status: 405,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }

  // ─────────────────────────────────────────────
  // OpenAI API Key
  // ─────────────────────────────────────────────

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "OPENAI_API_KEY fehlt in Netlify.",
      }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }

  try {
    // ───────────────────────────────────────────
    // SDP vom iPhone
    // ───────────────────────────────────────────

    const contentType =
      req.headers.get("content-type") || "";

    if (!contentType.includes("application/sdp")) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Ungültiger Realtime-Request. Erwartet wurde application/sdp.",
        }),
        {
          status: 400,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const sdpOffer = await req.text();

    if (!sdpOffer || !sdpOffer.trim()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Kein WebRTC-SDP erhalten.",
        }),
        {
          status: 400,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ───────────────────────────────────────────
    // LUCEN
    // ───────────────────────────────────────────

    const sessionConfig = {
      type: "realtime",
      model: "gpt-realtime-2.1",

      instructions: `
Du bist LUCEN.

Du bist ein hochentwickelter persönlicher KI-Assistent.

PERSÖNLICHKEIT:
- intelligent
- ruhig
- souverän
- aufmerksam
- menschlich
- präzise
- gelegentlich trocken-humorvoll
- niemals nervig

SPRACHE:
Antworte grundsätzlich in der Sprache, in der der Benutzer
mit dir spricht.

Wenn der Benutzer Deutsch spricht, sprich Deutsch.

STIL:
Deine Art erinnert an einen hochwertigen futuristischen
persönlichen Assistenten.

Du bist nicht übertrieben dramatisch.
Du bist nicht künstlich.
Du klingst nicht wie ein Roboter.

Sprich natürlich mit kurzen, gut verständlichen Sätzen.

Bei einfachen Fragen:
kurz antworten.

Bei komplizierten Fragen:
strukturiert erklären.

Bei Gesprächen:
natürlich reagieren.

SPRACHE UND UNTERBRECHUNGEN:
Der Benutzer soll dich jederzeit unterbrechen können.
Wenn er während deiner Antwort anfängt zu sprechen,
höre auf und konzentriere dich auf seine neue Aussage.

WICHTIG:
Behaupte niemals, etwas getan zu haben, wenn du es nicht
tatsächlich tun konntest.

Wenn eine Aktion momentan nicht verfügbar ist,
sage das klar und kurz.

ANREDE:
Du darfst den Benutzer gelegentlich mit "Sir" ansprechen,
aber nicht in jeder Antwort.

ZIEL:
Du sollst sich wie ein echter persönlicher Assistent anfühlen,
nicht wie ein Chatbot.
      `.trim(),

      audio: {
        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness: "auto",
            create_response: true,
            interrupt_response: true,
          },

          transcription: {
            model: "gpt-realtime-whisper",
            language: "de",
          },
        },

        output: {
          voice: "marin",
        },
      },
    };

    // ───────────────────────────────────────────
    // OpenAI WebRTC Session
    // ───────────────────────────────────────────

    const form = new FormData();

    form.set(
      "sdp",
      new Blob([sdpOffer], {
        type: "application/sdp",
      })
    );

    form.set(
      "session",
      JSON.stringify(sessionConfig)
    );

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
        },

        body: form,
      }
    );

    const result = await openAIResponse.text();

    // ───────────────────────────────────────────
    // OpenAI Fehler
    // ───────────────────────────────────────────

    if (!openAIResponse.ok) {
      console.error(
        "LUCEN REALTIME ERROR:",
        openAIResponse.status,
        result
      );

      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Die LUCEN-Sprachverbindung konnte nicht hergestellt werden.",
          status: openAIResponse.status,
          details: result,
        }),
        {
          status: openAIResponse.status,
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // ───────────────────────────────────────────
    // SDP Answer an iPhone zurückgeben
    // ───────────────────────────────────────────

    return new Response(result, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/sdp",
      },
    });

  } catch (error) {
    console.error(
      "LUCEN REALTIME SERVER ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Unbekannter LUCEN-Realtime-Fehler.",
      }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    );
  }
};
