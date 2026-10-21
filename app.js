
const form = document.getElementById("registration-form");
const courseSelect = document.getElementById("course_id");
const message = document.getElementById("form-message");

async function startRegistrationApp() {
  if (
    !window.supabase ||
    !window.SUPABASE_URL ||
    !window.SUPABASE_ANON_KEY
  ) {
    message.textContent = "اتصال سامانه هنوز تنظیم نشده است.";
    return;
  }

  const client = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_ANON_KEY
  );

  const { data: courses, error } = await client
    .from("courses")
    .select("id, title")
    .eq("is_active", true)
    .order("title");

  if (error) {
    message.textContent = "دریافت کلاس‌ها ناموفق بود.";
    return;
  }

  for (const course of courses || []) {
    const option = document.createElement("option");
    option.value = course.id;
    option.textContent = course.title;
    courseSelect.appendChild(option);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const consent = document.getElementById("guardian_consent");

    if (!consent || !consent.checked) {
      message.textContent = "رضایت ولی یا سرپرست الزامی است.";
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

if (form && courseSelect && message) {
  startRegistrationApp();
}
