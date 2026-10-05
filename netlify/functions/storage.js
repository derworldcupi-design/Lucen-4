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

  try {
    const body = await req.json();

    const action = body?.action;
    const payload = body?.payload || {};

    switch (action) {

      // =====================================================
      // CREATE
      // =====================================================

      case "create": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        const data =
          payload.data || {};

        if (!collection) {
          return json({
            ok: false,
            error: "Keine Collection angegeben."
          }, 400, headers);
        }

        const record = {
          id: crypto.randomUUID(),
          collection,
          data,
          createdAt:
            new Date().toISOString()
        };

        return json({
          ok: true,
          action: "create",
          record,

          storage: {
            provider: "storage-layer",
            persistent: false,
            status: "prepared"
          },

          note:
            "Der Datensatz ist strukturell vorbereitet. " +
            "Der persistente Provider wird angeschlossen."
        }, 200, headers);
      }


      // =====================================================
      // READ
      // =====================================================

      case "read": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        const id =
          String(payload.id || "").trim();

        if (!collection || !id) {
          return json({
            ok: false,
            error:
              "Collection und ID werden benötigt."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "read",
          collection,
          id,
          record: null,
          storage: {
            persistent: false
          }
        }, 200, headers);
      }


      // =====================================================
      // LIST
      // =====================================================

      case "list": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        if (!collection) {
          return json({
            ok: false,
            error: "Keine Collection angegeben."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "list",
          collection,
          records: [],
          count: 0,
          storage: {
            persistent: false
          }
        }, 200, headers);
      }


      // =====================================================
      // UPDATE
      // =====================================================

      case "update": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        const id =
          String(payload.id || "").trim();

        const data =
          payload.data || {};

        if (!collection || !id) {
          return json({
            ok: false,
            error:
              "Collection und ID werden benötigt."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "update",
          collection,
          id,
          data,
          storage: {
            persistent: false
          }
        }, 200, headers);
      }


      // =====================================================
      // DELETE
      // =====================================================

      case "delete": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        const id =
          String(payload.id || "").trim();

        if (!collection || !id) {
          return json({
            ok: false,
            error:
              "Collection und ID werden benötigt."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "delete",
          collection,
          id,
          storage: {
            persistent: false
          }
        }, 200, headers);
      }


      // =====================================================
      // SEARCH
      // =====================================================

      case "search": {

        const collection =
          sanitizeCollection(
            payload.collection
          );

        const query =
          String(payload.query || "")
            .trim()
            .toLowerCase();

        if (!collection) {
          return json({
            ok: false,
            error: "Keine Collection angegeben."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "search",
          collection,
          query,
          results: [],
          count: 0,
          storage: {
            persistent: false
          }
        }, 200, headers);
      }


      // =====================================================
      // HEALTH
      // =====================================================

      case "health":

        return json({
          ok: true,
          module:
            "LUCEN Storage Core",

          status: "online",

          storage: {
            configured: false,
            persistent: false,
            provider: null
          },

          timestamp:
            new Date().toISOString()
        }, 200, headers);


      // =====================================================
      // UNKNOWN
      // =====================================================

      default:

        return json({
          ok: false,
          error:
            "Unbekannte Storage-Aktion.",

          availableActions: [
            "create",
            "read",
            "list",
            "update",
            "delete",
            "search",
            "health"
          ]
        }, 400, headers);
    }

  } catch (error) {

    console.error(
      "LUCEN STORAGE ERROR:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Storage-Fehler."
    }, 500, headers);
  }
};


// =========================================================
// HELPERS
// =========================================================

function sanitizeCollection(value) {

  const collection =
    String(value || "")
      .trim()
      .toLowerCase();

  if (!collection) {
    return null;
  }

  if (
    !/^[a-z0-9_-]{1,64}$/.test(
      collection
    )
  ) {
    return null;
  }

  return collection;
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
