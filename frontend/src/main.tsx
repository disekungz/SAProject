// src/main.tsx  หรือ src/index.tsx (ให้ใช้ไฟล์เดียวตามโปรเจกต์คุณ)
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { CssBaseline } from "@mui/material";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CssBaseline />
    <App />
  </React.StrictMode>
);
