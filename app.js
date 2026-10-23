
const form = document.getElementById("registration-form");
const courseSelect = document.getElementById("course_id");
const message = document.getElementById("form-message");
const courseGrid = document.getElementById("course-grid");

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxnveLjHuRJN3-X6BBeVn_X26hRUU0K2Ou_-CrX5m8ZjDoy0UX55RjoGwUxrOc5Fl3N/exec";

const MAX_RECEIPT_SIZE = 2 * 1024 * 1024;

function getCourseIcon(title = "") {
  if (title.includes("نئون")) return "💡";
  if (title.includes("فتوشاپ")) return "🎨";
  if (title.includes("مداحی") || title.includes("سرود")) return "🎙️";
  return "📘";
}

function showMessage(text) {
  if (message) message.textContent = text;
}

function formatToman(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("fa-IR") + " تومان";
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
  input.accept = "image/jpeg,image/png,application/pdf";
  input.required = true;

  const help = document.createElement("small");
  help.textContent = "فرمت مجاز JPG، PNG یا PDF؛ حداکثر ۲ مگابایت.";

  wrapper.append(label, input, help);

  const consent = document.getElementById("guardian_consent");
  const consentWrapper = consent?.closest(".form-group") || consent?.parentElement;

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

    reader.onerror = () => reject(new Error("خواندن فایل فیش ناموفق بود."));
    reader.readAsDataURL(file);
  });
}
let activeCourses = [];
async function startRegistrationApp() {
  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_ANON_KEY
  ) {
    showMessage("اتصال سامانه تنظیم نشده است. لطفاً بعداً تلاش کنید.");
    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  const { data: courses, error } = await client
    .from("courses")
    .select("id, title, description, price_toman")
    .eq("is_active", true)
    .order("title");

  if (error) {
    console.error("Course loading error:", error);
    showMessage("دریافت کلاس‌ها ناموفق بود.");
    return;
  }

 activeCourses = courses || [];
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

  if (courseGrid) {
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

  if (!form || !courseSelect || !message) return;

  const receiptInput = getOrCreateReceiptInput();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const consent = document.getElementById("guardian_consent");

    if (!consent?.checked) {
      showMessage("رضایت ولی یا سرپرست الزامی است.");
      return;
    }

    if (!courseSelect.value) {
      showMessage("لطفاً یک کلاس انتخاب کنید.");
      courseSelect.focus();
      return;
    }

    const file = receiptInput?.files?.[0];

    if (!file) {
      showMessage("لطفاً فیش واریزی را انتخاب کنید.");
      receiptInput?.focus();
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "application/pdf"
    ];

    if (!allowedTypes.includes(file.type)) {
      showMessage("فیش باید JPG، PNG یا PDF باشد.");
      return;
    }

    if (file.size > MAX_RECEIPT_SIZE) {
      showMessage("حجم فیش نباید بیشتر از ۲ مگابایت باشد.");
      return;
    }

    const selectedCourse = activeCourses.find(
      (course) => String(course.id) === courseSelect.value
    );

    if (!selectedCourse) {
      showMessage("کلاس انتخاب‌شده معتبر نیست؛ صفحه را تازه‌سازی کنید.");
      return;
    }

    const record = {
      student_name: document.getElementById("student_name").value.trim(),
      grade: document.getElementById("grade").value,
      phone: document.getElementById("phone").value.trim(),
      guardian_name: document.getElementById("guardian_name").value.trim(),
      course_id: courseSelect.value,
      guardian_consent: true
    };

    if (
      !record.student_name ||
      !record.grade ||
      !record.phone ||
      !record.guardian_name
    ) {
      showMessage("لطفاً تمام اطلاعات ضروری را تکمیل کنید.");
      return;
    }

    const submitButton = form.querySelector('[type="submit"]');

    if (submitButton) submitButton.disabled = true;
    showMessage("در حال ثبت اطلاعات؛ لطفاً صفحه را نبندید...");

    try {
      // مرحله اول: ذخیره ثبت‌نام در Supabase
      console.log("Registration data:", record);
console.log("Active courses:", activeCourses);
      const { data: insertedRows, error: insertError } = await client
        .from("registrations")
        .insert([record])
        .select("id")
        .limit(1);

      if (insertError) {
        console.error("Registration error:", insertError);
        showMessage(
          "ثبت‌نام در سامانه انجام نشد. لطفاً بعداً تلاش کنید."
        );
        return;
      }

      const registrationId = insertedRows?.[0]?.id;

      if (!registrationId) {
        showMessage(
          "ثبت‌نام ذخیره شد، اما شناسه آن دریافت نشد. برای جلوگیری از ثبت تکراری، دوباره ارسال نکنید."
        );
        return;
      }

      showMessage("ثبت‌نام ذخیره شد؛ در حال ارسال فیش...");

      const receiptBase64 = await fileToBase64(file);

      // مرحله دوم: ارسال اطلاعات و فیش به Google Apps Script
      // no-cors پاسخ قابل‌خواندن نمی‌دهد؛ ذخیره موفق فایل از اینجا
      // قابل تأیید نیست و باید در Google Drive و Sheets بررسی شود.
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
          ...record,
          course_title: selectedCourse.title,
          registration_id: String(registrationId),
          receipt_name: file.name,
          receipt_mime_type: file.type,
          receipt_base64: receiptBase64
        })
      });

      form.reset();

      showMessage(
        "ثبت‌نام در سامانه ذخیره شد. ارسال فیش انجام شد، اما تأیید ذخیره آن هنوز لازم است. وضعیت پرداخت پس از بررسی مسئول مربوط مشخص می‌شود."
      );
    } catch (error) {
      console.error("Submission error:", error);
      showMessage(
        "در ارسال اطلاعات یا فیش مشکلی پیش آمد. ممکن است ثبت‌نام قبلاً ذخیره شده باشد؛ قبل از ارسال مجدد، ثبت‌نام را بررسی کنید."
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

startRegistrationApp();
