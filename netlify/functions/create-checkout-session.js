// Creates a Stripe Checkout session for an invoice payment.
//
// MOCK MODE: when STRIPE_SECRET_KEY is not set, no Stripe call is made and a
// fake session pointing at payment-success.html?mock=1 is returned so the full
// client flow can be exercised locally (netlify dev) without credentials.
// Input validation runs identically in both modes.

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { amount, invoiceNumber, clientName, clientEmail, entity } = payload;

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'amount must be a number greater than 0' }) };
  }
  if (!invoiceNumber || typeof invoiceNumber !== 'string' || !invoiceNumber.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'invoiceNumber is required' }) };
  }
  if (clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientEmail is not a valid email address' }) };
  }

  const baseUrl = process.env.URL || 'http://localhost:8888';
  const inv = invoiceNumber.trim();

  if (!process.env.STRIPE_SECRET_KEY) {
    console.log(`[create-checkout-session] MOCK MODE — STRIPE_SECRET_KEY not set; no Stripe call. invoice=${inv} amount=$${amt.toFixed(2)}`);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        url: baseUrl + '/payment-success.html?invoice=' + encodeURIComponent(inv) + '&mock=1',
        id: 'mock_session_' + Date.now(),
        mock: true
      })
    };
  }

  console.log(`[create-checkout-session] LIVE MODE — creating Stripe Checkout session. invoice=${inv} amount=$${amt.toFixed(2)}`);
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${entity || 'Vantage'} — Invoice ${inv}` },
          unit_amount: Math.round(amt * 100)
        },
        quantity: 1
      }],
      customer_email: clientEmail || undefined,
      // Card statements read "<prefix>* INVOICE". For card payments Stripe only
      // allows statement_descriptor_suffix (statement_descriptor is non-card only).
      // receipt_email is a PaymentIntent field: Stripe emails the payer a receipt.
      payment_intent_data: {
        statement_descriptor_suffix: 'INVOICE',
        ...(clientEmail ? { receipt_email: clientEmail } : {})
      },
      metadata: { invoiceNumber: inv, entity: entity || '', clientName: clientName || '' },
      success_url: `${baseUrl}/payment-success.html?invoice=${encodeURIComponent(inv)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/payment-cancel.html?invoice=${encodeURIComponent(inv)}`
    });
    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url, id: session.id }) };
  } catch (err) {
    console.error('[create-checkout-session] Stripe error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Stripe error: ' + err.message }) };
  }
};
