import { getStore } from "@netlify/blobs";

const STORE_NAME = "lucen-tasks";

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
      { ok: false, error: "Method not allowed" },
      405,
      headers
    );
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "").trim();
    const payload = body?.payload || {};

    const store = getStore(STORE_NAME);

    switch (action) {

      case "create": {
        const title = String(
          payload.title || ""
        ).trim();

        if (!title) {
          return response(
            {
              ok: false,
              error: "Aufgabentitel fehlt."
            },
            400,
            headers
          );
        }

        const id = crypto.randomUUID();

        const task = {
          id,
          title,

          description:
            String(
              payload.description || ""
            ).trim(),

          status: "open",

          priority:
            normalizePriority(
              payload.priority
            ),

          dueAt:
            payload.dueAt
              ? new Date(
                  payload.dueAt
                ).toISOString()
              : null,

          category:
            String(
              payload.category || "general"
            ).trim(),

          tags:
            normalizeTags(
              payload.tags
            ),

          createdAt:
            new Date().toISOString(),

          updatedAt:
            new Date().toISOString(),

          completedAt: null
        };

        await store.setJSON(
          `task/${id}`,
          task
        );

        return response(
          {
            ok: true,
            action: "create",
            task
          },
          200,
          headers
        );
      }


      case "read": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return response(
            {
              ok: false,
              error: "Task-ID fehlt."
            },
            400,
            headers
          );
        }

        const task =
          await store.get(
            `task/${id}`,
            { type: "json" }
          );

        return response(
          {
            ok: true,
            action: "read",
            task: task || null
          },
          200,
          headers
        );
      }


      case "list": {
        const tasks = [];

        for await (
          const page of store.list({
            prefix: "task/",
            paginate: true
          })
        ) {
          for (const blob of page.blobs) {

            const task =
              await store.get(
                blob.key,
                { type: "json" }
              );

            if (!task) continue;

            if (
              payload.status &&
              task.status !==
                payload.status
            ) {
              continue;
            }

            tasks.push(task);
          }
        }

        tasks.sort(
          (a, b) => {

            if (
              a.status !== b.status
            ) {
              return a.status === "open"
                ? -1
                : 1;
            }

            if (
              a.dueAt &&
              b.dueAt
            ) {
              return (
                new Date(a.dueAt) -
                new Date(b.dueAt)
              );
            }

            return (
              new Date(b.createdAt) -
              new Date(a.createdAt)
            );
          }
        );

        return response(
          {
            ok: true,
            action: "list",
            count: tasks.length,
            tasks
          },
          200,
          headers
        );
      }


      case "complete": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return response(
            {
              ok: false,
              error: "Task-ID fehlt."
            },
            400,
            headers
          );
        }

        const task =
          await store.get(
            `task/${id}`,
            { type: "json" }
          );

        if (!task) {
          return response(
            {
              ok: false,
              error: "Aufgabe nicht gefunden."
            },
            404,
            headers
          );
        }

        task.status = "completed";

        task.completedAt =
          new Date().toISOString();

        task.updatedAt =
          new Date().toISOString();

        await store.setJSON(
          `task/${id}`,
          task
        );

        return response(
          {
            ok: true,
            action: "complete",
            task
          },
          200,
          headers
        );
      }


      case "reopen": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return response(
            {
              ok: false,
              error: "Task-ID fehlt."
            },
            400,
            headers
          );
        }

        const task =
          await store.get(
            `task/${id}`,
            { type: "json" }
          );

        if (!task) {
          return response(
            {
              ok: false,
              error: "Aufgabe nicht gefunden."
            },
            404,
            headers
          );
        }

        task.status = "open";
        task.completedAt = null;
        task.updatedAt =
          new Date().toISOString();

        await store.setJSON(
          `task/${id}`,
          task
        );

        return response(
          {
            ok: true,
            action: "reopen",
            task
          },
          200,
          headers
        );
      }


      case "update": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return response(
            {
              ok: false,
              error: "Task-ID fehlt."
            },
            400,
            headers
          );
        }

        const task =
          await store.get(
            `task/${id}`,
            { type: "json" }
          );

        if (!task) {
          return response(
            {
              ok: false,
              error: "Aufgabe nicht gefunden."
            },
            404,
            headers
          );
        }

        if (
          payload.title !== undefined
        ) {
          task.title =
            String(
              payload.title
            ).trim();
        }

        if (
          payload.description !== undefined
        ) {
          task.description =
            String(
              payload.description
            ).trim();
        }

        if (
          payload.priority !== undefined
        ) {
          task.priority =
            normalizePriority(
              payload.priority
            );
        }

        if (
          payload.category !== undefined
        ) {
          task.category =
            String(
              payload.category
            ).trim();
        }

        if (
          payload.dueAt !== undefined
        ) {
          task.dueAt =
            payload.dueAt
              ? new Date(
                  payload.dueAt
                ).toISOString()
              : null;
        }

        if (
          payload.tags !== undefined
        ) {
          task.tags =
            normalizeTags(
              payload.tags
            );
        }

        task.updatedAt =
          new Date().toISOString();

        await store.setJSON(
          `task/${id}`,
          task
        );

        return response(
          {
            ok: true,
            action: "update",
            task
          },
          200,
          headers
        );
      }


      case "delete": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return response(
            {
              ok: false,
              error: "Task-ID fehlt."
            },
            400,
            headers
          );
        }

        await store.delete(
          `task/${id}`
        );

        return response(
          {
            ok: true,
            action: "delete",
            id
          },
          200,
          headers
        );
      }


      case "search": {
        const query =
          String(
            payload.query || ""
          )
          .trim()
          .toLowerCase();

        const matches = [];

        for await (
          const page of store.list({
            prefix: "task/",
            paginate: true
          })
        ) {
          for (const blob of page.blobs) {

            const task =
              await store.get(
                blob.key,
                { type: "json" }
              );

            if (!task) continue;

            const searchable =
              JSON.stringify(task)
                .toLowerCase();

            if (
              !query ||
              searchable.includes(query)
            ) {
              matches.push(task);
            }
          }
        }

        return response(
          {
            ok: true,
            action: "search",
            query,
            count: matches.length,
            tasks: matches
          },
          200,
          headers
        );
      }


      case "health": {
        return response(
          {
            ok: true,
            module: "LUCEN Tasks V2",
            persistent: true,
            provider: "Netlify Blobs",
            timestamp:
              new Date().toISOString()
          },
          200,
          headers
        );
      }


      default:
        return response(
          {
            ok: false,
            error:
              "Unbekannte Task-Aktion.",
            availableActions: [
              "create",
              "read",
              "list",
              "complete",
              "reopen",
              "update",
              "delete",
              "search",
              "health"
            ]
          },
          400,
          headers
        );
    }

  } catch (error) {

    console.error(
      "LUCEN TASK ERROR:",
      error
    );

    return response(
      {
        ok: false,
        error:
          error?.message ||
          "Unbekannter Task-Fehler."
      },
      500,
      headers
    );
  }
};


function normalizePriority(value) {

  const allowed = [
    "low",
    "normal",
    "high",
    "urgent"
  ];

  const result =
    String(
      value || "normal"
    )
    .trim()
    .toLowerCase();

  return allowed.includes(result)
    ? result
    : "normal";
}


function normalizeTags(value) {

  if (Array.isArray(value)) {
    return value
      .map(x => String(x).trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 30);
  }

  return [];
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
