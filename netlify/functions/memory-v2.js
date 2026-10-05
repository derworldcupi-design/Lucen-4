import { getStore } from "@netlify/blobs";

const STORE_NAME = "lucen-memory";

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
    return reply(
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

    const action = String(body?.action || "").trim();
    const payload = body?.payload || {};

    const store = getStore(STORE_NAME);

    switch (action) {

      // =====================================================
      // CREATE MEMORY
      // =====================================================

      case "remember": {
        const content = String(
          payload.content || ""
        ).trim();

        if (!content) {
          return reply(
            {
              ok: false,
              error: "Kein Erinnerungsinhalt."
            },
            400,
            headers
          );
        }

        const id = crypto.randomUUID();

        const memory = {
          id,
          content,

          category:
            String(
              payload.category || "general"
            ).trim(),

          importance:
            normalizeImportance(
              payload.importance
            ),

          tags:
            normalizeTags(
              payload.tags
            ),

          source:
            String(
              payload.source || "lucen"
            ).trim(),

          createdAt:
            new Date().toISOString(),

          updatedAt:
            new Date().toISOString()
        };

        await store.setJSON(
          `memory/${id}`,
          memory
        );

        return reply(
          {
            ok: true,
            action: "remember",
            memory
          },
          200,
          headers
        );
      }

      // =====================================================
      // READ MEMORY
      // =====================================================

      case "read": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return reply(
            {
              ok: false,
              error: "Memory-ID fehlt."
            },
            400,
            headers
          );
        }

        const memory =
          await store.get(
            `memory/${id}`,
            {
              type: "json"
            }
          );

        return reply(
          {
            ok: true,
            action: "read",
            memory: memory || null
          },
          200,
          headers
        );
      }

      // =====================================================
      // SEARCH MEMORY
      // =====================================================

      case "search": {
        const query =
          String(
            payload.query || ""
          )
          .trim()
          .toLowerCase();

        const results = [];

        for await (
          const page of store.list({
            prefix: "memory/",
            paginate: true
          })
        ) {
          for (const blob of page.blobs) {

            const memory =
              await store.get(
                blob.key,
                {
                  type: "json"
                }
              );

            if (!memory) continue;

            const searchable =
              [
                memory.content,
                memory.category,
                ...(memory.tags || [])
              ]
              .join(" ")
              .toLowerCase();

            if (
              !query ||
              searchable.includes(query)
            ) {
              results.push(memory);
            }
          }
        }

        results.sort(
          (a, b) =>
            importanceScore(
              b.importance
            ) -
            importanceScore(
              a.importance
            )
        );

        return reply(
          {
            ok: true,
            action: "search",
            query,
            count: results.length,
            memories: results
          },
          200,
          headers
        );
      }

      // =====================================================
      // LIST ALL
      // =====================================================

      case "list": {
        const memories = [];

        for await (
          const page of store.list({
            prefix: "memory/",
            paginate: true
          })
        ) {
          for (const blob of page.blobs) {

            const memory =
              await store.get(
                blob.key,
                {
                  type: "json"
                }
              );

            if (memory) {
              memories.push(memory);
            }
          }
        }

        memories.sort(
          (a, b) =>
            new Date(
              b.updatedAt
            ) -
            new Date(
              a.updatedAt
            )
        );

        return reply(
          {
            ok: true,
            action: "list",
            count: memories.length,
            memories
          },
          200,
          headers
        );
      }

      // =====================================================
      // UPDATE
      // =====================================================

      case "update": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return reply(
            {
              ok: false,
              error: "Memory-ID fehlt."
            },
            400,
            headers
          );
        }

        const existing =
          await store.get(
            `memory/${id}`,
            {
              type: "json"
            }
          );

        if (!existing) {
          return reply(
            {
              ok: false,
              error: "Memory nicht gefunden."
            },
            404,
            headers
          );
        }

        const updated = {
          ...existing,

          content:
            payload.content !== undefined
              ? String(
                  payload.content
                ).trim()
              : existing.content,

          category:
            payload.category !== undefined
              ? String(
                  payload.category
                ).trim()
              : existing.category,

          importance:
            payload.importance !== undefined
              ? normalizeImportance(
                  payload.importance
                )
              : existing.importance,

          tags:
            payload.tags !== undefined
              ? normalizeTags(
                  payload.tags
                )
              : existing.tags,

          updatedAt:
            new Date().toISOString()
        };

        await store.setJSON(
          `memory/${id}`,
          updated
        );

        return reply(
          {
            ok: true,
            action: "update",
            memory: updated
          },
          200,
          headers
        );
      }

      // =====================================================
      // DELETE
      // =====================================================

      case "delete": {
        const id =
          String(
            payload.id || ""
          ).trim();

        if (!id) {
          return reply(
            {
              ok: false,
              error: "Memory-ID fehlt."
            },
            400,
            headers
          );
        }

        await store.delete(
          `memory/${id}`
        );

        return reply(
          {
            ok: true,
            action: "delete",
            id
          },
          200,
          headers
        );
      }

      // =====================================================
      // HEALTH
      // =====================================================

      case "health": {
        return reply(
          {
            ok: true,
            module: "LUCEN Memory V2",
            persistent: true,
            provider: "Netlify Blobs",
            timestamp:
              new Date().toISOString()
          },
          200,
          headers
        );
      }

      // =====================================================
      // UNKNOWN
      // =====================================================

      default:
        return reply(
          {
            ok: false,
            error: "Unbekannte Memory-Aktion.",
            availableActions: [
              "remember",
              "read",
              "search",
              "list",
              "update",
              "delete",
              "health"
            ]
          },
          400,
          headers
        );
    }

  } catch (error) {

    console.error(
      "LUCEN MEMORY V2 ERROR:",
      error
    );

    return reply(
      {
        ok: false,
        error:
          error?.message ||
          "Unbekannter Memory-Fehler."
      },
      500,
      headers
    );
  }
};


// =========================================================
// HELPERS
// =========================================================

function normalizeImportance(value) {

  const allowed = [
    "low",
    "normal",
    "high",
    "critical"
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


function importanceScore(value) {

  switch (
    String(value)
      .toLowerCase()
  ) {
    case "critical":
      return 4;

    case "high":
      return 3;

    case "normal":
      return 2;

    case "low":
      return 1;

    default:
      return 0;
  }
}


function normalizeTags(value) {

  if (Array.isArray(value)) {

    return value
      .map(tag =>
        String(tag).trim()
      )
      .filter(Boolean)
      .slice(0, 30);
  }

  if (typeof value === "string") {

    return value
      .split(",")
      .map(tag =>
        tag.trim()
      )
      .filter(Boolean)
      .slice(0, 30);
  }

  return [];
}


function reply(
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
