import axios from "axios";
import { getToken } from "./auth";

export const api = axios.create({ baseURL: "http://localhost:8088/api" });

api.interceptors.request.use((config) => {
  const tk = getToken();
  if (tk) config.headers.Authorization = `Bearer ${tk}`;
  return config;
});
