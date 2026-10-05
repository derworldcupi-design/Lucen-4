const BASE_URL =
  "https://zingy-alpaca-672918.netlify.app/.netlify/functions";

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
    return response(
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
      return response(
        {
          ok: false,
          error: "Keine Nachricht."
        },
        400,
        headers
      );
    }

    // =====================================================
    // 1. CORE → INTENT ERKENNEN
    // =====================================================

    const core =
      await callFunction(
        "/core-v2",
        {
          message,
          context
        }
      );

    if (!core.ok) {
      return response(
        {
          ok: false,
          stage: "core",
          error:
            core.error ||
            "Core konnte Anfrage nicht verarbeiten."
        },
        500,
        headers
      );
    }

    const intent =
      core.intent || "chat";

    const action =
      core.action || null;

    const payload =
      core.payload || {};

    // =====================================================
    // 2. CHAT
    // =====================================================

    if (
      intent === "chat" ||
      !core.requiresAction
    ) {

      return response(
        {
          ok: true,
          type: "chat",
          intent,
          reply:
            core.reply ||
            "Verstanden.",
          core
        },
        200,
        headers
      );
    }

    // =====================================================
    // 3. MEMORY
    // =====================================================

    if (intent === "memory") {

      const result =
        await callFunction(
          "/memory-v2",
          {
            action:
              action ||
              "remember",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "memory",
          intent,
          result,
          reply:
            core.reply ||
            "Erledigt."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 4. TASK
    // =====================================================

    if (intent === "task") {

      const result =
        await callFunction(
          "/tasks-v2",
          {
            action:
              action ||
              "create",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "task",
          intent,
          result,
          reply:
            core.reply ||
            "Aufgabe verarbeitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 5. RESEARCH
    // =====================================================

    if (intent === "research") {

      const result =
        await callFunction(
          "/research",
          {
            query:
              payload.query ||
              message,
            context
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "research",
          intent,
          result,
          reply:
            core.reply ||
            result.answer ||
            "Recherche abgeschlossen."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 6. CALCULATION
    // =====================================================

    if (intent === "calculation") {

      const result =
        await callFunction(
          "/actions",
          {
            action: "calculate",
            payload: {
              expression:
                payload.expression ||
                message
            }
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "calculation",
          intent,
          result,
          reply:
            core.reply ||
            "Berechnung abgeschlossen."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 7. DOCUMENT
    // =====================================================

    if (intent === "document") {

      const result =
        await callFunction(
          "/actions",
          {
            action:
              action ||
              "create_text",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "document",
          intent,
          result,
          reply:
            core.reply ||
            "Dokument vorbereitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 8. CALENDAR
    // =====================================================

    if (intent === "calendar") {

      const result =
        await callFunction(
          "/actions",
          {
            action:
              "create_calendar_event",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "calendar",
          intent,
          result,
          reply:
            core.reply ||
            "Kalendereintrag vorbereitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 9. REMINDER
    // =====================================================

    if (intent === "reminder") {

      const result =
        await callFunction(
          "/notifications",
          {
            action:
              action ||
              "prepare_reminder",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "reminder",
          intent,
          result,
          reply:
            core.reply ||
            "Erinnerung vorbereitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 10. NOTIFICATION
    // =====================================================

    if (intent === "notification") {

      const result =
        await callFunction(
          "/notifications",
          {
            action:
              action ||
              "prepare_notification",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "notification",
          intent,
          result,
          reply:
            core.reply ||
            "Benachrichtigung vorbereitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 11. NAVIGATION
    // =====================================================

    if (intent === "navigation") {

      const result =
        await callFunction(
          "/actions",
          {
            action: "prepare_url",
            payload
          }
        );

      return response(
        {
          ok: result.ok !== false,
          type: "navigation",
          intent,
          result,
          reply:
            core.reply ||
            "Navigation vorbereitet."
        },
        200,
        headers
      );
    }

    // =====================================================
    // 12. SYSTEM
    // =====================================================

    if (intent === "system") {

      return response(
        {
          ok: true,
          type: "system",
          intent,
          reply:
            core.reply ||
            "LUCEN-System bereit.",
          core
        },
        200,
        headers
      );
    }

    // =====================================================
    // FALLBACK
    // =====================================================

    return response(
      {
        ok: true,
        type: "chat",
        intent,
        reply:
          core.reply ||
          "Ich habe die Anfrage verstanden.",
        core
      },
      200,
      headers
    );

  } catch (error) {

    console.error(
      "LUCEN ORCHESTRATOR ERROR:",
      error
    );

    return response(
      {
        ok: false,
        error:
          error?.message ||
          "LUCEN Gateway Fehler."
      },
      500,
      headers
    );
  }
};


// =========================================================
// INTERNAL FUNCTION CALL
// =========================================================

async function callFunction(
  path,
  body
) {

  const response =
    await fetch(
      `${BASE_URL}${path}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body:
          JSON.stringify(body)
      }
    );

  const text =
    await response.text();

  let data;

  try {
    data =
      JSON.parse(text);
  } catch {
    data = {
      ok: false,
      error: text
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      ...data
    };
  }

  return data;
}


function response(
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
