const OpenAI = require("openai");

exports.handler = async function (event) {
  // Test: GET-Aufruf
  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        status: "LUCEN Function online",
        keyConfigured: !!process.env.OPENAI_API_KEY
      })
    };
  }

  // Nur POST für Chat
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Method not allowed"
      })
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = body.message;

    if (!message) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "Keine Nachricht erhalten"
        })
      };
    }

    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          error: "OPENAI_API_KEY fehlt in Netlify"
        })
      };
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        "Du bist LUCEN, ein persönlicher KI-Assistent. Antworte auf Deutsch, hilfreich, direkt und freundlich.",
      input: message
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reply: response.output_text
      })
    };

  } catch (error) {
    console.error("LUCEN ERROR:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: error.message || "LUCEN konnte die Anfrage nicht verarbeiten."
      })
    };
  }
};
