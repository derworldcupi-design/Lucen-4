exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        lucen: "online",
        apiKeyConfigured: !!process.env.OPENAI_API_KEY
      })
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Method not allowed"
      })
    };
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "OPENAI_API_KEY fehlt in Netlify."
        })
      };
    }

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Ungültige Anfrage."
        })
      };
    }

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (!message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Keine Nachricht erhalten."
        })
      };
    }

    /* =========================
       LUCEN TEXT RESPONSE
       ========================= */

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          instructions:
            `Du bist LUCEN, ein hochentwickelter persönlicher KI-Assistent.

Antworte auf Deutsch.
Sei intelligent, ruhig, natürlich und menschlich.
Sprich nicht wie ein Roboter.
Keine unnötigen Einleitungen.
Bei einfachen Fragen kurz antworten.
Bei komplexen Aufgaben strukturiert helfen.
Wenn der Nutzer eine konkrete Aufgabe stellt, erledige sie direkt.`,
          input: message,
          max_output_tokens: 1200
        })
      }
    );

    const raw = await openaiResponse.text();

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!openaiResponse.ok) {
      return {
        statusCode: openaiResponse.status,
        headers,
        body: JSON.stringify({
          ok: false,
          error:
            data?.error?.message ||
            "OpenAI hat einen Fehler zurückgegeben."
        })
      };
    }

    const reply =
      data?.output_text ||
      data?.output
        ?.flatMap(item => item?.content || [])
        ?.map(item => item?.text || "")
        ?.join("")
        ?.trim();

    if (!reply) {
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "Keine Textantwort von LUCEN."
        })
      };
    }

    /* =========================
       LUCEN NATURAL VOICE
       ========================= */

    const speechResponse = await fetch(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",

          /*
            MARIN = sehr natürlich
            CEDAR = ebenfalls sehr hochwertig

            Wir starten mit MARIN.
          */
          voice: "marin",

          input: reply,

          instructions:
            `Sprich auf Deutsch.

Die Stimme soll wirken wie ein hochwertiger,
menschlicher persönlicher KI-Assistent.

Ruhig.
Souverän.
Warm.
Intelligent.
Natürlich.

Keine übertriebene Schauspielstimme.
Keine Roboterstimme.
Leichte natürliche Betonungen und Pausen.
Sprich klar und nicht zu schnell.
Klinge wie ein moderner futuristischer Assistent.`,

          response_format: "mp3",
          speed: 0.95
        })
      }
    );

    if (!speechResponse.ok) {

      const speechError =
        await speechResponse.text();

      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({
          ok: true,
          reply,
          audioError:
            speechError ||
            "Sprachausgabe konnte nicht erzeugt werden."
        })
      };
    }

    const audioBuffer =
      Buffer.from(
        await speechResponse.arrayBuffer()
      );

    /* =========================
       RETURN AUDIO AS BASE64
       ========================= */

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        reply,

        audio: audioBuffer.toString("base64"),

        audioType: "audio/mpeg"
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Unbekannter Serverfehler."
      })
    };
  }
};
