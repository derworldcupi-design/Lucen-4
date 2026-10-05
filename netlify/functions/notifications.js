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

      // -----------------------------------------------------
      // CREATE NOTIFICATION
      // -----------------------------------------------------

      case "create": {
        const title = String(
          payload.title || "LUCEN"
        ).trim();

        const message = String(
          payload.message || ""
        ).trim();

        const time = normalizeDate(
          payload.time
        );

        const type = String(
          payload.type || "reminder"
        );

        if (!message) {
          return json({
            ok: false,
            error: "Keine Nachricht angegeben."
          }, 400, headers);
        }

        if (!time) {
          return json({
            ok: false,
            error: "Keine gültige Zeit angegeben."
          }, 400, headers);
        }

        const notification = {
          id: crypto.randomUUID(),
          title,
          message,
          type,
          time,
          priority:
            payload.priority || "normal",
          createdAt:
            new Date().toISOString()
        };

        return json({
          ok: true,
          action: "create",
          notification,
          status: "prepared",
          note:
            "Die Benachrichtigung ist vorbereitet. " +
            "Der persistente Push-Scheduler wird als nächstes angeschlossen."
        }, 200, headers);
      }


      // -----------------------------------------------------
      // APPOINTMENT ALERT
      // -----------------------------------------------------

      case "appointment_alert": {
        const appointment =
          String(
            payload.appointment || ""
          ).trim();

        const time = normalizeDate(
          payload.time
        );

        const beforeMinutes =
          Number(
            payload.beforeMinutes ?? 30
          );

        if (!appointment || !time) {
          return json({
            ok: false,
            error:
              "Termin und gültige Zeit werden benötigt."
          }, 400, headers);
        }

        if (
          !Number.isFinite(beforeMinutes) ||
          beforeMinutes < 0
        ) {
          return json({
            ok: false,
            error:
              "beforeMinutes ist ungültig."
          }, 400, headers);
        }

        const appointmentDate =
          new Date(time);

        const alertDate =
          new Date(
            appointmentDate.getTime() -
            beforeMinutes * 60 * 1000
          );

        return json({
          ok: true,
          action: "appointment_alert",

          appointment: {
            title: appointment,
            time: appointmentDate.toISOString()
          },

          notification: {
            id: crypto.randomUUID(),
            title: "LUCEN Termin-Erinnerung",
            message:
              `${appointment} beginnt bald.`,
            scheduledFor:
              alertDate.toISOString(),
            beforeMinutes
          }
        }, 200, headers);
      }


      // -----------------------------------------------------
      // IMPORTANT EVENT
      // -----------------------------------------------------

      case "important_event": {
        const title = String(
          payload.title || "Wichtiger Termin"
        ).trim();

        const time = normalizeDate(
          payload.time
        );

        if (!time) {
          return json({
            ok: false,
            error: "Keine gültige Zeit."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "important_event",
          event: {
            id: crypto.randomUUID(),
            title,
            time,
            priority: "high",
            createdAt:
              new Date().toISOString()
          },
          notificationPlan: [
            {
              minutesBefore: 1440,
              type: "day_before"
            },
            {
              minutesBefore: 120,
              type: "two_hours_before"
            },
            {
              minutesBefore: 30,
              type: "thirty_minutes_before"
            }
          ]
        }, 200, headers);
      }


      // -----------------------------------------------------
      // CANCEL
      // -----------------------------------------------------

      case "cancel": {
        const id = String(
          payload.id || ""
        ).trim();

        if (!id) {
          return json({
            ok: false,
            error: "Keine Notification-ID."
          }, 400, headers);
        }

        return json({
          ok: true,
          action: "cancel",
          id,
          status: "prepared"
        }, 200, headers);
      }


      // -----------------------------------------------------
      // HEALTH
      // -----------------------------------------------------

      case "health":
        return json({
          ok: true,
          module:
            "LUCEN Notification Core",
          status: "online",
          persistentScheduler: false,
          timestamp:
            new Date().toISOString()
        }, 200, headers);


      default:
        return json({
          ok: false,
          error:
            "Unbekannte Notification-Aktion.",
          availableActions: [
            "create",
            "appointment_alert",
            "important_event",
            "cancel",
            "health"
          ]
        }, 400, headers);
    }

  } catch (error) {

    console.error(
      "LUCEN NOTIFICATION ERROR:",
      error
    );

    return json({
      ok: false,
      error:
        error?.message ||
        "Unbekannter Notification-Fehler."
    }, 500, headers);
  }
};


function normalizeDate(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
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
