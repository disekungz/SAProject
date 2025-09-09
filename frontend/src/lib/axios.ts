// src/lib/axios.ts
import axios from "axios";
import { getToken } from "./auth";

export const api = axios.create({ baseURL: "http://localhost:8088/api" });
api.interceptors.request.use(cfg => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
