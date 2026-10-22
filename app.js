
const form = document.getElementById("registration-form");
const courseSelect = document.getElementById("course_id");
const message = document.getElementById("form-message");
const courseGrid = document.getElementById("course-grid");

function getCourseIcon(title) {
  const name = title.trim();

  if (name.includes("نئون")) return "💡";
  if (name.includes("فتوشاپ")) return "🎨";
  if (name.includes("مداحی") || name.includes("سرود")) return "🎙️";

  return "📘";
}

function renderCourses(courses) {
  if (!courseGrid) return;

  courseGrid.replaceChildren();

  for (const course of courses) {
    const card = document.createElement("article");
    card.className = "course-card";

    const icon = document.createElement("div");
    icon.className = "course-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = getCourseIcon(course.title || "");

    const heading = document.createElement("h3");
    heading.textContent = course.title || "کلاس آموزشی";

    const description = document.createElement("p");
    description.textContent =
      course.description || "توضیحات این کلاس به‌زودی اضافه می‌شود.";

    const link = document.createElement("a");
    link.className = "btn";
    link.href = "#register";
    link.textContent = "ثبت‌نام در این کلاس";

    link.addEventListener("click", () => {
      courseSelect.value = String(course.id);
    });

    card.append(icon, heading, description, link);
    courseGrid.appendChild(card);
  }
}

async function startRegistrationApp() {
  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_ANON_KEY
  ) {
    if (message) {
      message.textContent = "اتصال سامانه هنوز تنظیم نشده است.";
    }
    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  const { data: courses, error } = await client
    .from("courses")
    .select("id, title, description")
    .eq("is_active", true)
    .order("title");

  if (error) {
    console.error("Courses error:", error);

    if (message) {
      message.textContent = "دریافت کلاس‌ها ناموفق بود.";
    }
    return;
  }

  const activeCourses = courses || [];

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
      option.textContent = course.title;
      courseSelect.appendChild(option);
    }
  }

  renderCourses(activeCourses);

  if (!form || !courseSelect || !message) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const consent = document.getElementById("guardian_consent");

    if (!consent || !consent.checked) {
      message.textContent = "رضایت ولی یا سرپرست الزامی است.";
      return;
    }

    if (!courseSelect.value) {
      message.textContent = "لطفاً یک کلاس انتخاب کنید.";
      courseSelect.focus();
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

    message.textContent = "در حال ارسال درخواست...";

    const { error: insertError } = await client
      .from("registrations")
      .insert([record]);

    if (insertError) {
      console.error("Registration error:", insertError);
      message.textContent =
        "ثبت‌نام انجام نشد. تنظیمات پایگاه داده نیاز به بررسی دارد.";
      return;
    }

    form.reset();
    message.textContent = "درخواست ثبت‌نام با موفقیت ارسال شد.";
  });
}

startRegistrationApp();
