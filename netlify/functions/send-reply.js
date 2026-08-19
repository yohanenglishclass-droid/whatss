import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const { submissionId, studentPhone, finalMessage } = await req.json();

    // Send message via WhatsApp Business API
    const whatsappRes = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: studentPhone,
          type: "text",
          text: { body: finalMessage },
        }),
      }
    );

    if (whatsappRes.ok) {
      // Update submission status to SENT in Supabase
      await supabase
        .from("homework_submissions")
        .update({ status: "SENT", draft_reply: finalMessage })
        .eq("id", submissionId);

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      const errData = await whatsappRes.json();
      return new Response(JSON.stringify({ success: false, error: errData }), { status: 500 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500 });
  }
};
