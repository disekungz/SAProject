// src/pages/login.tsx
import React, { useState } from "react";
import {
  TextField, Button, Paper, Typography, Box, Alert, Link, IconButton, InputAdornment, Divider
} from "@mui/material";
import { useNavigate, Link as RouterLink, useLocation } from "react-router-dom";
import { api } from "../lib/axios";
import { saveAuth } from "../lib/auth";
import LoginIcon from "@mui/icons-material/Login";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const redirectTo = (loc.state as any)?.from || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post("/auth/login", { username, password });
      // backend: { access_token, user: { MID, username, firstName, lastName, rankId } }
      saveAuth(res.data.access_token, res.data.user);
      // แจ้ง component อื่น ๆ (เช่น Sidebar) ให้รีเฟรชผู้ใช้
      window.dispatchEvent(new Event("auth:changed"));
      nav(redirectTo, { replace: true });
    } catch (e: any) {
      const msg = e?.response?.data?.error || "เข้าสู่ระบบไม่สำเร็จ";
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
        backgroundImage: "url(/images/register-bg.jpg)",
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
          width: { xs: "92%", sm: 380 },
          p: 4,
          borderRadius: 3,
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          backdropFilter: "blur(10px)",
          color: "#fff",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1, gap: 1 }}>
          <LoginIcon />
          <Typography variant="h5" fontWeight={700}>เข้าสู่ระบบ</Typography>
        </Box>
        <Typography variant="body2" sx={{ mb: 2, opacity: 0.85 }}>
          ลงชื่อเข้าใช้เพื่อเข้าถึงระบบ
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <form onSubmit={submit} noValidate>
          <TextField
            fullWidth
            label="Username"
            margin="dense"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            variant="filled"
            InputProps={{ disableUnderline: true }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <TextField
            fullWidth
            label="Password"
            type={showPw ? "text" : "password"}
            margin="dense"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            variant="filled"
            InputProps={{
              disableUnderline: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPw((v) => !v)}
                    edge="end"
                    aria-label="toggle password visibility"
                  >
                    {showPw ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ bgcolor: "rgba(255,255,255,.9)", borderRadius: 1 }}
          />

          <Button
            fullWidth
            sx={{ mt: 2, py: 1.2, fontWeight: 700 }}
            type="submit"
            variant="contained"
            disabled={submitting}
          >
            {submitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </Button>

          <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,.25)" }} />

          <Typography variant="body2" sx={{ textAlign: "center" }}>
            ยังไม่มีบัญชี?{" "}
            <Link component={RouterLink} to="/register" sx={{ color: "#fff", textDecorationColor: "rgba(255,255,255,.6)" }}>
              สมัครสมาชิก
            </Link>
          </Typography>
        </form>
      </Paper>
    </Box>
  );
}
