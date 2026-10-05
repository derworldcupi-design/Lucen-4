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
      { ok: false, error: "Method not allowed" },
      405,
      headers
    );
  }

  try {
    const body = await req.json();

    const message = String(
      body?.message || ""
    ).trim();

    if (!message) {
      return json(
        {
          ok: false,
          error: "Keine Anfrage angegeben."
        },
        400,
        headers
      );
    }

    const origin = new URL(req.url).origin;

    // 1. Agent entscheidet, was gebraucht wird
    const agentResponse = await fetch(
      `${origin}/.netlify/functions/agent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message
        })
      }
    );

    const agent = await agentResponse.json();

    if (!agentResponse.ok || !agent.ok) {
      return json(
        {
          ok: false,
          stage: "agent",
          error: agent.error || "Agent fehlgeschlagen."
        },
        agentResponse.status || 500,
        headers
      );
    }

    const decision = agent.decision || {};

    // 2. Keine Aktion nötig
    if (!decision.needsAction) {
      return json(
        {
          ok: true,
          mode: "chat",
          decision,
          reply:
            decision.reply ||
            "Verstanden."
        },
        200,
        headers
      );
    }

    const action = decision.action;
    const payload = decision.payload || {};

    // 3. Fähigkeiten ausführen
    let result;

    switch (action) {

      case "research":

        result = await callFunction(
          origin,
          "research",
          {
            query:
              payload.query ||
              message
          }
        );

        break;


      case "calculator":

        result = await callFunction(
          origin,
          "actions",
          {
            action: "calculate",
            payload
          }
        );

        break;


      case "reminder":

        result = await callFunction(
          origin,
          "notifications",
          {
            action: "create",
            payload
          }
        );

        break;


      case "calendar":

        result = await callFunction(
          origin,
          "actions",
          {
            action: "create_calendar_event",
            payload
          }
        );

        break;


      case "notification":

        result = await callFunction(
          origin,
          "notifications",
          {
            action: "create",
            payload
          }
        );

        break;


      case "memory":

        result = await callFunction(
          origin,
          "memory",
          {
            action:
              payload.operation ||
              "prepare",
            payload
          }
        );

        break;


      case "document":

        result = await callFunction(
          origin,
          "actions",
          {
            action:
              payload.format === "markdown"
                ? "create_markdown"
                : "create_text",
            payload
          }
        );

        break;


      case "task":

        result = await callFunction(
          origin,
          "actions",
          {
            action: "create_task",
            payload
          }
        );

        break;


      case "navigation":

        result = await callFunction(
          origin,
          "actions",
          {
            action: "prepare_url",
            payload
          }
        );

        break;


      default:

        return json(
          {
            ok: false,
            error:
              `Unbekannte Agent-Aktion: ${action}`
          },
          400,
          headers
        );
    }

    // 4. Gesamtergebnis
    return json(
      {
        ok: true,
        mode: "agent",
        request: message,
        decision,
        result
      },
      200,
      headers
    );

  } catch (error) {

    console.error(
      "LUCEN ORCHESTRATOR ERROR:",
      error
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          "Unbekannter Orchestrator-Fehler."
      },
      500,
      headers
    );
  }
};


async function callFunction(
  origin,
  functionName,
  body
) {

  const response = await fetch(
    `${origin}/.netlify/functions/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  const text =
    await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      ok: response.ok,
      raw: text
    };
  }

  return {
    status: response.status,
    ...data
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
