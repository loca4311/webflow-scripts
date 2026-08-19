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
      element.textContent = value || "";
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
      headers: { "Content-Type": "application/json" },
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
        ? "Zahlung bestÃ¤tigt Â· Zugang freigeschaltet"
        : "Bestellung aufgenommen Â· Zugang freigeschaltet";
    }

    if (isDigital) {
      return isPaid ? "Zahlung bestÃ¤tigt" : "Bestellung aufgenommen";
    }

    return isPaid
      ? "Zahlung bestÃ¤tigt Â· Versand wird vorbereitet"
      : "Bestellung aufgenommen Â· Rechnung offen";
  }

  function renderOrder(order) {
    const isDigital = order.product_type === "digital";
    const isAudio = order.book_format === "audio";

    // data-member-name remains supported for the currently published Webflow page.
    setText("[data-book-first-name], [data-member-name]", order.first_name);
    setText("[data-book-title]", order.book_title);
    setText("[data-book-format-label]", order.format_label);
    setText("[data-book-email]", order.email);
    setText("[data-book-status]", statusText(order));

    if (isDigital) {
      setText("[data-book-next-title]", "Zu deinen BÃ¼chern");
      setText(
        "[data-book-next-text]",
        `Dein ${isAudio ? "HÃ¶rbuch" : "E-Book"} findest du in deinem persÃ¶nlichen Bereich.`,
      );

      document.querySelectorAll("[data-book-next-link]").forEach((link) => {
        link.href = "/dein-bereich";
        link.target = "_self";
        link.style.display = "inline-flex";
      });
    } else {
      setText("[data-book-next-title]", "Wie geht es weiter?");
      setText(
        "[data-book-next-text]",
        order.payment_method === "rechnung"
          ? "Wir bereiten deine Bestellung fÃ¼r den Versand vor. Die Rechnung und Zahlungsinformationen erhÃ¤ltst du separat."
          : "Deine Zahlung wurde bestÃ¤tigt. Wir bereiten deine Bestellung fÃ¼r den Versand vor.",
      );
      setVisible("[data-book-next-link]", false);
    }

    setVisible("[data-book-next-step]", true);
  }

  function showError(error) {
    console.error("[Book Success] Order load failed", error);
    setText(
      "[data-book-status]",
      "Die Bestelldaten konnten nicht geladen werden. Bitte prÃ¼fe den Link in deiner E-Mail.",
    );
    setVisible("[data-book-next-step]", false);
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
      throw new Error("Missing book order reference");
    }

    renderOrder(order);
  } catch (error) {
    showError(error);
  }
});
