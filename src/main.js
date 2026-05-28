document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#orderForm");
  if (!form) return;

  console.log("TEST DEPLOY 123");

  const CHECK_MEMBER_EMAIL_ENDPOINT =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1/check-member-email";

  const CREATE_BOOKING_ENDPOINT =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1/create-booking";

  const emailInput = form.querySelector("#Email");

  let currentMember = null;
  let emailBelongsToMember = false;
  let currentCourseData = null;

  const MONTHS_DE_FULL = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];

  const MONTHS_DE_SHORT = [
    "Jan.",
    "Feb.",
    "März",
    "Apr.",
    "Mai",
    "Juni",
    "Juli",
    "Aug.",
    "Sept.",
    "Okt.",
    "Nov.",
    "Dez.",
  ];

  try {
    const ms = window.$memberstackDom;

    if (ms) {
      const memberResponse = await ms.getCurrentMember();
      currentMember = memberResponse?.data || null;
    }
  } catch (error) {
    console.warn("[Booking Form] Memberstack member not found:", error);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value || "";
    });
  }

  function setValue(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.value = value || "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function parseDate(value) {
    if (!value) return null;

    const str = String(value).trim();

    let match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match) {
      return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    }

    match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }

    const date = new Date(str);
    return isNaN(date) ? null : date;
  }

  function formatDateRange(startValue, endValue) {
    const start = parseDate(startValue);
    const end = parseDate(endValue);

    if (!start && !end) return "";

    if (start && !end) {
      return `${start.getDate()}. ${MONTHS_DE_FULL[start.getMonth()]} ${start.getFullYear()}`;
    }

    const sameMonth =
      start.getMonth() === end.getMonth() &&
      start.getFullYear() === end.getFullYear();

    if (sameMonth) {
      return `${start.getDate()}.–${end.getDate()}. ${MONTHS_DE_FULL[end.getMonth()]} ${end.getFullYear()}`;
    }

    return `${start.getDate()}. ${MONTHS_DE_SHORT[start.getMonth()]} ${start.getFullYear()} - ${end.getDate()}. ${MONTHS_DE_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }

  function formatPrice(value) {
    if (!value) return "";

    const normalized = String(value)
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const number = Number(normalized);
    if (Number.isNaN(number)) return value;

    return new Intl.NumberFormat("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  function getMemberField(slug) {
    return currentMember?.customFields?.[slug] || "";
  }

  function shouldUseMemberPrice() {
    const formEmail = emailInput?.value?.trim().toLowerCase() || "";
    const memberEmail = currentMember?.auth?.email?.trim().toLowerCase() || "";

    if (currentMember && formEmail && formEmail === memberEmail) {
      return true;
    }

    return emailBelongsToMember;
  }

  function prefillMemberData() {
    if (!currentMember) return;

    setValue("#Email", currentMember.auth?.email || "");
    setValue("#Vorname", getMemberField("first-name"));
    setValue("#Nachname", getMemberField("last-name"));

    if (getMemberField("country"))
      setValue('select[name="Land"]', getMemberField("country"));
    if (getMemberField("address"))
      setValue("#strasse", getMemberField("address"));
    if (getMemberField("zip")) setValue("#plz", getMemberField("zip"));
    if (getMemberField("city")) setValue("#Stadt", getMemberField("city"));
  }

  function applyPrice() {
    if (!currentCourseData) return;

    const isExistingMember = shouldUseMemberPrice();

    const selectedPrice =
      isExistingMember && currentCourseData.memberPrice
        ? currentCourseData.memberPrice
        : currentCourseData.regularPrice;

    const formattedPrice = formatPrice(selectedPrice);
    const formattedRegularPrice = formatPrice(currentCourseData.regularPrice);
    const regularPriceEl = document.querySelector("[data-form-regular-price]");

    setText("[data-form-price]", `€ ${formattedPrice}`);
    if (regularPriceEl) {
      if (isExistingMember && currentCourseData.memberPrice) {
        regularPriceEl.textContent = `€ ${formattedRegularPrice}`;
        regularPriceEl.classList.add("is-visible");
      } else {
        regularPriceEl.textContent = "";
        regularPriceEl.classList.remove("is-visible");
      }
    }
    setValue("[data-hidden-selected-price]", selectedPrice);
    setValue(
      "[data-hidden-price-type]",
      isExistingMember ? "member" : "regular",
    );

    const submitButton = form.querySelector('input[type="submit"]');

    if (submitButton && formattedPrice) {
      submitButton.value = `Jetzt verbindlich buchen — € ${formattedPrice}`;
    }

    console.log("[Booking Form] Price updated:", {
      isExistingMember,
      selectedPrice,
      emailBelongsToMember,
    });
  }

  function updateBookingForm(button) {
    currentCourseData = {
      courseName: button.getAttribute("data-course-name") || "",
      startDate: button.getAttribute("data-start-date") || "",
      endDate: button.getAttribute("data-end-date") || "",
      location: button.getAttribute("data-location") || "",
      regularPrice: button.getAttribute("data-regular-price") || "",
      memberPrice: button.getAttribute("data-member-price") || "",
      planId: button.getAttribute("data-plan-id") || "",
    };

    const dateRange = formatDateRange(
      currentCourseData.startDate,
      currentCourseData.endDate,
    );

    setText("[data-form-course-name]", currentCourseData.courseName);
    setText("[data-form-start-date]", dateRange);
    setText("[data-form-end-date]", "");
    setText("[data-form-location]", currentCourseData.location);

    setText("[data-form-summary-course]", currentCourseData.courseName);
    setText("[data-form-summary-start-date]", dateRange);
    setText("[data-form-summary-end-date]", "");
    setText("[data-form-summary-location]", currentCourseData.location);

    setValue("[data-hidden-course-name]", currentCourseData.courseName);
    setValue("[data-hidden-start-date]", currentCourseData.startDate);
    setValue("[data-hidden-end-date]", currentCourseData.endDate);
    setValue("[data-hidden-location]", currentCourseData.location);
    setValue("[data-hidden-regular-price]", currentCourseData.regularPrice);
    setValue("[data-hidden-member-price]", currentCourseData.memberPrice);
    setValue("[data-hidden-plan-id]", currentCourseData.planId);

    prefillMemberData();
    applyPrice();
  }

  async function checkEmailInMemberstack() {
    const email = emailInput?.value?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      emailBelongsToMember = false;
      applyPrice();
      return;
    }

    try {
      emailInput.classList.add("is-checking");

      const response = await fetch(CHECK_MEMBER_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      emailBelongsToMember = !!data.exists;

      applyPrice();

      console.log("[Booking Form] Email check:", {
        email,
        exists: emailBelongsToMember,
      });
    } catch (error) {
      console.error("[Booking Form] Email check failed:", error);

      emailBelongsToMember = false;
      applyPrice();
    } finally {
      emailInput.classList.remove("is-checking");
    }
  }

  function getInputValue(selector) {
    return form.querySelector(selector)?.value?.trim() || "";
  }

  function getSelectedPaymentMethod() {
    return (
      form.querySelector('input[name="payment"]:checked')?.value || "rechnung"
    );
  }

  function getCompanyBookingValue() {
    return (
      form.querySelector(".toggle_wrapper")?.classList.contains("active") ||
      false
    );
  }

  const companyToggle = form.querySelector(".toggle_wrapper");
  const companyContent = form.querySelector(".company-toggle_content");

  function updateCompanyToggle(toggle) {
    const companyBlock = toggle.closest(".company-toggle");
    const companyContent = companyBlock?.querySelector(
      ".company-toggle_content",
    );

    if (!companyContent) return;

    const isActive = toggle.classList.contains("active");

    companyContent.style.display = isActive ? "block" : "none";

    companyContent
      .querySelectorAll("input, select, textarea")
      .forEach((field) => {
        field.disabled = !isActive;
      });
  }

  form.querySelectorAll(".toggle_wrapper").forEach((toggle) => {
    updateCompanyToggle(toggle);

    toggle.addEventListener("click", () => {
      setTimeout(() => {
        toggle.classList.toggle("active");
        updateCompanyToggle(toggle);
      }, 0);
    });
  });

  function normalizePrice(value) {
    const normalized = String(value || "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");

    const number = Number(normalized);

    return Number.isNaN(number) ? null : number;
  }

  function isFieldVisible(field) {
    return !!(
      field.offsetWidth ||
      field.offsetHeight ||
      field.getClientRects().length
    );
  }

  function getErrorContainer(field) {
    return field.closest(
      ".form_field-wrapper, .select_component, .payment-radio_component, .form_checkbox",
    );
  }

  function showError(fieldOrWrapper, message) {
    if (!fieldOrWrapper) return;

    const container = getErrorContainer(fieldOrWrapper) || fieldOrWrapper;

    container.querySelector(".form-error-message")?.remove();

    const error = document.createElement("div");
    error.className = "form-error-message";
    error.textContent = message;

    container.appendChild(error);
  }

  function clearError(fieldOrWrapper) {
    if (!fieldOrWrapper) return;

    const container = getErrorContainer(fieldOrWrapper) || fieldOrWrapper;

    fieldOrWrapper.classList.remove("is-error");
    container.classList.remove("is-error");
    container.querySelector(".form-error-message")?.remove();
  }

  function validateRequiredField(
    selector,
    message = "Bitte fülle dieses Feld aus.",
  ) {
    const field = form.querySelector(selector);

    if (!field || field.disabled || !isFieldVisible(field)) {
      return true;
    }

    const isInvalid = !field.value.trim();

    field.classList.toggle("is-error", isInvalid);

    if (isInvalid) {
      showError(field, message);
    } else {
      clearError(field);
    }

    return !isInvalid;
  }

  function validatePayment() {
    const wrapper = form.querySelector(".payment-radio_component");
    const cards = form.querySelectorAll(".payment-radio_field");
    const checkedPayment = form.querySelector('input[name="payment"]:checked');

    const isInvalid = !checkedPayment;

    wrapper?.classList.toggle("is-error", isInvalid);

    cards.forEach((card) => {
      card.classList.toggle("is-error", isInvalid);
    });

    wrapper?.querySelector(".form-error-message")?.remove();

    if (isInvalid) {
      showError(wrapper, "Bitte wähle eine Zahlungsweise aus.");
    }

    return !isInvalid;
  }

  function validateTerms() {
    const checkbox = form.querySelector("#checkbox-2");
    const wrapper = checkbox?.closest(".form_checkbox");

    const isInvalid = !checkbox?.checked;

    wrapper?.classList.toggle("is-error", isInvalid);

    if (isInvalid) {
      showError(wrapper, "Bitte stimme den Bedingungen zu.");
    } else {
      clearError(wrapper);
    }

    return !isInvalid;
  }

  function clearErrorsOnInput() {
    form.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", () => {
        clearError(field);
      });

      field.addEventListener("change", () => {
        clearError(field);

        if (field.name === "payment") {
          validatePayment();
        }

        if (field.id === "checkbox-2") {
          validateTerms();
        }
      });
    });
  }

  function validateBookingForm() {
    const country = getInputValue('select[name="Land"]');
    const isCompanyBooking = getCompanyBookingValue();

    const checks = [
      validateRequiredField("#Email", "Bitte gib deine E-Mail-Adresse ein."),
      validateRequiredField("#Vorname", "Bitte gib deinen Vornamen ein."),
      validateRequiredField("#Nachname", "Bitte gib deinen Nachnamen ein."),
      validateRequiredField(
        'select[name="Land"]',
        "Bitte wähle dein Land aus.",
      ),
      validateRequiredField("#strasse", "Bitte gib deine Straße ein."),
      validateRequiredField("#hausnummer", "Bitte gib deine Hausnummer ein."),
      validateRequiredField("#plz", "Bitte gib deine PLZ ein."),
      validateRequiredField("#Stadt", "Bitte gib deine Stadt ein."),
      validatePayment(),
      validateTerms(),
    ];

    if (country === "AT") {
      checks.push(
        validateRequiredField(
          "#Bundesland",
          "Bitte wähle dein Bundesland aus.",
        ),
      );
    }

    if (country === "CH") {
      checks.push(
        validateRequiredField("#Kanton", "Bitte gib deinen Kanton ein."),
      );
    }

    if (isCompanyBooking) {
      checks.push(
        validateRequiredField("#Firmenname", "Bitte gib den Firmennamen ein."),
      );
    }

    const isValid = checks.every(Boolean);

    if (!isValid) {
      const firstError = form.querySelector(
        "input.is-error, select.is-error, textarea.is-error, .payment-radio_field.is-error, .form_checkbox.is-error",
      );

      firstError?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      if (firstError.matches("input, select, textarea")) {
        firstError.focus();
      }
    }

    return isValid;
  }

  clearErrorsOnInput();

  async function submitBooking(event) {
    event.preventDefault();

    const successEl = form.parentElement?.querySelector(".w-form-done");
    const failEl = form.parentElement?.querySelector(".w-form-fail");

    if (successEl) successEl.style.display = "none";
    if (failEl) failEl.style.display = "none";

    if (!validateBookingForm()) {
      return;
    }

    const paymentMethod = getSelectedPaymentMethod();

    if (paymentMethod !== "rechnung") {
      alert("PayPal kommt im nächsten Schritt.");
      return;
    }

    const submitButton = form.querySelector('input[type="submit"]');
    const originalSubmitText = submitButton?.value;

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.value = "Wird gesendet...";
    }

    const payload = {
      courseName: getInputValue("[data-hidden-course-name]"),
      startDate: getInputValue("[data-hidden-start-date]"),
      endDate: getInputValue("[data-hidden-end-date]"),
      location: getInputValue("[data-hidden-location]"),
      planId: getInputValue("[data-hidden-plan-id]"),

      email: getInputValue("#Email"),
      firstName: getInputValue("#Vorname"),
      lastName: getInputValue("#Nachname"),
      country: getInputValue('select[name="Land"]'),
      street: getInputValue("#strasse"),
      houseNumber: getInputValue("#hausnummer"),
      zip: getInputValue("#plz"),
      city: getInputValue("#Stadt"),

      bundesland: getInputValue("#Bundesland"),
      kanton: getInputValue("#Kanton"),

      companyBooking: getCompanyBookingValue(),
      companyName: getInputValue("#Firmenname"),
      vatId: getInputValue("#USt-ID"),

      question: getInputValue("#frage"),

      paymentMethod,
      price: normalizePrice(getInputValue("[data-hidden-selected-price]")),
      priceType: getInputValue("[data-hidden-price-type]"),

      memberId: currentMember?.id || "",
      memberExists: !!currentMember || emailBelongsToMember,
    };

    try {
      const response = await fetch(CREATE_BOOKING_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Booking konnte nicht erstellt werden.");
      }

      console.log("[Booking Form] Booking created:", data.booking);

      const successEl = form.parentElement?.querySelector(".w-form-done");
      const failEl = form.parentElement?.querySelector(".w-form-fail");

      form.style.display = "none";
      if (failEl) failEl.style.display = "none";
      if (successEl) successEl.style.display = "block";
    } catch (error) {
      console.error("[Booking Form] Submit failed:", error);

      const failEl = form.parentElement?.querySelector(".w-form-fail");

      if (failEl) {
        failEl.style.display = "block";
      } else {
        alert("Es ist ein Fehler aufgetreten. Bitte versuche es erneut.");
      }

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.value = originalSubmitText || "Jetzt verbindlich buchen";
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-course-form]");
    if (!button) return;

    updateBookingForm(button);
  });

  emailInput?.addEventListener("blur", checkEmailInMemberstack);

  const submitButton = form.querySelector('input[type="submit"]');

  submitButton?.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      submitBooking(event);
    },
    true,
  );

  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true,
  );
});
