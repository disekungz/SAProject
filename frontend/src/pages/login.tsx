import React, { useState } from "react";
import { TextField, Button, Paper, Typography, Box, Link } from "@mui/material";
import { api } from "../lib/axios";
import { saveAuth } from "../lib/auth";
import { useNavigate, Link as RouterLink } from "react-router-dom";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await api.post("/auth/login", { username, password });
    saveAuth(res.data.access_token, res.data.user);
    nav("/");
  };

  return (
    <Box sx={{ display:"flex", justifyContent:"center", mt:8 }}>
      <Paper sx={{ p:4, width:360 }}>
        <Typography variant="h5" gutterBottom>เข้าสู่ระบบ</Typography>
        <form onSubmit={submit}>
          <TextField fullWidth label="username" margin="normal" value={username} onChange={e=>setUsername(e.target.value)} />
          <TextField fullWidth label="password" type="password" margin="normal" value={password} onChange={e=>setPassword(e.target.value)} />
          <Button fullWidth type="submit" variant="contained" sx={{ mt:2 }}>เข้าสู่ระบบ</Button>
        </form>
        <Box sx={{ mt:2 }}>
          <Link component={RouterLink} to="/register">ยังไม่มีบัญชี? สมัครสมาชิก</Link>
        </Box>
      </Paper>
    </Box>
  );
}
