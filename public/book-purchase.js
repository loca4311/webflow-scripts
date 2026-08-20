document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#bookOrderForm");
  if (!form) return;

  const SUPABASE_FUNCTIONS_URL =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1";

  const ENDPOINTS = {
    checkAccess: `${SUPABASE_FUNCTIONS_URL}/check-course-access`,
    createOrder: `${SUPABASE_FUNCTIONS_URL}/create-book-order`,
    createPayPalOrder: `${SUPABASE_FUNCTIONS_URL}/create-book-paypal-order`,
    sendInvoice: `${SUPABASE_FUNCTIONS_URL}/send-book-invoice-webhook`,
  };

  const PRINT_SHIPPING_COST = 2.5;

  const state = {
    member: null,
    product: null,
    submitting: false,
    accessRequest: 0,
  };

  const emailInput = form.querySelector("#Email");
  const submitButton = form.querySelector('input[type="submit"]');
  const ownedMessage =
    form.querySelector("[data-book-owned]") ||
    form.querySelector("[data-course-owned]") ||
    form.querySelector(".course-already-owned");

  function parsePrice(value) {
    let normalized = String(value || "")
      .trim()
      .replace(/[^\d,.-]/g, "");

    if (normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    }

    const number = Number(normalized);
    return Number.isFinite(number) ? number : null;
  }

  function formatPrice(value, includeCurrency = true) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "";

    return new Intl.NumberFormat("de-DE", {
      style: includeCurrency ? "currency" : "decimal",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  function pricingForProduct(product) {
    const productPrice = Number(product?.price);
    const shippingCost =
      product?.productType === "physical" ? PRINT_SHIPPING_COST : 0;

    return {
      productPrice,
      shippingCost,
      totalPrice: Number((productPrice + shippingCost).toFixed(2)),
    };
  }

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

  function setValue(selector, value) {
    form.querySelectorAll(selector).forEach((element) => {
      element.value = value ?? "";
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function selectedProductFromInput(input) {
    if (!input) return null;

    const price = parsePrice(
      input.dataset.priceValue || input.dataset.price || "",
    );

    return {
      format: String(input.value || "").trim(),
      formatName: String(input.dataset.formatName || "").trim(),
      productType: String(input.dataset.productType || "").trim(),
      planId: String(input.dataset.planId || "").trim(),
      price,
    };
  }

  function getSelectedProduct() {
    const checked = document.querySelector(
      '[data-book-options] input[name="book-format"]:checked',
    );
    const first = document.querySelector(
      '[data-book-options] input[name="book-format"]',
    );
    return selectedProductFromInput(checked || first);
  }

  function isDigitalProduct() {
    return state.product?.productType === "digital";
  }

  function syncWaiver() {
    const wrapper = form.querySelector("[data-book-waiver-wrapper]");
    const checkbox =
      form.querySelector("[data-book-waiver]") ||
      form.querySelector("#book-waiver");

    if (!wrapper) return;

    const show = isDigitalProduct();
    wrapper.style.display = show ? "block" : "none";

    if (checkbox) {
      checkbox.disabled = !show;
      checkbox.required = show;
      if (!show) checkbox.checked = false;
    }
  }

  function syncProduct(product = getSelectedProduct()) {
    if (!product || !product.format || !product.planId || !product.price) {
      console.error("[Book Purchase] Invalid product configuration", product);
      return;
    }

    const pricing = pricingForProduct(product);
    state.product = { ...product, ...pricing, price: pricing.productPrice };

    document.querySelectorAll("[data-book-option]").forEach((option) => {
      const input = option.querySelector('input[name="book-format"]');
      option.classList.toggle("is-active", Boolean(input?.checked));
    });

    document.querySelectorAll("[data-selected-format]").forEach((input) => {
      input.value = product.formatName;
    });

    document.querySelectorAll("[data-selected-price]").forEach((input) => {
      input.value = pricing.productPrice.toFixed(2);
    });

    document
      .querySelectorAll("[data-selected-shipping-cost]")
      .forEach((input) => {
        input.value = pricing.shippingCost.toFixed(2);
      });

    document
      .querySelectorAll("[data-selected-total-price]")
      .forEach((input) => {
        input.value = pricing.totalPrice.toFixed(2);
      });

    setValue("[data-book-hidden-format]", product.format);
    setValue("[data-book-hidden-product-type]", product.productType);
    setValue("[data-book-hidden-plan-id]", product.planId);
    setValue("[data-book-hidden-price]", pricing.productPrice.toFixed(2));
    setValue(
      "[data-book-hidden-shipping-cost]",
      pricing.shippingCost.toFixed(2),
    );
    setValue("[data-book-hidden-total-price]", pricing.totalPrice.toFixed(2));

    setText("[data-book-form-format]", product.formatName);
    setText("[data-book-product-price]", formatPrice(pricing.productPrice));
    setText("[data-book-shipping-cost]", formatPrice(pricing.shippingCost));
    setText("[data-book-total-price]", formatPrice(pricing.totalPrice));
    setText("[data-book-submit-price]", formatPrice(pricing.totalPrice));
    setVisible("[data-book-shipping-row]", product.productType === "physical");

    // Backwards-compatible fallback for the two existing modal price fields:
    // the first is the product price and the last is the payable total.
    const legacyPriceFields = Array.from(
      document.querySelectorAll("[data-form-price]"),
    );
    legacyPriceFields.forEach((element, index) => {
      const isLast = index === legacyPriceFields.length - 1;
      element.textContent = formatPrice(
        isLast ? pricing.totalPrice : pricing.productPrice,
      );
    });

    if (submitButton) {
      submitButton.value = `Jetzt verbindlich bestellen — ${formatPrice(pricing.totalPrice)}`;
    }

    syncWaiver();
    setOwnedState(false);

    if (emailInput?.value.trim()) {
      checkExistingAccess();
    }
  }

  function splitAddress(address) {
    const value = String(address || "").trim();
    const match = value.match(/^(.+?)\s+(\d+\s?[a-zA-Z]?)$/);

    return match
      ? { street: match[1].trim(), houseNumber: match[2].trim() }
      : { street: value, houseNumber: "" };
  }

  function memberField(slug) {
    return state.member?.customFields?.[slug] || "";
  }

  function prefillMember() {
    if (!state.member) return;

    const address = splitAddress(memberField("address"));
    const values = {
      "#Email": state.member.auth?.email || "",
      "#Vorname": memberField("first-name"),
      "#Nachname": memberField("last-name"),
      'select[name="Land"]': memberField("country"),
      "#strasse": address.street,
      "#hausnummer": address.houseNumber,
      "#plz": memberField("zip"),
      "#Stadt": memberField("city"),
    };

    Object.entries(values).forEach(([selector, value]) => {
      if (value) setValue(selector, value);
    });

    updateCountryFields();
  }

  async function loadCurrentMember() {
    try {
      const response = await window.$memberstackDom?.getCurrentMember();
      state.member = response?.data || null;
      prefillMember();
    } catch (error) {
      console.warn("[Book Purchase] No signed-in Memberstack member", error);
    }
  }

  function setOwnedState(hasAccess) {
    if (ownedMessage) {
      ownedMessage.style.display = hasAccess ? "block" : "none";
    }

    if (submitButton && !state.submitting) {
      submitButton.disabled = hasAccess;
    }
  }

  async function checkExistingAccess() {
    // Physical books may be purchased multiple times.
    // Invalidate a pending digital access check after switching formats.
    if (!isDigitalProduct()) {
      state.accessRequest += 1;
      emailInput?.classList.remove("is-checking");
      setOwnedState(false);
      return false;
    }

    const email = emailInput?.value.trim().toLowerCase() || "";
    const planId = state.product?.planId || "";

    if (!email.includes("@") || !planId) {
      setOwnedState(false);
      return false;
    }

    const requestId = ++state.accessRequest;

    try {
      emailInput?.classList.add("is-checking");

      const response = await fetch(ENDPOINTS.checkAccess, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Access check failed");
      }

      if (requestId === state.accessRequest) {
        setOwnedState(Boolean(data.hasAccess));
      }

      return Boolean(data.hasAccess);
    } catch (error) {
      console.error("[Book Purchase] Access check failed", error);
      if (requestId === state.accessRequest) setOwnedState(false);
      return false;
    } finally {
      if (requestId === state.accessRequest) {
        emailInput?.classList.remove("is-checking");
      }
    }
  }

  function isVisible(element) {
    return Boolean(
      element &&
      (element.offsetWidth ||
        element.offsetHeight ||
        element.getClientRects().length),
    );
  }

  function errorContainer(field) {
    return field?.closest(
      ".form_field-wrapper, .select_component, .payment-radio_component, .form_checkbox-wrapper",
    );
  }

  function clearError(field) {
    const container = errorContainer(field) || field;
    field?.classList.remove("is-error");
    container?.classList.remove("is-error");
    container?.querySelector(".form-error-message")?.remove();
  }

  function showError(field, message) {
    if (!field) return false;
    const container = errorContainer(field) || field;
    clearError(field);
    field.classList.add("is-error");
    container.classList.add("is-error");

    const element = document.createElement("div");
    element.className = "form-error-message";
    element.textContent = message;
    container.appendChild(element);
    return false;
  }

  function requireField(selector, message) {
    const field = form.querySelector(selector);
    if (!field || field.disabled || !isVisible(field)) return true;
    if (!String(field.value || "").trim()) return showError(field, message);
    clearError(field);
    return true;
  }

  function validateEmail() {
    const value = emailInput?.value.trim() || "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return showError(
        emailInput,
        "Bitte gib eine gültige E-Mail-Adresse ein.",
      );
    }
    clearError(emailInput);
    return true;
  }

  function validatePayment() {
    const checked = form.querySelector('input[name="payment"]:checked');
    const wrapper = form.querySelector(".payment-radio_component");
    if (!checked)
      return showError(wrapper, "Bitte wähle eine Zahlungsweise aus.");
    clearError(wrapper);
    return true;
  }

  function validateCheckbox(selector, message) {
    const checkbox = form.querySelector(selector);
    if (!checkbox || checkbox.disabled) return true;
    if (!checkbox.checked) return showError(checkbox, message);
    clearError(checkbox);
    return true;
  }

  function companyBooking() {
    return Boolean(
      form.querySelector(".toggle_wrapper")?.classList.contains("active"),
    );
  }

  function validateForm() {
    const country = valueOf('select[name="Land"]');
    const checks = [
      validateEmail(),
      requireField("#Vorname", "Bitte gib deinen Vornamen ein."),
      requireField("#Nachname", "Bitte gib deinen Nachnamen ein."),
      requireField('select[name="Land"]', "Bitte wähle dein Land aus."),
      requireField("#strasse", "Bitte gib deine Straße ein."),
      requireField("#hausnummer", "Bitte gib deine Hausnummer ein."),
      requireField("#plz", "Bitte gib deine PLZ ein."),
      requireField("#Stadt", "Bitte gib deine Stadt ein."),
      validatePayment(),
      validateCheckbox("#checkbox-2", "Bitte stimme den Bedingungen zu."),
    ];

    if (country === "Österreich") {
      checks.push(
        requireField("#Bundesland", "Bitte wähle dein Bundesland aus."),
      );
    }
    if (country === "Schweiz") {
      checks.push(requireField("#Kanton", "Bitte gib deinen Kanton ein."));
    }
    if (companyBooking()) {
      checks.push(
        requireField("#Firmenname", "Bitte gib den Firmennamen ein."),
      );
    }
    if (isDigitalProduct()) {
      checks.push(
        validateCheckbox(
          "#book-waiver",
          "Bitte bestätige den Widerrufsverzicht für digitale Inhalte.",
        ),
      );
    }

    const valid = checks.every(Boolean);
    if (!valid) {
      const first = form.querySelector(".is-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first?.matches("input, select, textarea")) first.focus();
    }
    return valid;
  }

  function valueOf(selector) {
    return form.querySelector(selector)?.value?.trim() || "";
  }

  function selectedPayment() {
    return form.querySelector('input[name="payment"]:checked')?.value || "";
  }

  function updateCountryFields() {
    const country = valueOf('select[name="Land"]');

    [
      ["Österreich", "#Bundesland"],
      ["Schweiz", "#Kanton"],
    ].forEach(([expected, selector]) => {
      const field = form.querySelector(selector);
      const wrapper = field?.closest("[data-land]");
      if (!field || !wrapper) return;
      const show = country === expected;
      wrapper.style.display = show ? "block" : "none";
      field.disabled = !show;
      if (!show) field.value = "";
    });
  }

  function updateCompanyFields() {
    const active = companyBooking();
    const content = form.querySelector(".company-toggle_content");
    if (!content) return;
    content.style.display = active ? "block" : "none";
    content.querySelectorAll("input, select, textarea").forEach((field) => {
      field.disabled = !active;
    });
  }

  function resetResultState() {
    const wrapper = form.parentElement;
    form.style.display = "";
    const success = wrapper?.querySelector(".w-form-done");
    const failure = wrapper?.querySelector(".w-form-fail");
    if (success) success.style.display = "none";
    if (failure) failure.style.display = "none";
  }

  function showFailure(message) {
    const failure = form.parentElement?.querySelector(".w-form-fail");
    if (!failure) {
      window.alert(message);
      return;
    }
    const text = failure.querySelector("div") || failure;
    text.textContent = message;
    failure.style.display = "block";
  }

  function showInvoiceSuccess(reference) {
    const wrapper = form.parentElement;
    const success = wrapper?.querySelector(".w-form-done");
    const referenceElement = wrapper?.querySelector("[data-booking-reference]");
    if (referenceElement) referenceElement.textContent = reference;
    form.style.display = "none";
    if (success) success.style.display = "block";
  }

  function buildPayload() {
    const street = valueOf("#strasse");
    const houseNumber = valueOf("#hausnummer");
    const waiver = form.querySelector("#book-waiver");

    return {
      bookTitle:
        valueOf("[data-book-hidden-title]") || "Das Glück der Freiheit",
      bookFormat: state.product.format,
      productType: state.product.productType,
      planId: state.product.planId,
      price: state.product.price,
      shippingCost: state.product.shippingCost,
      totalPrice: state.product.totalPrice,
      productUrl: window.location.href.split("?")[0],
      email: valueOf("#Email"),
      firstName: valueOf("#Vorname"),
      lastName: valueOf("#Nachname"),
      country: valueOf('select[name="Land"]'),
      street,
      houseNumber,
      fullAddress: `${street} ${houseNumber}`.trim(),
      zip: valueOf("#plz"),
      city: valueOf("#Stadt"),
      bundesland: valueOf("#Bundesland"),
      kanton: valueOf("#Kanton"),
      companyBooking: companyBooking(),
      companyName: valueOf("#Firmenname"),
      vatId: valueOf("#USt-ID"),
      question: valueOf("#frage"),
      paymentMethod: selectedPayment(),
      withdrawalWaiverAccepted: Boolean(isDigitalProduct() && waiver?.checked),
      memberId: state.member?.id || "",
      memberExists: Boolean(state.member),
    };
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || "Die Anfrage konnte nicht verarbeitet werden.",
      );
    }
    return data;
  }

  async function submitOrder(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (state.submitting) return;
    resetResultState();

    if (!state.product) syncProduct();
    if (!validateForm()) return;

    state.submitting = true;
    const originalLabel = submitButton?.value || "Jetzt verbindlich bestellen";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.value = "Wird verarbeitet...";
    }

    try {
      const alreadyOwned = await checkExistingAccess();
      if (alreadyOwned) {
        throw new Error("Du hast dieses Format bereits gekauft.");
      }

      const payload = buildPayload();
      const created = await postJson(ENDPOINTS.createOrder, payload);
      const order = created.order;

      if (payload.paymentMethod === "paypal") {
        const paypal = await postJson(ENDPOINTS.createPayPalOrder, {
          orderReference: order.order_reference,
          productUrl: payload.productUrl,
        });
        window.location.assign(paypal.approveUrl);
        return;
      }

      await postJson(ENDPOINTS.sendInvoice, {
        orderReference: order.order_reference,
      });
      showInvoiceSuccess(order.order_reference);
    } catch (error) {
      console.error("[Book Purchase] Submit failed", error);
      showFailure(error.message || "Es ist ein Fehler aufgetreten.");
    } finally {
      state.submitting = false;
      if (submitButton && document.body.contains(submitButton)) {
        submitButton.disabled = Boolean(
          ownedMessage?.style.display === "block",
        );
        submitButton.value = originalLabel;
      }
    }
  }

  document
    .querySelectorAll('[data-book-options] input[name="book-format"]')
    .forEach((input) => {
      input.addEventListener("change", () =>
        syncProduct(selectedProductFromInput(input)),
      );
    });

  window.addEventListener("bookFormatChange", (event) => {
    const input = Array.from(
      document.querySelectorAll(
        '[data-book-options] input[name="book-format"]',
      ),
    ).find((item) => item.value === event.detail?.value);
    if (input) syncProduct(selectedProductFromInput(input));
  });

  document.querySelectorAll("[data-book-order-open]").forEach((button) => {
    button.addEventListener("click", () => {
      resetResultState();
      syncProduct();
      prefillMember();
    });
  });

  form.querySelectorAll(".payment-radio_field").forEach((card) => {
    card.addEventListener("click", () => {
      const input = card.querySelector('input[type="radio"]');
      if (!input) return;
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      form.querySelectorAll(".payment-radio_field").forEach((item) => {
        item.classList.toggle(
          "active",
          Boolean(item.querySelector('input[type="radio"]')?.checked),
        );
      });
      clearError(form.querySelector(".payment-radio_component"));
    });
  });

  form.querySelectorAll(".toggle_wrapper").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      toggle.classList.toggle("active");
      updateCompanyFields();
    });
  });

  form
    .querySelector('select[name="Land"]')
    ?.addEventListener("change", updateCountryFields);
  emailInput?.addEventListener("blur", checkExistingAccess);

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("input", () => clearError(field));
    field.addEventListener("change", () => clearError(field));
  });

  form.addEventListener("submit", submitOrder, true);

  updateCountryFields();
  updateCompanyFields();
  syncProduct();
  await loadCurrentMember();
  await checkExistingAccess();
});
