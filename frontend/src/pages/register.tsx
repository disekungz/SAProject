import React, { useState } from "react";
import {
  TextField, Button, Paper, Typography, Box, Alert, Divider, Link
} from "@mui/material";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import { api } from "../lib/axios";
import { useNavigate, Link as RouterLink } from "react-router-dom";

export default function RegisterPage() {
  const nav = useNavigate();

  // --- ⭐️ 1. เพิ่ม citizenId เข้าไปใน state ของฟอร์ม ---
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    birthday: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    citizenId: "", // <--- เพิ่มที่นี่
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // --- ⭐️ 2. เพิ่ม citizenId เข้าไปใน validation ---
    const required = ["username","password","email","firstName","lastName","birthday", "citizenId"] as const;
    for (const k of required) {
      if (!String(form[k]).trim()) {
        setError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
        return;
      }
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (form.citizenId.trim().length !== 13) {
        setError("เลขบัตรประชาชนต้องมี 13 หลัก");
        return;
    }

    try {
      setSubmitting(true);
      // --- ⭐️ 3. เพิ่ม citizenId เข้าไปใน payload ที่ส่งให้ backend ---
      await api.post("/auth/register", {
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthday: form.birthday,
        citizenId: form.citizenId.trim(), // <--- เพิ่มที่นี่
      });
      nav("/login", { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.error || "สมัครสมาชิกไม่สำเร็จ";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        backgroundImage: 'url(/images/register-bg.jpg)',
        backgroundSize: "cover",
        backgroundPosition: "center",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.45)",
        },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          position: "relative",
          zIndex: 1,
          width: { xs: "92%", sm: 440 },
          p: 4,
          borderRadius: 3,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          backdropFilter: "blur(10px)",
          color: "#fff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1 }}>
          <PersonAddAlt1Icon />
          <Typography variant="h5" fontWeight={700}>
            สมัครสมาชิก
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 2, opacity: 0.85 }}>
          หากอีเมลตรงกับข้อมูลเจ้าหน้าที่ ระบบจะกำหนดสิทธิ์ตามตำแหน่งให้โดยอัตโนมัติ
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={submit} noValidate>
          <TextField
            fullWidth label="Username" margin="dense"
            value={form.username} onChange={onChange("username")} required
            variant="filled"
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <TextField
            fullWidth label="Password" type="password" margin="dense"
            value={form.password} onChange={onChange("password")} required
            variant="filled" inputProps={{ minLength: 6 }}
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <TextField
            fullWidth label="Email" type="email" margin="dense"
            value={form.email} onChange={onChange("email")} required
            variant="filled"
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          {/* --- ⭐️ 4. เพิ่ม TextField สำหรับ Citizen ID --- */}
          <TextField
            fullWidth label="เลขบัตรประชาชน (Citizen ID)" margin="dense"
            value={form.citizenId} onChange={onChange("citizenId")} required
            variant="filled"
            inputProps={{ maxLength: 13 }}
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              fullWidth label="ชื่อ" margin="dense"
              value={form.firstName} onChange={onChange("firstName")} required
              variant="filled"
              InputProps={{ disableUnderline: true }}
              sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
            />
            <TextField
              fullWidth label="นามสกุล" margin="dense"
              value={form.lastName} onChange={onChange("lastName")} required
              variant="filled"
              InputProps={{ disableUnderline: true }}
              sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
            />
          </Box>

          <TextField
            fullWidth label="วันเกิด" type="date" margin="dense"
            value={form.birthday} onChange={onChange("birthday")} required
            InputLabelProps={{ shrink: true }}
            variant="filled"
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <Button
            fullWidth sx={{ mt: 2, py: 1.2, fontWeight: 700 }}
            type="submit" variant="contained" disabled={submitting}
          >
            {submitting ? "กำลังสมัคร..." : "สมัครสมาชิก"}
          </Button>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,.25)" }} />

          <Typography variant="body2" sx={{ textAlign: "center" }}>
            มีบัญชีแล้ว?{" "}
            <Link component={RouterLink} to="/login" sx={{ color: "#fff", textDecorationColor: "rgba(255,255,255,.6)" }}>
              เข้าสู่ระบบ
            </Link>
          </Typography>
        </form>
      </Paper>
    </Box>
  );
}


