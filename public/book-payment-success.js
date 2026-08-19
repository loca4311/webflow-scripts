document.addEventListener("DOMContentLoaded", async () => {
  const CAPTURE_ENDPOINT =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1/capture-book-paypal-order";

  const GET_ORDER_ENDPOINT =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1/get-book-order-by-reference";

  const params = new URLSearchParams(window.location.search);
  const paypalOrderId = params.get("token");
  const orderReference = params.get("order");

  const isPayPalReturn =
    params.get("payment") === "success" &&
    params.get("type") === "book" &&
    Boolean(paypalOrderId);

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = value ?? "";
    });
  }

  function setVisible(selector, visible) {
    document.querySelectorAll(selector).forEach((element) => {
      element.style.display = visible ? "" : "none";
    });
  }

  async function postJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.success || !data.order) {
      throw new Error(
        data.error || "Die Bestellung konnte nicht geladen werden.",
      );
    }

    return data.order;
  }

  function statusText(order) {
    const isDigital = order.product_type === "digital";
    const isPaid = order.payment_status === "paid";
    const hasAccess = order.access_status === "granted";

    if (isDigital && hasAccess) {
      return isPaid
        ? "Zahlung best\u00e4tigt \u00b7 Zugang freigeschaltet"
        : "Bestellung aufgenommen \u00b7 Zugang freigeschaltet";
    }

    if (isDigital) {
      return isPaid ? "Zahlung best\u00e4tigt" : "Bestellung aufgenommen";
    }

    return isPaid
      ? "Zahlung best\u00e4tigt \u00b7 Versand wird vorbereitet"
      : "Bestellung aufgenommen \u00b7 Rechnung offen";
  }

  function renderOrder(order) {
    const isDigital = order.product_type === "digital";
    const isAudio = order.book_format === "audio";
    const hasAccess = order.access_status === "granted";

    setText("[data-book-first-name], [data-member-name]", order.first_name);

    setText("[data-book-title]", order.book_title);
    setText("[data-book-format-label]", order.format_label);
    setText("[data-book-email]", order.email);
    setText("[data-book-status]", statusText(order));

    if (isDigital && hasAccess) {
      setText("[data-book-next-title]", "Zu deinen B\u00fcchern");

      setText(
        "[data-book-next-text]",
        `Dein ${
          isAudio ? "H\u00f6rbuch" : "E-Book"
        } findest du in deinem pers\u00f6nlichen Bereich.`,
      );

      document.querySelectorAll("[data-book-next-link]").forEach((link) => {
        link.href = "/dein-bereich";
        link.target = "_self";
        link.style.display = "inline-flex";
      });
    } else if (isDigital) {
      setText("[data-book-next-title]", "Bestellung wird verarbeitet");

      setText(
        "[data-book-next-text]",
        "Dein digitaler Zugang wird gerade vorbereitet. Bitte pr\u00fcfe dein E-Mail-Postfach.",
      );

      setVisible("[data-book-next-link]", false);
    } else {
      setText("[data-book-next-title]", "Wie geht es weiter?");

      setText(
        "[data-book-next-text]",
        order.payment_method === "rechnung"
          ? "Wir bereiten deine Bestellung f\u00fcr den Versand vor. Die Rechnung und Zahlungsinformationen erh\u00e4ltst du separat."
          : "Deine Zahlung wurde best\u00e4tigt. Wir bereiten deine Bestellung f\u00fcr den Versand vor.",
      );

      setVisible("[data-book-next-link]", false);
    }

    setVisible("[data-book-next-step]", true);
  }

  function showError(error) {
    console.error("[Book Success] Order load failed", error);

    setText(
      "[data-book-status]",
      "Die Bestelldaten konnten nicht geladen werden. Bitte pr\u00fcfe den Link in deiner E-Mail.",
    );

    setVisible("[data-book-next-step]", false);
  }

  function redirectToHome() {
    window.location.replace("/");
  }

  try {
    let order;

    if (isPayPalReturn) {
      order = await postJson(CAPTURE_ENDPOINT, { paypalOrderId });

      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = "";
      cleanUrl.searchParams.set("order", order.order_reference);
      window.history.replaceState({}, "", cleanUrl);
    } else if (orderReference) {
      order = await postJson(GET_ORDER_ENDPOINT, { orderReference });
    } else {
      redirectToHome();
      return;
    }

    renderOrder(order);
  } catch (error) {
    console.error("[Book Success] Order load failed", error);
    redirectToHome();
  } finally {
    document.body.classList.remove("is-loading-booking");
  }
});
