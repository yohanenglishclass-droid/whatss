export default async (req, context) => {
  const url = new URL(req.url);

  // 1. Meta Webhook Verification (GET)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === 'myhomeworksecret123') {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403 });
  }

  // 2. Incoming Messages (POST)
  if (req.method === 'POST') {
    return new Response('EVENT_RECEIVED', { status: 200 });
  }

  return new Response('Method Not Allowed', { status: 405 });
};export async function handler(event, context) {
  // Grab query parameters safely
  const params = event.queryStringParameters || {};

  // Meta Verification (GET Request)
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

  // Incoming WhatsApp Messages (POST Request)
  if (event.httpMethod === 'POST') {
    return {
      statusCode: 200,
      body: 'EVENT_RECEIVED',
    };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
}exports.handler = async (event, context) => {
  // 1. Meta Webhook Verification (GET)
  if (event.httpMethod === 'GET') {
    const verifyToken = "myhomeworksecret123";
    const params = event.queryStringParameters || {};

    const mode = params['hub.mode'];
    const token = params['hub.verify_token'];
    const challenge = params['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
      return {
        statusCode: 200,
        body: challenge,
      };
    }
    return { statusCode: 403, body: 'Forbidden' };
  }

  // 2. Incoming Messages (POST)
  if (event.httpMethod === 'POST') {
    console.log("Incoming Message Body:", event.body);
    return {
      statusCode: 200,
      body: 'EVENT_RECEIVED',
    };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
