export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const STRIPE_SECRET_KEY =
      env.STRIPE_SECRET_KEY;

    const TEAM_KEY =
      env.TEAM_KEY ||
      "vsa-cooperstown";


    if (!STRIPE_SECRET_KEY) {
      return jsonResponse(
        {
          error:
            "Stripe is not configured yet."
        },
        500
      );
    }


    const body =
      await request.json();


    /* =========================
       DONATION AMOUNT
    ========================= */

    const amount =
      Number(
        body.amount
      );


    if (
      !Number.isFinite(amount) ||
      amount < 1
    ) {
      return jsonResponse(
        {
          error:
            "Donation amount must be at least $1."
        },
        400
      );
    }


    const amountCents =
      Math.round(
        amount * 100
      );


    if (
      amountCents < 100
    ) {
      return jsonResponse(
        {
          error:
            "Donation amount must be at least $1."
        },
        400
      );
    }


    /* =========================
       DONOR NAME
    ========================= */

    const donorName =
      String(
        body.donorName ||
        body.donor_name ||
        ""
      )
        .trim()
        .replace(/\s+/g, " ");


    if (!donorName) {
      return jsonResponse(
        {
          error:
            "Please enter a donor name or choose Anonymous."
        },
        400
      );
    }


    if (
      donorName.length > 50
    ) {
      return jsonResponse(
        {
          error:
            "Donor name must be 50 characters or fewer."
        },
        400
      );
    }


    /* =========================
       CREATE STRIPE SESSION
    ========================= */

    const origin =
      new URL(
        request.url
      ).origin;


    const form =
      new URLSearchParams();


    form.append(
      "mode",
      "payment"
    );


    /*
      Keep the same Stripe payment setup
      as the VSA baseball checkout.
    */

    form.append(
      "payment_method_types[0]",
      "card"
    );


    form.append(
      "line_items[0][price_data][currency]",
      "usd"
    );


    form.append(
      "line_items[0][price_data][unit_amount]",
      String(
        amountCents
      )
    );


    form.append(
      "line_items[0][price_data][product_data][name]",
      "VSA Boca — General Team Donation"
    );


    form.append(
      "line_items[0][price_data][product_data][description]",
      `General team donation from ${donorName}`
    );


    form.append(
      "line_items[0][quantity]",
      "1"
    );


    /* =========================
       RETURN URLS
    ========================= */

    form.append(
      "success_url",
      `${origin}/?general_donation=success`
    );


    form.append(
      "cancel_url",
      `${origin}/?general_donation=canceled`
    );


    /* =========================
       STRIPE METADATA

       IMPORTANT:
       donation_type=general tells
       the webhook NOT to mark any
       shared baseball as sold.
    ========================= */

    form.append(
      "metadata[donation_type]",
      "general"
    );


    form.append(
      "metadata[team_key]",
      TEAM_KEY
    );


    form.append(
      "metadata[donor_name]",
      donorName
    );


    form.append(
      "metadata[amount_cents]",
      String(
        amountCents
      )
    );


    /* =========================
       CALL STRIPE
    ========================= */

    const stripeResponse =
      await fetch(
        "https://api.stripe.com/v1/checkout/sessions",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${STRIPE_SECRET_KEY}`,

            "Content-Type":
              "application/x-www-form-urlencoded"
          },

          body:
            form.toString()
        }
      );


    const stripeData =
      await stripeResponse.json();


    if (!stripeResponse.ok) {
      console.error(
        "Stripe general donation error:",
        stripeData
      );


      return jsonResponse(
        {
          error:
            stripeData?.error?.message ||
            "Unable to create donation checkout."
        },
        500
      );
    }


    if (!stripeData.url) {
      return jsonResponse(
        {
          error:
            "Stripe did not return a checkout URL."
        },
        500
      );
    }


    return jsonResponse(
      {
        url:
          stripeData.url
      },
      200
    );

  } catch (error) {

    console.error(
      "Create general donation error:",
      error
    );


    return jsonResponse(
      {
        error:
          "Unexpected server error."
      },
      500
    );
  }
}


function jsonResponse(
  data,
  status = 200
) {

  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
