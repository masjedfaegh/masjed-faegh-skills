
"use strict";

const form = document.getElementById("registration-form");
const courseSelect = document.getElementById("course_id");
const message = document.getElementById("form-message");
const courseGrid = document.getElementById("course-grid");

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxnveLjHuRJN3-X6BBeVn_X26hRUU0K2Ou_-CrX5m8ZjDoy0UX55RjoGwUxrOc5Fl3N/exec";

const MAX_RECEIPT_SIZE = 2 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf"
];

let activeCourses = [];
let isSubmitting = false;

function showMessage(text) {
  if (message) message.textContent = text;
}

function formatToman(value) {
  return Number(value || 0).toLocaleString("fa-IR") + " تومان";
}

function getCourseIcon(title = "") {
  if (title.includes("نئون")) return "💡";
  if (title.includes("فتوشاپ")) return "🎨";
  if (title.includes("مداحی") || title.includes("سرود")) return "🎙️";
  return "📘";
}

function getOrCreateReceiptInput() {
  let input = document.getElementById("receipt_file");
  if (input || !form) return input;

  const wrapper = document.createElement("div");
  wrapper.className = "form-group";

  const label = document.createElement("label");
  label.htmlFor = "receipt_file";
  label.textContent = "تصویر یا PDF فیش واریزی";

  input = document.createElement("input");
  input.type = "file";
  input.id = "receipt_file";
  input.name = "receipt_file";
  input.accept = ALLOWED_FILE_TYPES.join(",");
  input.required = true;

  const help = document.createElement("small");
  help.textContent = "فرمت مجاز JPG، PNG یا PDF؛ حداکثر ۲ مگابایت.";

  wrapper.append(label, input, help);

  const consent = document.getElementById("guardian_consent");
  const consentWrapper =
    consent?.closest(".form-group") || consent?.parentElement;

  if (consentWrapper && consentWrapper.parentElement === form) {
    form.insertBefore(wrapper, consentWrapper);
  } else {
    form.appendChild(wrapper);
  }

  return input;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");

      if (commaIndex < 0) {
        reject(new Error("خواندن فایل فیش ناموفق بود."));
        return;
      }

      resolve(result.slice(commaIndex + 1));
    };

    reader.onerror = () =>
      reject(new Error("خواندن فایل فیش ناموفق بود."));

    reader.readAsDataURL(file);
  });
}

function renderCourses() {
  if (courseSelect) {
    courseSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "کلاس موردنظر را انتخاب کنید";
    placeholder.disabled = true;
    placeholder.selected = true;
    courseSelect.appendChild(placeholder);

    for (const course of activeCourses) {
      const option = document.createElement("option");
      option.value = String(course.id);
      option.textContent =
        `${course.title} — ${formatToman(course.price_toman)}`;
      courseSelect.appendChild(option);
    }
  }

  if (!courseGrid) return;

  courseGrid.replaceChildren();

  for (const course of activeCourses) {
    const card = document.createElement("article");
    card.className = "course-card";

    const icon = document.createElement("div");
    icon.className = "course-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = getCourseIcon(course.title);

    const heading = document.createElement("h3");
    heading.textContent = course.title || "کلاس آموزشی";

    const description = document.createElement("p");
    description.textContent =
      course.description || "توضیحات این کلاس به‌زودی اضافه می‌شود.";

    const price = document.createElement("p");
    price.className = "course-price";
    price.textContent = "هزینه: " + formatToman(course.price_toman);

    const link = document.createElement("a");
    link.className = "btn";
    link.href = "#register";
    link.textContent = "ثبت‌نام در این کلاس";

    link.addEventListener("click", () => {
      if (courseSelect) courseSelect.value = String(course.id);
    });

    card.append(icon, heading, description, price, link);
    courseGrid.appendChild(card);
  }
}

async function startRegistrationApp() {
  if (!form || !courseSelect || !message) {
    console.error("فرم ثبت‌نام یا یکی از اجزای ضروری پیدا نشد.");
    return;
  }

  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_ANON_KEY
  ) {
    showMessage("اتصال سامانه تنظیم نشده است.");
    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  try {
    const { data: courses, error } = await client
      .from("courses")
      .select("id, title, description, price_toman")
      .eq("is_active", true)
      .order("title");

    if (error) throw error;

    activeCourses = courses || [];
    renderCourses();

    if (activeCourses.length === 0) {
      showMessage("در حال حاضر کلاسی برای ثبت‌نام وجود ندارد.");
      return;
    }
  } catch (error) {
    console.error("Course loading error:", error);
    showMessage("دریافت کلاس‌ها ناموفق بود.");
    return;
  }

  const receiptInput = getOrCreateReceiptInput();
  const submitButton = form.querySelector('[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (isSubmitting) return;
    if (!form.reportValidity()) return;

    const consent = document.getElementById("guardian_consent");

    if (!consent?.checked) {
      showMessage("رضایت ولی یا سرپرست الزامی است.");
      return;
    }

    const selectedCourse = activeCourses.find(
      (course) => String(course.id) === courseSelect.value
    );

    if (!selectedCourse) {
      showMessage("لطفاً یک کلاس معتبر انتخاب کنید.");
      return;
    }

    const file = receiptInput?.files?.[0];

    if (!file) {
      showMessage("لطفاً فیش واریزی را انتخاب کنید.");
      receiptInput?.focus();
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      showMessage("فیش باید JPG، PNG یا PDF باشد.");
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      showMessage("حجم فیش نباید بیشتر از ۲ مگابایت باشد.");
      return;
    }

    const record = {
      student_name:
        document.getElementById("student_name").value.trim(),
      grade: document.getElementById("grade").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      guardian_name:
        document.getElementById("guardian_name").value.trim(),
      course_id: Number(selectedCourse.id),
      guardian_consent: true
    };

    if (
      !record.student_name ||
      !record.grade ||
      !record.phone ||
      !record.guardian_name ||
      !Number.isInteger(record.course_id)
    ) {
      showMessage("لطفاً اطلاعات ضروری را به‌درستی تکمیل کنید.");
      return;
    }

    isSubmitting = true;
    if (submitButton) submitButton.disabled = true;

    showMessage("در حال ثبت اطلاعات؛ لطفاً صفحه را نبندید...");

    try {
      // مرحله اول: ثبت اطلاعات در Supabase.
      // عمداً از select() استفاده نمی‌کنیم؛ اطلاعات ثبت‌نام عمومی نیست.
      const { error: insertError } = await client
        .from("registrations")
        .insert([record]);

      if (insertError) {
        console.error("Registration error:", insertError);
        showMessage(
          "ثبت‌نام در سامانه انجام نشد. خطای ثبت در Supabase را بررسی کنید."
        );
        return;
      }

      // مرحله دوم: آماده‌سازی و ارسال اطلاعات و فیش به Google Apps Script.
      showMessage("ثبت‌نام ذخیره شد؛ در حال ارسال فیش...");

      const receiptBase64 = await fileToBase64(file);

      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          ...record,
          course_title: selectedCourse.title,
          registration_id: "",
          receipt_name: file.name,
          receipt_mime_type: file.type,
          receipt_base64: receiptBase64
        })
      });

      form.reset();

      showMessage(
        "ثبت‌نام در سامانه ذخیره شد. درخواست ارسال فیش انجام شد؛ " +
        "برای اطمینان از ذخیره فیش، Google Sheets و Google Drive را بررسی کنید."
      );
    } catch (error) {
      console.error("Submission error:", error);
      showMessage(
        "در ارسال اطلاعات یا فیش مشکلی پیش آمد. " +
        "پیش از ارسال دوباره، جدول ثبت‌نام‌ها را بررسی کنید."
      );
    } finally {
      isSubmitting = false;
      if (submitButton) submitButton.disabled = false;
    }
  });
}

startRegistrationApp();
