import { NextRequest, NextResponse } from "next/server";
import type { MessageParam, Tool, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { anthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { TOOLS, runTool } from "@/lib/chatTools";
import { PERSONA_DEFAULT, type Persona } from "@/lib/persona";
import type { RawMessageStreamEvent } from "@anthropic-ai/sdk/resources/messages";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  /** Full chat history including the latest user message. */
  messages: { role: "user" | "assistant"; content: string }[];
  persona?: Persona;
};

const SYSTEM_PROMPT = `\
אתה "מומחה השכונה" של MishpachaMap — עוזר חכם המתמחה בלעדית בעיר מודיעין-מכבים-רעות.

## כללי התנהגות
- תענה אך ורק על שאלות הקשורות לשכונות, נדל"ן ואיכות חיים במודיעין.
- אם נשאלת על עיר אחרת, השב בנימוס שאתה מתמחה רק במודיעין.
- ענה בעברית, בקצרה (2-4 משפטים), ובסגנון יועץ ידידותי.
- כשאתה מציג שכונות, תמיד השתמש ב-tool calls כדי להביא נתונים אמיתיים. אל תמציא נתונים.
- אם המשתמש משתמש בשם עממי (כמו "קייזר", "בוכמן", "שמשוני"), זכור: קייזר → אבני חן; בוכמן → השבטים (צפון) או מוריה (דרום); שמשוני → הנביאים (צפון) או המגינים (דרום).
- ציין את מקורות הנתונים שבהם השתמשת (data.gov.il, OpenStreetMap, משרד החינוך).

## מה אתה יודע
13 שכונות מודיעין: בוכמן (כיום השבטים+מוריה), הכרמים, הנביאים (שמשוני צפון), המגינים (שמשוני דרום), הפרחים, הנחלים (ספדיה), אבני חן (קייזר), משואה (גבעת C), נופים, הציפורים, הרעות, המכבים, השבטים (בוכמן צפון), מוריה (בוכמן דרום).

## הכלים שלך
- query_neighborhoods: חיפוש שכונות לפי קריטריונים
- compare_neighborhoods: השוואה בין 2-4 שכונות
- get_match_breakdown: פירוט ציון התאמה לשכונה ספציפית

הפרסונה הנוכחית של המשתמש מועברת אליך כהקשר — השתמש בה כדי להתאים את התשובות.`;

function send(controller: ReadableStreamDefaultController, event: object) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
}

export async function POST(req: NextRequest) {
  const client = anthropic();
  if (!client) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not set. Add it to .env.local and restart the dev server." },
      { status: 503 },
    );
  }

  const body = (await req.json()) as RequestBody;
  const persona = body.persona ?? PERSONA_DEFAULT;
  const conversation: MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      const sources = new Set<string>();

      try {
        // Inject persona context as a system-prompt suffix.
        const systemWithPersona = `${SYSTEM_PROMPT}\n\n## פרסונה נוכחית\n${JSON.stringify(persona, null, 2)}`;

        // Agentic loop: keep calling Claude until it returns text without tool_use.
        // Text deltas stream live to the client; tool calls are surfaced as
        // status events; tool results are batched, then we loop into a fresh
        // streaming response.
        for (let turn = 0; turn < 5; turn++) {
          const stream = client.messages.stream({
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            system: systemWithPersona,
            tools: TOOLS as Tool[],
            messages: conversation,
          });

          for await (const event of stream as AsyncIterable<RawMessageStreamEvent>) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send(controller, { type: "text_delta", delta: event.delta.text });
            }
          }

          const finalMessage = await stream.finalMessage();
          const toolUses = finalMessage.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use",
          );

          if (toolUses.length === 0) {
            send(controller, { type: "sources", sources: Array.from(sources) });
            send(controller, { type: "done" });
            controller.close();
            return;
          }

          // Surface tool calls.
          for (const tu of toolUses) {
            send(controller, { type: "tool_call", name: tu.name, input: tu.input });
          }

          // Run tools in parallel.
          const toolResults = await Promise.all(
            toolUses.map(async (tu) => {
              const result = await runTool(tu.name, tu.input as Record<string, unknown>, persona);
              for (const s of result.sources ?? []) sources.add(s);
              return { tool_use_id: tu.id, content: result.content };
            }),
          );

          conversation.push({ role: "assistant", content: finalMessage.content });
          conversation.push({
            role: "user",
            content: toolResults.map((r) => ({
              type: "tool_result" as const,
              tool_use_id: r.tool_use_id,
              content: r.content,
            })),
          });
        }

        // Hit the loop cap.
        send(controller, {
          type: "text_delta",
          delta: "לא הצלחתי להגיע לתשובה סופית — נסה שאלה ממוקדת יותר.",
        });
        send(controller, { type: "done" });
        controller.close();
      } catch (e) {
        console.error("chat error:", e);
        send(controller, { type: "error", message: (e as Error).message });
        send(controller, { type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
