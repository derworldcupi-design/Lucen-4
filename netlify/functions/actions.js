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

    const action = body?.action;
    const payload = body?.payload || {};

    if (!action) {
      return json(
        {
          ok: false,
          error: "Keine Aktion angegeben."
        },
        400,
        headers
      );
    }

    switch (action) {

      // =====================================================
      // SYSTEM
      // =====================================================

      case "ping":
        return json({
          ok: true,
          action: "ping",
          message: "LUCEN Action Core online.",
          timestamp: new Date().toISOString()
        }, 200, headers);


      case "time":
        return json({
          ok: true,
          action: "time",
          timestamp: new Date().toISOString(),
          unix: Date.now()
        }, 200, headers);


      case "device_info":
        return json({
          ok: true,
          action: "device_info",
          server: "Netlify Functions",
          runtime: "LUCEN Action Core",
          timestamp: new Date().toISOString()
        }, 200, headers);


      // =====================================================
      // CALCULATOR
      // =====================================================

      case "calculate": {
        const expression = String(payload.expression || "").trim();

        if (!expression) {
          return json({
            ok: false,
            error: "Keine Rechnung angegeben."
          }, 400, headers);
        }

        const result = safeCalculate(expression);

        if (result === null) {
          return json({
            ok: false,
            error: "Rechnung konnte nicht sicher berechnet werden."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "calculate",
          expression,
          result
        }, 200, headers);
      }


      // =====================================================
      // TEXT / DOCUMENT CREATION
      // =====================================================

      case "create_text": {
        const filename = sanitizeFilename(
          payload.filename || "lucen-document.txt"
        );

        const content = String(payload.content || "");

        return new Response(content, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition":
              `attachment; filename="${filename}"`
          }
        });
      }


      case "create_markdown": {
        const filename = sanitizeFilename(
          payload.filename || "lucen-document.md"
        );

        const content = String(payload.content || "");

        return new Response(content, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition":
              `attachment; filename="${filename}"`
          }
        });
      }


      // =====================================================
      // CALENDAR
      // =====================================================

      case "create_calendar_event": {
        const title = String(
          payload.title || "LUCEN Termin"
        );

        const description = String(
          payload.description || ""
        );

        const location = String(
          payload.location || ""
        );

        const start = normalizeDate(
          payload.start
        );

        const end = normalizeDate(
          payload.end
        );

        if (!start || !end) {
          return json({
            ok: false,
            error:
              "Für den Kalender werden gültige start- und end-Daten benötigt."
          }, 400, headers);
        }

        const ics = createICS({
          title,
          description,
          location,
          start,
          end
        });

        return new Response(ics, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type":
              "text/calendar; charset=utf-8",
            "Content-Disposition":
              'attachment; filename="lucen-termin.ics"'
          }
        });
      }


      // =====================================================
      // REMINDER DATA
      // =====================================================

      case "create_reminder": {
        const title = String(
          payload.title || "LUCEN Erinnerung"
        );

        const reminderTime =
          normalizeDate(payload.time);

        if (!reminderTime) {
          return json({
            ok: false,
            error: "Keine gültige Erinnerungszeit."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "create_reminder",
          reminder: {
            id: crypto.randomUUID(),
            title,
            time: reminderTime,
            createdAt: new Date().toISOString()
          },
          note:
            "Reminder-Daten wurden erstellt. Dauerhafte Push-Erinnerungen benötigen im nächsten Schritt den Notification-/Storage-Layer."
        }, 200, headers);
      }


      // =====================================================
      // URL / NAVIGATION DATA
      // =====================================================

      case "prepare_url": {
        const url = String(payload.url || "").trim();

        if (!/^https?:\/\//i.test(url)) {
          return json({
            ok: false,
            error: "Nur HTTP/HTTPS URLs sind erlaubt."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "prepare_url",
          url
        }, 200, headers);
      }


      // =====================================================
      // MEMORY OBJECT
      // =====================================================

      case "prepare_memory": {
        const memory = {
          id: crypto.randomUUID(),
          content: String(payload.content || ""),
          category: String(
            payload.category || "general"
          ),
          createdAt: new Date().toISOString()
        };

        return json({
          ok: true,
          action: "prepare_memory",
          memory,
          note:
            "Memory-Objekt vorbereitet. Dauerhafte Speicherung wird im Memory-Layer angeschlossen."
        }, 200, headers);
      }


      // =====================================================
      // AGENT TASK
      // =====================================================

      case "create_task": {
        const task = {
          id: crypto.randomUUID(),
          title: String(
            payload.title || "LUCEN Aufgabe"
          ),
          description: String(
            payload.description || ""
          ),
          priority: String(
            payload.priority || "normal"
          ),
          status: "created",
          createdAt: new Date().toISOString()
        };

        return json({
          ok: true,
          action: "create_task",
          task
        }, 200, headers);
      }


      // =====================================================
      // HEALTH CHECK
      // =====================================================

      case "health": {
        return json({
          ok: true,
          system: "LUCEN",
          actionCore: true,
          timestamp: new Date().toISOString(),
          capabilities: {
            voice: "external/realtime",
            calculator: true,
            documents: true,
            markdown: true,
            calendar: true,
            reminders: true,
            memory: true,
            tasks: true,
            urlPreparation: true
          }
        }, 200, headers);
      }


      // =====================================================
      // UNKNOWN ACTION
      // =====================================================

      default:
        return json({
          ok: false,
          error: `Unbekannte Aktion: ${action}`,
          availableActions: [
            "ping",
            "time",
            "device_info",
            "calculate",
            "create_text",
            "create_markdown",
            "create_calendar_event",
            "create_reminder",
            "prepare_url",
            "prepare_memory",
            "create_task",
            "health"
          ]
        }, 400, headers);
    }

  } catch (error) {

    console.error(
      "LUCEN ACTION CORE ERROR:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Action-Core-Fehler"
    }, 500, headers);
  }
};


// =========================================================
// HELPERS
// =========================================================

function json(data, status = 200, headers = {}) {
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


function sanitizeFilename(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}


function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}


function safeCalculate(expression) {
  let clean = expression
    .replace(/,/g, ".")
    .replace(/\s+/g, "");

  if (!/^[0-9+\-*/().%]+$/.test(clean)) {
    return null;
  }

  if (!/[0-9]/.test(clean)) {
    return null;
  }

  try {
    const tokens = tokenize(clean);

    if (!tokens.length) {
      return null;
    }

    const rpn = toRPN(tokens);

    return evaluateRPN(rpn);

  } catch {
    return null;
  }
}


function tokenize(expression) {
  const regex =
    /(\d+(?:\.\d+)?|[()+\-*/%])/g;

  const tokens =
    expression.match(regex);

  if (!tokens) {
    throw new Error("Invalid expression");
  }

  if (
    tokens.join("") !== expression
  ) {
    throw new Error("Invalid characters");
  }

  return tokens;
}


function toRPN(tokens) {
  const output = [];
  const operators = [];

  const precedence = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "%": 2
  };

  let previous = null;

  for (let token of tokens) {

    if (!Number.isNaN(Number(token))) {
      output.push(token);
      previous = "number";
      continue;
    }

    if (token === "(") {
      operators.push(token);
      previous = "(";
      continue;
    }

    if (token === ")") {

      while (
        operators.length &&
        operators[operators.length - 1] !== "("
      ) {
        output.push(operators.pop());
      }

      if (
        operators.pop() !== "("
      ) {
        throw new Error("Mismatched parentheses");
      }

      previous = ")";
      continue;
    }

    if (
      ["+", "-", "*", "/", "%"].includes(token)
    ) {

      // unary minus
      if (
        token === "-" &&
        (previous === null ||
          previous === "operator" ||
          previous === "(")
      ) {
        output.push("0");
      }

      while (
        operators.length &&
        operators[operators.length - 1] !== "(" &&
        precedence[
          operators[operators.length - 1]
        ] >= precedence[token]
      ) {
        output.push(operators.pop());
      }

      operators.push(token);
      previous = "operator";
    }
  }

  while (operators.length) {
    const op = operators.pop();

    if (op === "(") {
      throw new Error("Mismatched parentheses");
    }

    output.push(op);
  }

  return output;
}


function evaluateRPN(tokens) {
  const stack = [];

  for (const token of tokens) {

    if (!isNaN(Number(token))) {
      stack.push(Number(token));
      continue;
    }

    const b = stack.pop();
    const a = stack.pop();

    if (
      a === undefined ||
      b === undefined
    ) {
      throw new Error("Invalid calculation");
    }

    let result;

    switch (token) {

      case "+":
        result = a + b;
        break;

      case "-":
        result = a - b;
        break;

      case "*":
        result = a * b;
        break;

      case "/":
        if (b === 0) {
          throw new Error("Division by zero");
        }
        result = a / b;
        break;

      case "%":
        result = a % b;
        break;

      default:
        throw new Error("Unknown operator");
    }

    if (!Number.isFinite(result)) {
      throw new Error("Invalid result");
    }

    stack.push(result);
  }

  if (stack.length !== 1) {
    throw new Error("Invalid calculation");
  }

  return stack[0];
}


function createICS({
  title,
  description,
  location,
  start,
  end
}) {
  const uid =
    `${crypto.randomUUID()}@lucen`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LUCEN//AI Assistant//DE",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${escapeICS(uid)}`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(new Date(start))}`,
    `DTEND:${formatICSDate(new Date(end))}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}


function formatICSDate(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}


function escapeICS(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
