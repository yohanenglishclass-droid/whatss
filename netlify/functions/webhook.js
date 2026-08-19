const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  // 1. Meta Webhook Verification (GET)
  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters || {};
    const mode = params["hub.mode"];
    const token = params["hub.verify_token"];
    const challenge = params["hub.challenge"];

    const expectedToken = process.env.WEBHOOK_VERIFY_TOKEN || "myhomeworksecret123";

    if (mode === "subscribe" && token === expectedToken) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: challenge,
      };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // 2. Incoming WhatsApp Message (POST)
  if (event.httpMethod === "POST") {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error("Missing Supabase credentials in Environment Variables.");
        return { statusCode: 500, body: "Server Configuration Error" };
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

      const body = JSON.parse(event.body || "{}");
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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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

      return { statusCode: 200, body: "EVENT_RECEIVED" };
    } catch (err) {
      console.error("Webhook processing error:", err);
      return { statusCode: 500, body: "Error processing request" };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
