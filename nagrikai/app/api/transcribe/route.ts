import { NextResponse } from "next/server";
import { geminiTranscribe } from "@/lib/gemini";
import { llmProvider } from "@/lib/llm";
import { tooMany } from "@/lib/server/ratelimit";

const MAX_BYTES = 1_500_000; // ~45 s of 16 kHz mono WAV

const available = () => llmProvider() === "gemini";

/** Can this server turn speech into text? (Lets the browser choose how to listen.) */
export async function GET() {
  return NextResponse.json({ available: available() });
}

/**
 * Speech → text for browsers without working speech recognition (Brave, Firefox, Safari…).
 * Body: the recorded audio (WAV). The audio is forwarded for transcription and not stored.
 */
export async function POST(req: Request) {
  if (!available()) return NextResponse.json({ error: { code: "UNAVAILABLE", message: "Server transcription is not configured" } }, { status: 503 });
  const limited = tooMany(req, "transcribe", 20);
  if (limited) return limited;

  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!/^audio\/(wav|x-wav|webm|ogg|mp4|mpeg)$/.test(mime)) return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Send audio/wav" } }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 2000) return NextResponse.json({ text: "" });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: { code: "TOO_LARGE", message: "Recording too long" } }, { status: 413 });

  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "hi";
  try {
    const text = await geminiTranscribe(buf.toString("base64"), mime === "audio/x-wav" ? "audio/wav" : mime, lang);
    return NextResponse.json({ text: text.normalize("NFC") });
  } catch (e) {
    console.warn("transcription failed:", (e as Error).message);
    return NextResponse.json({ error: { code: "FAILED", message: "Could not transcribe" } }, { status: 502 });
  }
}
