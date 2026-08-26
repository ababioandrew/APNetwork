import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
dotenv.config();

console.log('🚀 Server starting...');
console.log('📦 Environment:', process.env.NODE_ENV || 'development');

const app = express();

//=====================================================
// SUPABASE CONFIGURATION
//=====================================================

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase credentials");
  console.error("SUPABASE_URL:", supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error("SUPABASE_ANON_KEY:", supabaseAnonKey ? '✅ Set' : '❌ Missing');
  // Don't exit in Vercel, let it try to start
}

console.log(`✅ Supabase URL configured: ${supabaseUrl?.substring(0, 20)}...`);

//=====================================================
// MIDDLEWARE
//=====================================================

app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://*.vercel.app',
      'https://*.now.sh',
      // Add your custom domain if any
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

//=====================================================
// SUPABASE CLIENT
//=====================================================

let supabase;

try {
  supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
  console.log("✅ Supabase client created successfully");
} catch (error) {
  console.error("❌ Failed to create Supabase client:", error.message);
}

//=====================================================
// EMAIL
//=====================================================

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
    console.warn("⚠️ Email credentials not configured");
  }
} catch (error) {
  console.error("❌ Email configuration error:", error.message);
}

//=====================================================
// HEALTH CHECK (Vercel-friendly)
//=====================================================

app.get("/api/health", async (req, res) => {
  console.log('📥 Health check requested');
  
  try {
    if (!supabase) {
      return res.status(500).json({
        success: false,
        message: "Supabase client not initialized",
      });
    }

    const { data, error, count } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Table might not exist yet
      if (error.message.includes('relation "members" does not exist')) {
        return res.json({
          success: true,
          message: "Backend is running but members table not created yet",
          database: "Supabase connected",
          tableExists: false,
          hint: "Please create the members table in Supabase SQL Editor"
        });
      }
      throw error;
    }

    res.json({
      success: true,
      message: "Backend and Supabase are working",
      database: "Connected to Supabase",
      memberCount: count || 0,
      tableExists: true
    });
  } catch (error) {
    console.error("❌ Health check error:", error.message);
    res.status(500).json({
      success: false,
      message: "Health check failed",
      error: error.message,
    });
  }
});

//=====================================================
// GET MEMBERS
//=====================================================

app.get("/api/members", async (req, res) => {
  console.log('📥 GET /api/members request received');
  
  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('❌ Supabase error:', error.message);
      throw error;
    }

    console.log(`✅ Found ${data?.length || 0} members`);
    
    res.json({
      success: true,
      members: data || [],
    });
  } catch (error) {
    console.error("❌ GET members error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//=====================================================
// GET MEMBER
//=====================================================

app.get("/api/members/:id", async (req, res) => {
  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.json({
      success: true,
      member: data,
    });
  } catch (error) {
    console.error("GET member error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//=====================================================
// CREATE MEMBER
//=====================================================

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
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          fullName: fullName.trim(),
          gender: gender,
          location: location?.trim() || null,
          dateOfBirth: dateOfBirth || null,
          dateOfEntry: dateOfEntry,
          contacts: contacts?.trim() || null,
          remarks: remarks?.trim() || null,
        }
      ])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: "Membership details saved successfully!",
      member: data,
    });
  } catch (error) {
    console.error("POST member error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//=====================================================
// UPDATE MEMBER
//=====================================================

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
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
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
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.json({
      success: true,
      message: "Member updated successfully!",
      member: data,
    });
  } catch (error) {
    console.error("PUT member error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//=====================================================
// DELETE MEMBER
//=====================================================

app.delete("/api/members/:id", async (req, res) => {
  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
      .delete()
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Member not found",
      });
    }

    res.json({
      success: true,
      message: "Member deleted successfully!",
      member: data,
    });
  } catch (error) {
    console.error("DELETE member error:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

//=====================================================
// ENQUIRY
//=====================================================

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

    if (transporter) {
      try {
        await transporter.sendMail({
          from: `"Answered Prayer Network" <${process.env.EMAIL_USER}>`,
          to: process.env.ENQUIRY_EMAIL,
          subject: "New Church Website Enquiry",
          text: `${emailMessage}\n\nWhatsApp Caption:\n${whatsappMessage}`,
          html: `
            <h2>New Church Website Enquiry</h2>
            <p>${escapeHtml(emailMessage)}</p>
            <hr/>
            <p><strong>WhatsApp Caption:</strong></p>
            <p>${escapeHtml(whatsappMessage)}</p>
          `,
        });
        console.log("✅ Enquiry email sent");
      } catch (emailError) {
        console.error("❌ Email send error:", emailError.message);
      }
    } else {
      console.warn("⚠️ Email not sent - transporter not configured");
    }

    res.json({
      success: true,
      message: "Enquiry sent successfully.",
      whatsappCaption: whatsappMessage,
    });
  } catch (error) {
    console.error("Send enquiry error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send enquiry.",
      error: error.message,
    });
  }
});

//=====================================================
// BIRTHDAYS
//=====================================================

app.get("/api/members/birthdays", async (req, res) => {
  try {
    if (!supabase) {
      throw new Error("Supabase client not initialized");
    }

    const { data, error } = await supabase
      .from('members')
      .select(`
        id,
        fullName,
        gender,
        location,
        dateOfBirth,
        contacts,
        remarks
      `)
      .not('dateOfBirth', 'is', null);

    if (error) throw error;

    const currentMonth = new Date().getMonth() + 1;
    const filteredData = (data || [])
      .filter(member => {
        if (!member.dateOfBirth) return false;
        const dob = new Date(member.dateOfBirth);
        return dob.getMonth() + 1 === currentMonth;
      })
      .sort((a, b) => {
        const aDay = new Date(a.dateOfBirth).getDate();
        const bDay = new Date(b.dateOfBirth).getDate();
        return aDay - bDay;
      });

    const birthdays = filteredData.map(member => ({
      ...member,
      age: new Date().getFullYear() - new Date(member.dateOfBirth).getFullYear()
    }));

    res.json({
      success: true,
      month: new Date().toLocaleString("en-US", { month: "long" }),
      count: birthdays.length,
      birthdays: birthdays,
    });
  } catch (error) {
    console.error("Birthdays error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve birthday celebrants",
      error: error.message,
    });
  }
});

//=====================================================
// 404
//=====================================================

app.use((req, res) => {
  console.log(`404: ${req.method} ${req.path}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.path
  });
});

//=====================================================
// ERROR HANDLER
//=====================================================

app.use((error, req, res, next) => {
  console.error("Unhandled error:", error.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

//=====================================================
// EXPORT FOR VERCEL
//=====================================================

export default app;