import { Router } from "express";
import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * POST /auth/verify
 * Verify a login code and return the user data
 */
router.post("/verify", async (req: Request, res: Response) => {
  const { loginCode } = req.body;

  if (!loginCode) {
    return res.status(400).json({ error: "Login code is required" });
  }

  try {
    // Normalize the code: trim and convert to lowercase
    const normalizedCode = loginCode.trim().toLowerCase();

    console.log(`🔐 Attempting login with code: ${normalizedCode}`);

    // Use ilike for case-insensitive comparison directly in database
    const { data, error } = await supabase
      .from("berry_users")
      .select("id, name, login_code, created_at")
      .ilike("login_code", normalizedCode)
      .single();

    if (error || !data) {
      console.log(`❌ Login failed: Invalid code`);
      return res.status(404).json({ error: "Invalid login code" });
    }

    console.log(`✅ Login successful for user: ${data.name} (${data.id})`);

    // Return complete user object
    return res.status(200).json({
      user: {
        id: data.id,
        name: data.name,
        login_code: data.login_code,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    console.error("❌ Auth error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { router as authRouter };
