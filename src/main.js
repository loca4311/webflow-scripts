document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#orderForm");
  if (!form) return;

  const CHECK_MEMBER_EMAIL_ENDPOINT =
    "https://tinguvlwumswhznygirl.supabase.co/functions/v1/check-member-email";

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
    return !!currentMember || emailBelongsToMember;
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

    setText("[data-form-price]", `€ ${formattedPrice}`);
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
    if (currentMember) return;

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

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-course-form]");
    if (!button) return;

    updateBookingForm(button);
  });

  emailInput?.addEventListener("blur", checkEmailInMemberstack);
});
