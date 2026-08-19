import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async (req, context) => {
  const url = new URL(req.url);

  // 1. Meta Webhook Verification (GET)
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === "myhomeworksecret123") {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // 2. Incoming WhatsApp Message (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

      if (message && message.type === "image") {
        const studentPhone = message.from;
        const mediaId = message.image.id;

        // Fetch image details from Meta API
        const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        });
        const mediaData = await mediaRes.json();

        // Download image binary data
        const imageRes = await fetch(mediaData.url, {
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        });
        const imageBuffer = await imageRes.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString("base64");

        // Pass image to Gemini AI for grading
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
          You are an expert English teacher reviewing a student's handwritten grammar usage and exercises.
          1. Transcribe the student's work and identify all grammar, spelling, or sentence structure errors.
          2. Draft a warm, polite, and encouraging WhatsApp reply explaining the corrections and proper usage clearly.
          
          Return your output strictly in JSON format with two keys:
          - "errors": "A brief summary of detected grammar/spelling errors"
          - "draft": "The full feedback response ready to send to the student"
        `;

        const aiResponse = await model.generateContent([
          prompt,
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
        ]);

        const aiText = aiResponse.response.text().replace(/```json|```/g, "").trim();
        const aiData = JSON.parse(aiText);

        // Save submission draft into Supabase
        await supabase.from("homework_submissions").insert([
          {
            student_phone: studentPhone,
            image_url: mediaData.url,
            error_summary: aiData.errors,
            draft_reply: aiData.draft,
            status: "PENDING",
          },
        ]);
      }

      return new Response("EVENT_RECEIVED", { status: 200 });
    } catch (err) {
      console.error("Webhook processing error:", err);
      return new Response("Error processing request", { status: 500 });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
