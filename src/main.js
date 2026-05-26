document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#orderForm");
  console.log("FORM UPDATED");
  if (!form) return;

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = value || "";
    });
  }

  function setValue(selector, value) {
    document.querySelectorAll(selector).forEach((el) => {
      el.value = value || "";
    });
  }

  function formatPrice(value) {
    if (!value) return "";

    const normalized = String(value).replace(/\./g, "").replace(",", ".");

    const number = Number(normalized);

    if (Number.isNaN(number)) return value;

    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number);
  }

  function updateBookingForm(button) {
    const courseName = button.getAttribute("data-course-name") || "";
    const startDate = button.getAttribute("data-start-date") || "";
    const endDate = button.getAttribute("data-end-date") || "";
    const location = button.getAttribute("data-location") || "";
    const regularPrice = button.getAttribute("data-regular-price") || "";
    const memberPrice = button.getAttribute("data-member-price") || "";
    const planId = button.getAttribute("data-plan-id") || "";

    const displayPrice = regularPrice || memberPrice;
    const formattedPrice = formatPrice(displayPrice);

    setText("[data-form-course-name]", courseName);
    setText("[data-form-start-date]", startDate);
    setText("[data-form-end-date]", endDate);
    setText("[data-form-location]", location);

    setText("[data-sum-line]", formattedPrice);
    setText("[data-sum-total]", formattedPrice);

    const submitButton = form.querySelector('input[type="submit"]');
    if (submitButton && formattedPrice) {
      submitButton.value = `Jetzt verbindlich buchen — ${formattedPrice}`;
    }

    setValue("[data-hidden-course-name]", courseName);
    setValue("[data-hidden-start-date]", startDate);
    setValue("[data-hidden-end-date]", endDate);
    setValue("[data-hidden-location]", location);
    setValue("[data-hidden-regular-price]", regularPrice);
    setValue("[data-hidden-member-price]", memberPrice);
    setValue("[data-hidden-plan-id]", planId);

    console.log("[Booking Form] Filled with:", {
      courseName,
      startDate,
      endDate,
      location,
      regularPrice,
      memberPrice,
      planId,
    });
  }

  document.querySelectorAll("[data-open-course-form]").forEach((button) => {
    button.addEventListener("click", () => {
      updateBookingForm(button);
    });
  });
});
