import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async (req, context) => {
  if (req.method === 'POST') {
    const body = await req.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    // Check if the incoming message is an image
    if (message && message.type === 'image') {
      const studentPhone = message.from;
      const mediaId = message.image.id;

      // 1. Download image from Meta API using mediaId
      const imageUrl = await getWhatsAppMediaUrl(mediaId);
      const imageBuffer = await downloadImage(imageUrl);

      // 2. Pass image to Gemini AI for homework checking
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
        You are an expert English teacher. 
        1. Read the student's handwritten English homework in this image.
        2. Identify and list all grammar/spelling errors.
        3. Write a warm, encouraging WhatsApp reply explaining the errors and providing correct usage.
      `;

      const result = await model.generateContent([
        prompt,
        { inlineData: { data: imageBuffer.toString("base64"), mimeType: "image/jpeg" } }
      ]);

      const aiDraftReply = result.response.text();

      // 3. Save to database/dashboard as a "PENDING" draft (Do NOT send to student yet)
      await saveDraftToDashboard({
        studentPhone,
        imageUrl,
        aiDraftReply,
        status: "PENDING_APPROVAL"
      });
    }

    return new Response('EVENT_RECEIVED', { status: 200 });
  }
};exports.handler = async (event, context) => {
  const params = event.queryStringParameters || {};

  if (event.httpMethod === 'GET') {
    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === 'myhomeworksecret123') {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain" },
        body: challenge,
      };
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  if (event.httpMethod === 'POST') {
    return { statusCode: 200, body: 'EVENT_RECEIVED' };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
