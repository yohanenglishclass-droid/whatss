exports.handler = async (event, context) => {
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
