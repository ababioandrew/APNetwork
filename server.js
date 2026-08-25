import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

console.log("🚀 Server starting...");
console.log("📦 Environment:", process.env.NODE_ENV || "development");

const app = express();


// =====================================================
// SUPABASE CONFIGURATION
// =====================================================

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();


// -----------------------------------------------------
// SUPABASE URL CHECK
// -----------------------------------------------------

if (!supabaseUrl) {
  console.error("❌ SUPABASE_URL is missing.");
  console.error("Add SUPABASE_URL=https://your-project-id.supabase.co");
  process.exit(1);
}

if (!supabaseUrl.startsWith("https://")) {
  console.error("❌ SUPABASE_URL must start with https://");
  console.error(`Current value: ${supabaseUrl}`);
  process.exit(1);
}


// -----------------------------------------------------
// SERVICE ROLE KEY CHECK
// -----------------------------------------------------

if (!supabaseServiceRoleKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing.");
  console.error("The backend requires the Supabase service role key.");
  console.error("Add SUPABASE_SERVICE_ROLE_KEY to your backend .env file.");
  process.exit(1);
}


// -----------------------------------------------------
// LOG CONFIGURATION SAFELY
// -----------------------------------------------------

console.log(`✅ Supabase URL configured: ${supabaseUrl.substring(0, 30)}...`);
console.log("✅ Supabase service-role key detected.");

if (supabaseAnonKey) {
  console.log("ℹ️ Supabase anon key also detected.");
}


// =====================================================
// ENVIRONMENT VARIABLES
// =====================================================

const requiredEnv = ["EMAIL_USER", "EMAIL_PASS", "ENQUIRY_EMAIL"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`⚠️ Warning: ${key} is not configured.`);
  }
}


// =====================================================
// CORS
// =====================================================
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5000",

  // Add your Vercel frontend URL
  //  REACT_APP_API_URL=https://your-backend.vercel.app
  "https://your-frontend.vercel.app",
  "https://your-frontend-git-branch.vercel.app",
  // Add custom domain if you have one
  "https://yourdomain.com",
  process.env.FRONTEND_URL?.trim(),
].filter(Boolean);

console.log("🌐 Allowed frontend origins:");
console.log(allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like Postman/server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // For development, allow all localhost origins
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }

      // For Vercel preview deployments
      if (origin.includes('.vercel.app')) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn(`⚠️ CORS request from unapproved origin: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// =====================================================
// BODY PARSING
// =====================================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);


// =====================================================
// SUPABASE CLIENT
// =====================================================
//
// IMPORTANT:
//
// This is the SERVER-SIDE Supabase client.
//
// It uses SUPABASE_SERVICE_ROLE_KEY instead
// of SUPABASE_ANON_KEY.
//
// NEVER expose this key in React/Vite.
//
// =====================================================

let supabase;

try {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("✅ Supabase server client created successfully");
} catch (error) {
  console.error("❌ Failed to create Supabase client:", error.message);
  process.exit(1);
}


// =====================================================
// EMAIL
// =====================================================

let transporter = null;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log("✅ Email transporter configured");
  } else {
    console.warn("⚠️ Email credentials not configured.");
    console.warn("⚠️ Email sending will be disabled.");
  }
} catch (error) {
  console.error("❌ Email configuration error:", error.message);
}


// =====================================================
// DATABASE TEST
// =====================================================

let databaseReady = false;

async function initializeDatabase() {
  try {
    console.log("🔄 Testing Supabase database connection...");

    const { data, error, count } = await supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      });

    if (error) {
      databaseReady = false;
      console.error("❌ Supabase database error:", error.message);
      console.error("Supabase error code:", error.code || "N/A");
      console.error("Supabase details:", error.details || "N/A");
      console.error("Supabase hint:", error.hint || "N/A");

      if (error.message?.toLowerCase().includes("relation")) {
        console.error("⚠️ The members table may not exist.");
        console.error("📝 Please create the members table in Supabase.");
      }
      return;
    }

    databaseReady = true;
    console.log("✅ Connected to Supabase database");
    console.log(`✅ Found ${count || 0} members in database`);
  } catch (error) {
    databaseReady = false;
    console.error("❌ Database initialization error:", error.message);
  }
}

// Start database test.
initializeDatabase();


// =====================================================
// TEST ROUTE
// =====================================================

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend is working!",
    env: {
      supabaseUrl: !!supabaseUrl,
      serviceKey: !!supabaseServiceRoleKey,
      databaseReady: databaseReady,
    },
  });
});


// =====================================================
// HEALTH CHECK
// =====================================================

app.get("/api/health", async (req, res) => {
  try {
    const { data, error, count } = await supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Database connection failed",
        error: error.message,
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Backend and Supabase are working",
      database: "Connected to Supabase",
      memberCount: count || 0,
      supabaseUrl: `${supabaseUrl.substring(0, 30)}...`,
    });
  } catch (error) {
    console.error("❌ Health check error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message,
    });
  }
});


// =====================================================
// COMMERCIAL
// =====================================================

app.get("/api/commercial", (req, res) => {
  return res.json({
    success: true,
    enabled: true,
    videoUrl: "/src/assets/videos/commercial.mp4",
    duration: 10,
    triggers: [5, 10, 15],
  });
});


// =====================================================
// BIRTHDAYS
// =====================================================

app.get("/api/members/birthdays", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("members")
      .select(`
        id,
        fullName,
        gender,
        location,
        dateOfBirth,
        contacts,
        remarks
      `)
      .not("dateOfBirth", "is", null);

    if (error) {
      throw error;
    }

    const currentMonth = new Date().getMonth() + 1;

    const filteredData = (data || [])
      .filter((member) => {
        if (!member.dateOfBirth) {
          return false;
        }
        const dob = new Date(member.dateOfBirth);
        return dob.getMonth() + 1 === currentMonth;
      })
      .sort((a, b) => {
        const aDay = new Date(a.dateOfBirth).getDate();
        const bDay = new Date(b.dateOfBirth).getDate();
        return aDay - bDay;
      });

    const birthdays = filteredData.map((member) => ({
      ...member,
      age: new Date().getFullYear() - new Date(member.dateOfBirth).getFullYear(),
    }));

    return res.status(200).json({
      success: true,
      month: new Date().toLocaleString("en-US", {
        month: "long",
      }),
      count: birthdays.length,
      birthdays,
    });
  } catch (error) {
    console.error("❌ Birthdays error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve birthday celebrants",
      error: error.message,
    });
  }
});


// =====================================================
// GET MEMBERS
// =====================================================

app.get("/api/members", async (req, res) => {
  console.log("📥 GET /api/members request received");
  console.log("Supabase URL:", supabaseUrl ? "Configured" : "Missing");
  console.log("Service Role Key:", supabaseServiceRoleKey ? "Configured" : "Missing");
  console.log("Database Ready:", databaseReady);

  try {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .order("id", {
        ascending: false,
      });

    if (error) {
      console.error("❌ Supabase GET members error:");
      console.error("Message:", error.message);
      console.error("Code:", error.code || "N/A");
      console.error("Details:", error.details || "N/A");
      console.error("Hint:", error.hint || "N/A");

      return res.status(500).json({
        success: false,
        message: "Failed to load members from Supabase.",
        error: error.message,
        code: error.code || null,
        details: error.details || null,
        hint: error.hint || null,
      });
    }

    console.log(`✅ Found ${data?.length || 0} members`);

    return res.status(200).json({
      success: true,
      members: data || [],
    });
  } catch (error) {
    console.error("❌ GET members error:", error);
    return res.status(500).json({
      success: false,
      message: "Server failed to retrieve members.",
      error: error.message || "Unknown server error",
    });
  }
});


// =====================================================
// GET SINGLE MEMBER
// =====================================================

app.get("/api/members/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("members")
      .select("*")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      member: data,
    });
  } catch (error) {
    console.error("❌ GET member error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve member.",
      error: error.message,
    });
  }
});


// =====================================================
// CREATE MEMBER
// =====================================================

app.post("/api/members", async (req, res) => {
  const {
    fullName,
    gender,
    location,
    dateOfBirth,
    dateOfEntry,
    contacts,
    remarks,
  } = req.body;

  if (!fullName || !gender || !dateOfEntry) {
    return res.status(400).json({
      success: false,
      message: "Full name, gender and date of entry are required",
    });
  }

  try {
    const { data, error } = await supabase
      .from("members")
      .insert([
        {
          fullName: fullName.trim(),
          gender: gender,
          location: location?.trim() || null,
          dateOfBirth: dateOfBirth || null,
          dateOfEntry: dateOfEntry,
          contacts: contacts?.trim() || null,
          remarks: remarks?.trim() || null,
        },
      ])
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Membership details saved successfully!",
      member: data,
    });
  } catch (error) {
    console.error("❌ POST member error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save member.",
      error: error.message,
    });
  }
});


// =====================================================
// UPDATE MEMBER
// =====================================================

app.put("/api/members/:id", async (req, res) => {
  const {
    fullName,
    gender,
    location,
    dateOfBirth,
    dateOfEntry,
    contacts,
    remarks,
  } = req.body;

  if (!fullName || !gender || !dateOfEntry) {
    return res.status(400).json({
      success: false,
      message: "Full name, gender and date of entry are required",
    });
  }

  try {
    const { data, error } = await supabase
      .from("members")
      .update({
        fullName: fullName.trim(),
        gender: gender,
        location: location?.trim() || null,
        dateOfBirth: dateOfBirth || null,
        dateOfEntry: dateOfEntry,
        contacts: contacts?.trim() || null,
        remarks: remarks?.trim() || null,
        updatedAt: new Date().toISOString(),
      })
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member updated successfully!",
      member: data,
    });
  } catch (error) {
    console.error("❌ PUT member error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update member.",
      error: error.message,
    });
  }
});


// =====================================================
// DELETE MEMBER
// =====================================================

app.delete("/api/members/:id", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("members")
      .delete()
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Member deleted successfully!",
      member: data,
    });
  } catch (error) {
    console.error("❌ DELETE member error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete member.",
      error: error.message,
    });
  }
});

// =====================================================
// ENQUIRY
// =====================================================

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

app.post("/api/send-enquiry", async (req, res) => {
  try {
    const { message, whatsappCaption } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Enquiry message is required.",
      });
    }

    const emailMessage = message.trim();
    const whatsappMessage = whatsappCaption?.trim() || emailMessage;

    if (!transporter) {
      return res.status(503).json({
        success: false,
        message: "Email service is not configured on the server.",
      });
    }

    if (!process.env.ENQUIRY_EMAIL) {
      return res.status(503).json({
        success: false,
        message: "ENQUIRY_EMAIL is not configured.",
      });
    }

    await transporter.sendMail({
      from: `"Answered Prayer Network" <${process.env.EMAIL_USER}>`,
      to: process.env.ENQUIRY_EMAIL,
      subject: "New Church Website Enquiry",
      text: `${emailMessage}\n\nWhatsApp Caption:\n${whatsappMessage}`,
      html: `
        <h2>New Church Website Enquiry</h2>
        <p>${escapeHtml(emailMessage)}</p>
        <hr />
        <p><strong>WhatsApp Caption:</strong></p>
        <p>${escapeHtml(whatsappMessage)}</p>
      `,
    });

    console.log("✅ Enquiry email sent");

    return res.status(200).json({
      success: true,
      message: "Enquiry sent successfully.",
      whatsappCaption: whatsappMessage,
    });
  } catch (error) {
    console.error("❌ Send enquiry error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to send enquiry.",
      error: error.message,
    });
  }
});


// =====================================================
// 404 HANDLER
// =====================================================

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});


// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error.message);
  console.error("Stack:", error.stack);

  return res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});


// =====================================================
// START SERVER
const PORT = process.env.PORT || 5000;

// Only start the server if this file is run directly
// This is needed for Vercel serverless deployment
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log("✅ Using Supabase as database");
    console.log(`✅ Environment: ${process.env.NODE_ENV || "development"}`);
  });

  // Handle graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed");
    });
  });
}

export default app;
// =====================================================