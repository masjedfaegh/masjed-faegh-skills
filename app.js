
"use strict";

(() => {
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycbxnveLjHuRJN3-X6BBeVn_X26hRUU0K2Ou_-CrX5m8ZjDoy0UX55RjoGwUxrOc5Fl3N/exec";

  const MAX_RECEIPT_SIZE = 2 * 1024 * 1024;

  const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "application/pdf"
  ];

  const form = document.getElementById("registration-form");
  const courseSelect = document.getElementById("course_id");
  const message = document.getElementById("form-message");
  const courseGrid = document.getElementById("course-grid");
  const receiptInput = document.getElementById("receipt_file");
  const submitButton = form?.querySelector('[type="submit"]');

  let supabaseClient = null;
  let activeCourses = [];
  let isSubmitting = false;

  const fallbackCourses = [
    {
      title: "فتوشاپ",
      price_toman: 1500000,
      description:
        "آشنایی با طراحی گرافیکی و ابزارهای کاربردی برای خلق آثار تصویری."
    },
    {
      title: "سواد رسانه",
      price_toman: 1500000,
      description:
        "تقویت نگاه نقادانه و توانایی فهم و ارزیابی پیام‌های رسانه‌ای."
    },
    {
      title: "نئون فلکسی",
      price_toman: 2000000,
      description:
        "آشنایی با ساخت طرح‌های نوری و تجربه یک مهارت فنی و خلاقانه."
    },
    {
      title: "خوشنویسی",
      price_toman: 1500000,
      description:
        "تمرین خوش‌نویسی، دقت و زیبایی در نوشتار."
    }
  ];

  function setMessage(text, kind = "info") {
    if (!message) return;

    message.textContent = text;
    message.dataset.kind = kind;
  }

  function formatToman(value) {
    return `${Number(value || 0).toLocaleString("fa-IR")} تومان`;
  }

  function normalizeTitle(value) {
    return String(value || "")
      .replace(/\u200c/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function iconFor(title = "") {
    if (title.includes("نئون")) return "⚡";
    if (title.includes("فتوشاپ")) return "✎";
    if (title.includes("رسانه")) return "▣";
    if (title.includes("خوشنویسی")) return "✒";
    return "✦";
  }

  function tagFor(title = "") {
    if (title.includes("نئون")) return "مهارت فنی";
    if (title.includes("فتوشاپ")) return "مهارت دیجیتال";
    if (title.includes("رسانه")) return "سواد و تفکر";
    if (title.includes("خوشنویسی")) return "هنر و نوشتار";
    return "مهارت‌آموزی";
  }

  function dedupeCourses(rows) {
    const seen = new Set();

    return (rows || []).filter((course) => {
      const key = normalizeTitle(course.title);

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }

  function renderCourseOptions() {
    if (!courseSelect) return;

    const oldValue = courseSelect.value;
    courseSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "کلاس موردنظر را انتخاب کنید";
    placeholder.disabled = true;
    placeholder.selected = true;

    courseSelect.appendChild(placeholder);

    activeCourses.forEach((course) => {
      const option = document.createElement("option");

      option.value = String(
        course.id ?? `local:${normalizeTitle(course.title)}`
      );

      option.textContent =
        `${course.title} — ${formatToman(course.price_toman)}`;

      courseSelect.appendChild(option);
    });

    if (
      oldValue &&
      [...courseSelect.options].some(
        (option) => option.value === oldValue
      )
    ) {
      courseSelect.value = oldValue;
    }
  }

  function renderCourses() {
    if (!courseGrid) return;

    courseGrid.replaceChildren();

    activeCourses.forEach((course) => {
      const card = document.createElement("article");
      card.className = "course-card";

      const art = document.createElement("div");
      art.className = "course-art";

      const icon = document.createElement("div");
      icon.className = "course-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = iconFor(course.title);

      art.appendChild(icon);

      const body = document.createElement("div");
      body.className = "course-body";

      const tag = document.createElement("span");
      tag.className = "course-tag";
      tag.textContent = tagFor(course.title);

      const heading = document.createElement("h3");
      heading.textContent = course.title || "کلاس مهارتی";

      const description = document.createElement("p");
      description.textContent =
        course.description ||
        "برای دریافت جزئیات و زمان برگزاری با مسئول پایگاه هماهنگ می‌شود.";

      const price = document.createElement("p");
      price.className = "course-price";
      price.textContent =
        `هزینه: ${formatToman(course.price_toman)}`;

      const link = document.createElement("a");
      link.className = "btn btn-green";
      link.href = "#register";
      link.textContent = "ثبت‌نام در این کلاس";

      link.addEventListener("click", () => {
        if (!courseSelect) return;

        courseSelect.value = String(
          course.id ?? `local:${normalizeTitle(course.title)}`
        );
      });

      body.append(tag, heading, description, price, link);
      card.append(art, body);
      courseGrid.appendChild(card);
    });
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

      reader.onerror = () => {
        reject(new Error("خواندن فایل فیش ناموفق بود."));
      };

      reader.readAsDataURL(file);
    });
  }

  function getSelectedCourse() {
    const selectedValue = courseSelect?.value;

    return activeCourses.find((course) => {
      const courseValue = String(
        course.id ?? `local:${normalizeTitle(course.title)}`
      );

      return courseValue === selectedValue;
    });
  }

  async function loadCourses() {
    if (!courseSelect || !courseGrid) return;

    const configReady =
      window.SUPABASE_URL &&
      window.SUPABASE_ANON_KEY &&
      window.supabase &&
      typeof window.supabase.createClient === "function";

    if (!configReady) {
      activeCourses = fallbackCourses.map((course) => ({
        ...course,
        id: `local:${normalizeTitle(course.title)}`
      }));

      renderCourseOptions();
      renderCourses();

      setMessage(
        "اتصال پایگاه داده تنظیم نشده است؛ ثبت‌نام آنلاین فعال نیست.",
        "error"
      );

      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
      );

      const { data, error } = await supabaseClient
        .from("courses")
        .select("id,title,description,price_toman,is_active")
        .eq("is_active", true)
        .order("title", { ascending: true });

      if (error) throw error;

      const dbCourses = dedupeCourses(data || []);

      if (dbCourses.length > 0) {
        activeCourses = dbCourses;
      } else {
        activeCourses = fallbackCourses.map((course) => ({
          ...course,
          id: `local:${normalizeTitle(course.title)}`
        }));

        setMessage(
          "کلاس فعالی در پایگاه داده پیدا نشد. کلاس‌های نمایشی هستند و ثبت‌نام آنلاین فعال نیست.",
          "error"
        );
      }

      renderCourseOptions();
      renderCourses();
    } catch (error) {
      console.error("خطا در دریافت کلاس‌ها:", error);

      activeCourses = fallbackCourses.map((course) => ({
        ...course,
        id: `local:${normalizeTitle(course.title)}`
      }));

      renderCourseOptions();
      renderCourses();

      setMessage(
        "اتصال به فهرست کلاس‌ها برقرار نشد؛ ثبت‌نام آنلاین فعال نیست.",
        "error"
      );
    }
  }

  function validateForm() {
    if (!form || !form.reportValidity()) return false;

    const consent = document.getElementById("guardian_consent");

    if (!consent?.checked) {
      setMessage("تأیید والد یا سرپرست الزامی است.", "error");
      return false;
    }

    if (!supabaseClient) {
      setMessage(
        "اتصال ثبت‌نام فعال نیست. تنظیمات config.js و Supabase را بررسی کنید.",
        "error"
      );
      return false;
    }

    const course = getSelectedCourse();

    if (!course || !Number.isInteger(Number(course.id))) {
      setMessage(
        "لطفاً یک کلاس فعال از فهرست سامانه انتخاب کنید.",
        "error"
      );
      return false;
    }

    const file = receiptInput?.files?.[0];

    if (file) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setMessage("فیش باید JPG، PNG یا PDF باشد.", "error");
        return false;
      }

      if (file.size > MAX_RECEIPT_SIZE) {
        setMessage("حجم فیش نباید بیشتر از ۲ مگابایت باشد.", "error");
        return false;
      }
    }

    return true;
  }

  async function submitRegistration(event) {
    event.preventDefault();

    if (isSubmitting || !validateForm()) return;

    const course = getSelectedCourse();
    const file = receiptInput?.files?.[0] || null;

    const record = {
      student_name:
        document.getElementById("student_name")?.value.trim() || "",
      grade:
        document.getElementById("grade")?.value || "",
      phone:
        document.getElementById("phone")?.value.trim() || "",
      guardian_name:
        document.getElementById("guardian_name")?.value.trim() || "",
      course_id: Number(course.id),
      guardian_consent: true
    };

    if (
      !record.student_name ||
      !record.grade ||
      !record.phone ||
      !record.guardian_name
    ) {
      setMessage("لطفاً همه اطلاعات ضروری را تکمیل کنید.", "error");
      return;
    }

    isSubmitting = true;

    if (submitButton) submitButton.disabled = true;

    setMessage(
      "در حال ثبت اطلاعات؛ لطفاً صفحه را نبندید.",
      "info"
    );

    try {
      // گام اول: ثبت اطلاعات در Supabase
      const { error: insertError } = await supabaseClient
        .from("registrations")
        .insert([record]);

      if (insertError) {
        console.error("خطای ثبت در Supabase:", insertError);

        setMessage(
          "ثبت‌نام در پایگاه داده انجام نشد. ستون‌های جدول registrations و دسترسی RLS را بررسی کنید.",
          "error"
        );

        return;
      }

      // گام دوم: آماده‌سازی اطلاعات برای Google Sheets
      const payload = {
        student_name: record.student_name,
        grade: record.grade,
        phone: record.phone,
        guardian_name: record.guardian_name,
        course_id: record.course_id,
        course_title: course.title,
        registration_id: "",
        receipt_name: "",
        receipt_mime_type: "",
        receipt_base64: ""
      };

      // اگر فیش انتخاب شده باشد، آن را نیز به payload اضافه می‌کنیم.
      if (file) {
        setMessage(
          "اطلاعات ثبت شد؛ در حال آماده‌سازی فیش پرداخت…",
          "info"
        );

        payload.receipt_base64 = await fileToBase64(file);
        payload.receipt_name = file.name;
        payload.receipt_mime_type = file.type;
      }

      // گام سوم: ارسال به Apps Script در هر دو حالتِ با فیش و بدون فیش.
      setMessage(
        "در حال ارسال اطلاعات به گوگل‌شیت؛ لطفاً صفحه را نبندید.",
        "info"
      );

      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      form.reset();

      if (courseSelect) {
        courseSelect.selectedIndex = 0;
      }

      setMessage(
        "ثبت‌نام در پایگاه داده ذخیره شد و درخواست ارسال اطلاعات به گوگل‌شیت نیز فرستاده شد. لطفاً برای اطمینان، برگه ثبت‌نام‌ها را بررسی کنید.",
        "success"
      );
    } catch (error) {
      console.error("خطای ثبت‌نام یا ارسال به گوگل‌شیت:", error);

      setMessage(
        "ثبت یا ارسال اطلاعات با خطا مواجه شد. قبل از تلاش دوباره، Supabase و گوگل‌شیت را بررسی کنید تا ثبت تکراری ایجاد نشود.",
        "error"
      );
    } finally {
      isSubmitting = false;

      if (submitButton) submitButton.disabled = false;
    }
  }

  function init() {
    if (!form || !courseSelect || !message || !courseGrid) {
      console.error(
        "اجزای ضروری فرم یا فهرست کلاس‌ها در index.html پیدا نشدند."
      );
      return;
    }

    form.addEventListener("submit", submitRegistration);
    loadCourses();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
