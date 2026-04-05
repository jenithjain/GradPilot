const WHAPI_URL = "https://gate.whapi.cloud/messages/text";

/**
 * Sends a WhatsApp text message via Whapi.Cloud.
 *
 * @param {string} to      - Recipient phone number (e.g. "919876543210")
 * @param {string} message - Plain-text message body
 * @returns {Promise<object>} Parsed JSON response from Whapi
 * @throws {Error} On HTTP errors or network failures
 */
export async function sendWhatsAppMessage(to, message) {
  const token = process.env.WHAPI_TOKEN;
  if (!token) {
    throw new Error("WHAPI_TOKEN environment variable is not set");
  }

  let response;
  try {
    response = await fetch(WHAPI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to, body: message }),
    });
  } catch (networkError) {
    throw new Error(`WhatsApp API network failure: ${networkError.message}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `WhatsApp API returned non-JSON response (status ${response.status})`
    );
  }

  if (!response.ok) {
    const detail = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(`WhatsApp API error (${response.status}): ${detail}`);
  }

  return data;
}
