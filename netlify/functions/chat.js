exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  // Gesundheitscheck
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
            "Du bist LUCEN, ein persönlicher KI-Assistent. Antworte auf Deutsch, klar, intelligent und direkt. Sei hilfreich und strukturiert. Wenn der Nutzer eine konkrete Aufgabe stellt, erledige sie statt unnötig nachzufragen.",
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
      data = {
        raw
      };
    }

    if (!openaiResponse.ok) {
      return {
        statusCode: openaiResponse.status,
        headers,
        body: JSON.stringify({
          ok: false,
          error:
            data?.error?.message ||
            "OpenAI hat einen Fehler zurückgegeben.",
          openai: data
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
          error: "OpenAI hat keine Textantwort geliefert.",
          debug: data
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        reply
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error?.message || "Unbekannter Serverfehler."
      })
    };
  }
};
