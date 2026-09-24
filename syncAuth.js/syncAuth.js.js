const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gfqqkqmegioqejlvowwt.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmcXFrcW1lZ2lvcWVqbHZvd3d0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDIwNzcyNSwiZXhwIjoyMDk1NzgzNzI1fQ.tnowPbbGH1i89fVWfAal_xYXx8P4J3K-fn74TK0RlXI'; 

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function syncAuthUsers() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) return console.error('Error fetching profiles:', error);

  console.log(`Creating auth users for ${profiles.length} profiles...`);

  for (const profile of profiles) {
    const { error: authError } = await supabase.auth.admin.createUser({
      id: profile.id, // Enforces exact UUID match from profiles table
      email: profile.email,
      password: 'DefaultPassword123!', // Temporary password for user sign-ins
      email_confirm: true,
      user_metadata: { name: profile.name, role: profile.role }
    });

    if (authError) {
      console.error(`Skipped ${profile.email}:`, authError.message);
    } else {
      console.log(`Created Auth User: ${profile.email} | ID: ${profile.id}`);
    }
  }
}

syncAuthUsers();