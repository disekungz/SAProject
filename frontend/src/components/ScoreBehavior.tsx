/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Button, Box, TextField, Snackbar, Alert, Typography,
  Card, CardContent, CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon, Remove as RemoveIcon, Edit as EditIcon,
  Save as SaveIcon, Cancel as CancelIcon,
} from "@mui/icons-material";

/** ===================== Types ===================== **/
type ScoreBehaviorItem = {
  SID: number | null;     // อาจเป็น null ถ้ายังไม่มีแถวใน score_behaviors
  Prisoner_ID: number;    // ลำดับ (PK)
  Inmate_ID: string;      // รหัสนักโทษ
  Score: number;
  Citizen_ID: string;
  FirstName: string;
  LastName: string;
};

type AdjustmentLog = {
  AID: number;
  OldScore: number;
  NewScore: number;
  Date: string;
  Remarks: string;
  Prisoner_ID: number;
  Inmate_ID?: string;      // root จาก API (อาจมี/ไม่มี)
  MemberFirst?: string;    // root จาก API (อาจมี/ไม่มี)
  MemberLast?: string;     // root จาก API (อาจมี/ไม่มี)
  Prisoner?: {
    Prisoner_ID: number;
    Inmate_ID: string;
    FirstName: string;
    LastName: string;
    Citizen_ID: string;
  };
  Member?: {
    FirstName: string;
    LastName: string;
  };
};

/** ===================== Component ===================== **/
const App: React.FC = () => {
  const [scores, setScores] = useState<ScoreBehaviorItem[]>([]);
  const [selected, setSelected] = useState<ScoreBehaviorItem | null>(null);
  const [tempScore, setTempScore] = useState(0);
  const [editing, setEditing] = useState(false);
  const [logs, setLogs] = useState<AdjustmentLog[]>([]);
  const [inmateMap, setInmateMap] = useState<Record<number, string>>({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning" | "info",
  });
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  /** ===================== Effects ===================== **/
  useEffect(() => {
    fetchScores();
    fetchAdjustmentLogs();
    buildInmateMap(); // fallback map Prisoner_ID -> Inmate_ID
  }, []);

  /** ===================== Fetchers ===================== **/
  const fetchScores = () => {
    setLoading(true);
    axios
      .get("http://localhost:8088/api/scorebehaviors")
      .then((res) => {
        const valid = (res.data as ScoreBehaviorItem[]).filter(
          (row) => row.Prisoner_ID !== 0
        );
        setScores(valid);
      })
      .catch((err) => {
        console.error("Error fetching scores:", err);
        showSnackbar("Failed to load scores", "error");
      })
      .finally(() => setLoading(false));
  };

  const fetchAdjustmentLogs = () => {
    setLoadingLogs(true);
    axios
      .get("http://localhost:8088/api/adjustments")
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : [];
        const normalized: AdjustmentLog[] = data.map((log: any) => ({
          ...log,
          // root > nested > เว้นไว้ให้ fallback จาก inmateMap ตอน render
          Inmate_ID: log?.Inmate_ID ?? log?.Prisoner?.Inmate_ID ?? "",
          MemberFirst: log?.MemberFirst ?? log?.Member?.FirstName ?? null,
          MemberLast:  log?.MemberLast  ?? log?.Member?.LastName  ?? null,
        }));
        setLogs(normalized);
      })
      .catch((err) => {
        console.error("Error fetching adjustment logs:", err);
        showSnackbar("Failed to load adjustment history", "error");
      })
      .finally(() => setLoadingLogs(false));
  };

  const buildInmateMap = async () => {
    try {
      const res = await axios.get("http://localhost:8088/api/prisoners");
      const map: Record<number, string> = {};
      for (const p of res.data ?? []) {
        if (p?.Prisoner_ID) map[p.Prisoner_ID] = p?.Inmate_ID ?? "";
      }
      setInmateMap(map);
    } catch (e) {
      console.error("Error building inmate map:", e);
    }
  };

  /** ===================== UI Helpers ===================== **/
  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info"
  ) => setSnackbar({ open: true, message, severity });

  const handleCloseSnackbar = () => setSnackbar((s) => ({ ...s, open: false }));

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString("th-TH");
    } catch {
      return dateString;
    }
  };

  const resolveInmateId = (log: AdjustmentLog) => {
    // ใช้ root ก่อน, แล้วค่อย nested, สุดท้าย fallback map
    if (log.Inmate_ID && log.Inmate_ID.trim() !== "") return log.Inmate_ID;
    if (log.Prisoner?.Inmate_ID && log.Prisoner.Inmate_ID.trim() !== "")
      return log.Prisoner.Inmate_ID;
    return inmateMap[log.Prisoner_ID] ?? "—";
  };

  const resolveMemberName = (log: AdjustmentLog) => {
    if (log.MemberFirst || log.MemberLast) {
      return `${log.MemberFirst ?? ""} ${log.MemberLast ?? ""}`.trim() || "—";
    }
    return log.Member?.FirstName ?? "—";
  };

  /** ===================== Actions ===================== **/
  const handleEdit = () => {
    if (selected) {
      setEditing(true);
      setTempScore(selected.Score);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setSelected(null);
  };

  const handleConfirm = () => {
    if (!selected) return;
    if (selected.Prisoner_ID === 0) {
      showSnackbar("รหัสนักโทษไม่ถูกต้อง", "error");
      return;
    }

    axios
      .post("http://localhost:8088/api/adjustments", {
        prisoner_id: selected.Prisoner_ID, // ต้องพิมพ์เล็กให้ตรง backend
        oldScore: selected.Score,
        newScore: tempScore,
        mid: 1,
        remarks: "แก้ไขคะแนนผ่านระบบ",
      })
      .then(() => {
        fetchScores();
        fetchAdjustmentLogs();
        setEditing(false);
        setSelected(null);
        showSnackbar("อัปเดตคะแนนสำเร็จ", "success");
      })
      .catch((err) => {
        console.error("Error updating score:", err);
        if (err.response?.data?.error) {
          showSnackbar(`อัปเดตคะแนนไม่สำเร็จ: ${err.response.data.error}`, "error");
        } else {
          showSnackbar("อัปเดตคะแนนไม่สำเร็จ", "error");
        }
      });
  };

  /** ===================== Render ===================== **/
  return (
    <div>
      <div style={{ padding: 16 }}>
        <Typography variant="h4" gutterBottom style={{ marginTop: 16, marginBottom: 24 }}>
          ระบบคะแนนความประพฤติ
        </Typography>

        {loading && (
          <Box display="flex" alignItems="center" gap={2} marginBottom={2}>
            <CircularProgress size={20} />
            <Typography variant="body1">กำลังโหลดข้อมูลคะแนน...</Typography>
          </Box>
        )}

        {/* ตารางคะแนนความประพฤติ */}
        <Card style={{ marginBottom: 24 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>ตารางคะแนนความประพฤติ</Typography>
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ลำดับ</TableCell>
                    <TableCell>รหัสนักโทษ</TableCell>
                    <TableCell>บัตรประชาชน</TableCell>
                    <TableCell>ชื่อ</TableCell>
                    <TableCell>นามสกุล</TableCell>
                    <TableCell>คะแนน</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scores.map((s) => (
                    <TableRow
                      key={s.Prisoner_ID} // ใช้ PK เสถียรกว่า SID (ซึ่งอาจ null)
                      hover
                      selected={selected?.Prisoner_ID === s.Prisoner_ID}
                      onClick={() => setSelected(s)}
                      style={{ cursor: "pointer" }}
                    >
                      {/* ลำดับ = prisoner_id */}
                      <TableCell>{s.Prisoner_ID}</TableCell>
                      {/* รหัสนักโทษ = inmate_id */}
                      <TableCell>{s.Inmate_ID || "—"}</TableCell>
                      <TableCell>{s.Citizen_ID}</TableCell>
                      <TableCell>{s.FirstName}</TableCell>
                      <TableCell>{s.LastName}</TableCell>
                      <TableCell>
                        <Box fontWeight="bold" color={s.Score < 0 ? "error.main" : "success.main"}>
                          {s.Score}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                  {scores.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">ไม่พบข้อมูล</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* กล่องแก้ไขคะแนน */}
        {selected && (
          <Card style={{ marginBottom: 24 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>แก้ไขคะแนนสำหรับนักโทษ</Typography>
              <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                <TextField
                  label="รหัสนักโทษ"
                  value={selected.Inmate_ID || "—"}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                <TextField
                  label="ชื่อ-นามสกุล"
                  value={`${selected.FirstName} ${selected.LastName}`}
                  InputProps={{ readOnly: true }}
                  size="small"
                  style={{ minWidth: 200 }}
                />
                <TextField
                  label="คะแนนปัจจุบัน"
                  value={selected.Score}
                  InputProps={{ readOnly: true }}
                  size="small"
                />
                {!editing ? (
                  <Button variant="contained" startIcon={<EditIcon />} onClick={handleEdit}>
                    แก้ไขคะแนน
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outlined"
                      onClick={() => setTempScore((prev) => Math.max(0, prev - 1))}
                      disabled={tempScore <= 0}
                    >
                      <RemoveIcon />
                    </Button>
                    <TextField
                      value={tempScore}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value)) setTempScore(Math.max(0, value));
                      }}
                      type="number"
                      size="small"
                      style={{ width: 80 }}
                      inputProps={{ min: 0 }}
                    />
                    <Button variant="outlined" onClick={() => setTempScore((prev) => prev + 1)}>
                      <AddIcon />
                    </Button>
                    <Button variant="contained" color="success" startIcon={<SaveIcon />} onClick={handleConfirm}>
                      ยืนยัน
                    </Button>
                    <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={handleCancel}>
                      ยกเลิก
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        {/* ประวัติการแก้ไขคะแนน */}
        <Card>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={2}>
              <Typography variant="h6">ประวัติการแก้ไขคะแนน</Typography>
              {loadingLogs && <CircularProgress size={20} />}
            </Box>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>เวลา</TableCell>
                    <TableCell>รหัสนักโทษ</TableCell>
                    <TableCell>คะแนนเดิม</TableCell>
                    <TableCell>คะแนนใหม่</TableCell>
                    <TableCell>เปลี่ยนแปลง</TableCell>
                    <TableCell>ผู้แก้ไข</TableCell>
                    <TableCell>หมายเหตุ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs
                    .sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
                    .map((log) => (
                      <TableRow key={log.AID}>
                        <TableCell>{formatDate(log.Date)}</TableCell>
                        <TableCell>{resolveInmateId(log)}</TableCell>
                        <TableCell>{log.OldScore}</TableCell>
                        <TableCell>{log.NewScore}</TableCell>
                        <TableCell>
                          <Box color={log.NewScore - log.OldScore < 0 ? "error.main" : "success.main"} fontWeight="bold">
                            {log.NewScore - log.OldScore > 0
                              ? `+${log.NewScore - log.OldScore}`
                              : log.NewScore - log.OldScore}
                          </Box>
                        </TableCell>
                        <TableCell>{resolveMemberName(log)}</TableCell>
                        <TableCell>{log.Remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  {logs.length === 0 && !loadingLogs && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">ไม่พบประวัติการแก้ไข</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} style={{ width: "100%" }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </div>
    </div>
  );
};

export default App;
