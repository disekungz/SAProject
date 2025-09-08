import React, { useState } from "react";
import {
  TextField, Button, Paper, Typography, Box, Alert
} from "@mui/material";
import { api } from "../lib/axios";
import { useNavigate, Link } from "react-router-dom";

export default function RegisterPage() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    firstName: "",
    lastName: "",
    // default วันนี้ในรูปแบบ YYYY-MM-DD (เข้ากับ <input type="date" />)
    birthday: new Date().toISOString().slice(0, 10),
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChange =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [k]: e.target.value }));
    };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !form.username.trim() ||
      !form.password.trim() ||
      !form.email.trim() ||
      !form.firstName.trim() ||
      !form.lastName.trim() ||
      !form.birthday.trim()
    ) {
      setError("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (form.password.length < 6) {
      setError("รหัสผ่านอย่างน้อย 6 ตัวอักษร");
      return;
    }

    try {
      setSubmitting(true);
      // ไม่ต้องส่ง rankId — backend จะตั้งเป็น “ญาติ/3” ให้อัตโนมัติ
      // และถ้าอีเมลตรง staff จะยกระดับตาม rank ของ staff ให้อัตโนมัติ
      await api.post("/auth/register", {
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        birthday: form.birthday, // YYYY-MM-DD (backend รองรับ)
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
    <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
      <Paper sx={{ p: 4, width: 420 }}>
        <Typography variant="h5" gutterBottom>สมัครสมาชิก</Typography>
        <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
          หากอีเมลตรงกับข้อมูลเจ้าหน้าที่ ระบบจะกำหนดสิทธิ์ตามตำแหน่งให้โดยอัตโนมัติ
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={submit} noValidate>
          <TextField
            fullWidth
            label="Username"
            margin="dense"
            value={form.username}
            onChange={onChange("username")}
            required
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            margin="dense"
            value={form.password}
            onChange={onChange("password")}
            required
            inputProps={{ minLength: 6 }}
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            margin="dense"
            value={form.email}
            onChange={onChange("email")}
            required
          />

          <TextField
            fullWidth
            label="ชื่อ"
            margin="dense"
            value={form.firstName}
            onChange={onChange("firstName")}
            required
          />

          <TextField
            fullWidth
            label="นามสกุล"
            margin="dense"
            value={form.lastName}
            onChange={onChange("lastName")}
            required
          />

          <TextField
            fullWidth
            label="วันเกิด"
            type="date"
            margin="dense"
            value={form.birthday}
            onChange={onChange("birthday")}
            required
            InputLabelProps={{ shrink: true }}
          />

          <Button
            fullWidth
            sx={{ mt: 2 }}
            type="submit"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? "กำลังสมัคร..." : "สมัคร"}
          </Button>

          <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
            มีบัญชีแล้ว? <Link to="/login">เข้าสู่ระบบ</Link>
          </Typography>
        </form>
      </Paper>
    </Box>
  );
}
