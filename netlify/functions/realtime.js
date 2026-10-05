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
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "OPENAI_API_KEY fehlt in Netlify."
      }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    const sdpOffer = await req.text();

    if (!sdpOffer || !sdpOffer.trim()) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Kein SDP vom iPhone erhalten."
        }),
        {
          status: 400,
          headers: {
            ...headers,
            "Content-Type": "application/json"
          }
        }
      );
    }

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-realtime-2.1",

      instructions: `
Du bist LUCEN, ein hochentwickelter persönlicher KI-Assistent.

Sprich Deutsch, wenn der Benutzer Deutsch spricht.

Deine Persönlichkeit:
ruhig, intelligent, souverän, aufmerksam,
menschlich und präzise.

Sprich natürlich und direkt.
Keine Roboterformulierungen.
Keine unnötig langen Antworten.

Du darfst den Benutzer gelegentlich mit "Sir"
ansprechen, aber nicht ständig.

Du sollst dich wie ein hochwertiger futuristischer
persönlicher Assistent anfühlen.

Wenn der Benutzer dich unterbricht,
höre auf und konzentriere dich auf seine neue Aussage.
      `.trim(),

      audio: {
        output: {
          voice: "marin"
        },

        input: {
          turn_detection: {
            type: "semantic_vad",
            eagerness: "auto",
            create_response: true,
            interrupt_response: true
          }
        }
      }
    });

    const form = new FormData();

    // SDP direkt als String
    form.set("sdp", sdpOffer);

    // Session-Konfiguration direkt als String
    form.set("session", sessionConfig);

    const openAIResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        body: form
      }
    );

    const result = await openAIResponse.text();

    console.log(
      "OPENAI REALTIME STATUS:",
      openAIResponse.status
    );

    if (!openAIResponse.ok) {
      console.error(
        "OPENAI REALTIME ERROR:",
        result
      );

      return new Response(
        JSON.stringify({
          ok: false,
          error: "OpenAI Realtime Fehler",
          status: openAIResponse.status,
          details: result
        }),
        {
          status: openAIResponse.status,
          headers: {
            ...headers,
            "Content-Type": "application/json"
          }
        }
      );
    }

    return new Response(result, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/sdp"
      }
    });

  } catch (error) {

    console.error(
      "REALTIME SERVER ERROR:",
      error
    );

    return new Response(
      JSON.stringify({
        ok: false,
        error:
          error?.message ||
          "Unbekannter Realtime-Fehler"
      }),
      {
        status: 500,
        headers: {
          ...headers,
          "Content-Type": "application/json"
        }
      }
    );
  }
};
