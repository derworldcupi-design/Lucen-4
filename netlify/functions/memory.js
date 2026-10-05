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
    return response({
      ok: false,
      error: "Method not allowed"
    }, 405, headers);
  }

  try {
    const body = await req.json();

    const action = body?.action;
    const payload = body?.payload || {};

    switch (action) {

      case "prepare": {
        const content =
          String(payload.content || "").trim();

        const category =
          String(payload.category || "general").trim();

        if (!content) {
          return response({
            ok: false,
            error: "Kein Memory-Inhalt angegeben."
          }, 400, headers);
        }

        const memory = {
          id: crypto.randomUUID(),
          content,
          category,
          importance:
            Number(payload.importance || 5),
          createdAt:
            new Date().toISOString()
        };

        return response({
          ok: true,
          action: "prepare",
          memory
        }, 200, headers);
      }


      case "search": {
        const query =
          String(payload.query || "").trim();

        return response({
          ok: true,
          action: "search",
          query,
          results: [],
          note:
            "Persistente Memory-Suche wird im nächsten Storage-Layer aktiviert."
        }, 200, headers);
      }


      case "delete": {
        const id =
          String(payload.id || "").trim();

        if (!id) {
          return response({
            ok: false,
            error: "Keine Memory-ID angegeben."
          }, 400, headers);
        }

        return response({
          ok: true,
          action: "delete",
          id,
          note:
            "Löschvorgang vorbereitet."
        }, 200, headers);
      }


      case "health":
        return response({
          ok: true,
          module: "LUCEN Memory Core",
          status: "online",
          persistentStorage: false,
          timestamp:
            new Date().toISOString()
        }, 200, headers);


      default:
        return response({
          ok: false,
          error: "Unbekannte Memory-Aktion.",
          availableActions: [
            "prepare",
            "search",
            "delete",
            "health"
          ]
        }, 400, headers);
    }

  } catch (error) {

    console.error(
      "LUCEN MEMORY ERROR:",
      error
    );

    return response({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Memory-Fehler."
    }, 500, headers);
  }
};


function response(data, status, headers) {
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
