import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Cleaning up lesson plans...");

  // 1. Fetch file paths
  const { data: plans } = await supabase.from("lesson_plans").select("file_path");
  const filePaths = (plans || []).map((p) => p.file_path).filter(Boolean);

  // 2. Delete storage files
  if (filePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("lesson-plans")
      .remove(filePaths);
    if (storageError) {
      console.warn("Storage cleanup note:", storageError.message);
    } else {
      console.log(`Deleted ${filePaths.length} storage files from 'lesson-plans' bucket.`);
    }
  }

  console.log("Ready to execute SQL in Supabase Dashboard.");
}

main();
