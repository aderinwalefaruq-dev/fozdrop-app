import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, name, phone_number, role, student_staff_id } = await req.json();

    if (!email || !password || !name || !role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, name, role" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validRoles = ["Customer", "Vendor", "Operator"];
    if (!validRoles.includes(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role. Must be Customer, Vendor, or Operator" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Step 1: Create user via admin API — email_confirm:true skips verification email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        phone_number: phone_number || "",
        student_staff_id: student_staff_id || "",
      },
    });

    if (authError) {
      console.error("createUser failed:", authError.message);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user?.id;
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User created but no ID returned" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Update profile row (trigger already inserted it; this adds phone + role)
    const { error: profileError } = await supabaseAdmin.from("profiles").update({
      name,
      phone_number: phone_number || "",
      student_staff_id: student_staff_id || "",
      role,
    }).eq("id", userId);

    if (profileError) {
      console.error("profile update failed:", profileError.message);
      // Non-fatal — user still exists; proceed to sign them in
    }

    // Step 3: Issue a session via admin — avoids the public signInWithPassword
    // rate-limit (3 req/30 s per IP) that blocked new registrations.
    const { data: sessionData, error: sessionError } =
      await supabaseAdmin.auth.admin.getUserById(userId);

    if (sessionError || !sessionData?.user) {
      console.error("getUserById failed:", sessionError?.message);
      return new Response(
        JSON.stringify({ error: "Account created but could not start session. Please log in manually." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the admin client to generate a magic-link token, then exchange it
    // for a real access+refresh token pair — fully bypasses rate limits.
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: "" },
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error("generateLink failed:", linkError?.message);
      // Fallback: tell client to sign in manually (account was created successfully)
      return new Response(
        JSON.stringify({ error: null, manualLogin: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange the OTP token for a session (verifyOtp works server-side with admin key)
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: otpData, error: otpError } = await supabaseAnon.auth.verifyOtp({
      email,
      token: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (otpError || !otpData?.session) {
      console.error("verifyOtp failed:", otpError?.message);
      // Account is created — tell client to sign in with their credentials
      return new Response(
        JSON.stringify({ error: null, manualLogin: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ session: otpData.session, user: otpData.user }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("register-user unhandled error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
