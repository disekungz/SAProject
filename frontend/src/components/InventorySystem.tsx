// src/components/InventorySystem.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Box, Button, Select, MenuItem, InputLabel, FormControl, Typography,
  CircularProgress, Snackbar, Alert
} from '@mui/material';
import { api } from '../lib/axios';
import { getUser } from '../lib/auth'; // ✅ ใช้ตรวจสิทธิ์แอดมิน

const InventorySystem: React.FC = () => {
  const [parcels, setParcels] = useState<any[]>([]);
  const [operationLogs, setOperationLogs] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [staffs, setStaffs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<'addnew' | 'edit' | 'reduce' | 'add' | null>(null);
  const [currentParcel, setCurrentParcel] = useState<any | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', quantity: 0, typeId: 1 });
  const [searchName, setSearchName] = useState('');
  const [searchTypeId, setSearchTypeId] = useState<number | null>(null);

  // === Snackbar (แจ้งเตือน) ===
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, message: '', severity: 'success' });

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => setSnackbar({ open: true, message, severity });
  const closeSnackbar = () => setSnackbar(s => ({ ...s, open: false }));

  // === Requestings (อนุมัติ) ===
  const [showApprovedPanel, setShowApprovedPanel] = useState(false);
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [processing, setProcessing] = useState<Record<number, boolean>>({}); // ✅ กันกดซ้ำ

  // ✅ ผู้ใช้ปัจจุบัน (ใช้เช็คสิทธิ์แอดมิน)
  const user = useMemo(() => getUser(), []);
  const isAdmin = user?.rankId === 1;

  // ✅ map สถานะการดำเนินการ รวมการ "ลบทิ้ง"
  const operatorMap: Record<number, string> = {
    1: 'เพิ่ม',
    2: 'เบิก',
    3: 'แก้ไข',
    4: 'เพิ่มใหม่',
    5: 'ลบทิ้ง', // ✅ เพิ่ม mapping ลบ
  };

  // ฟังก์ชันคืน label สถานะ + ฟอลแบ็กเดาเป็น "ลบทิ้ง" ถ้าเงื่อนไขเข้าเคสลบ
  const operatorLabel = (log: any) => {
    const label = operatorMap[Number(log?.OperatorID)];
    if (label) return label;
    if ((log?.NewQuantity ?? 0) === 0 && (log?.OldQuantity ?? 0) > 0 && (log?.ChangeAmount ?? 0) < 0) {
      return 'ลบทิ้ง';
    }
    return '-';
  };

  // แผนที่ช่วยแสดงชื่อ/ประเภท/สถานะต่าง ๆ
  const typeMap: Record<number, string> = types.reduce((acc: any, t: any) => {
    acc[t.Type_ID] = t.Type;
    return acc;
  }, {});
  const statusMap: Record<number, string> = statuses.reduce((acc: any, s: any) => {
    acc[s.Status_ID] = s.Status;
    return acc;
  }, {});
  const parcelMapById: Record<number, any> = parcels.reduce((acc: any, p: any) => {
    acc[p.PID] = p;
    return acc;
  }, {});
  const staffMapById: Record<number, any> = staffs.reduce((acc: any, s: any) => {
    acc[s.Staff_ID ?? s.StaffID ?? s.id] = s;
    return acc;
  }, {});

  useEffect(() => {
    Promise.all([
      api.get(`/parcels`),
      api.get(`/operations`),
      api.get(`/types`),
      api.get(`/statuses`),
      api.get(`/staffs`),
    ])
      .then(([p, o, t, s, stf]) => {
        setParcels(p.data);
        setOperationLogs(o.data);
        setTypes(t.data);
        setStatuses(s.data);
        setStaffs(stf.data);
      })
      .catch((e) => {
        console.error(e);
        setError('โหลดข้อมูลไม่สำเร็จ');
        showSnackbar('โหลดข้อมูลไม่สำเร็จ', 'error');
      });
  }, []);

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'typeId' ? parseInt(value) || 0 : value,
    }));
  };

  const resetForm = () => {
    setAction(null);
    setCurrentParcel(null);
    setFormData({ name: '', quantity: 0, typeId: 1 });
  };

  const selectedParcel = parcels.find(p => p.PID === selectedParcelId) || null;

  const refreshLogs = async () => {
    try {
      const logs = await api.get(`/operations`);
      setOperationLogs(logs.data);
    } catch {
      /* เงียบๆ */
    }
  };

  /** ================= Helpers สำหรับ Requestings ================= */
  const normalizeStatusId = (r: any) => {
    const raw =
      r?.Status_ID ??
      r?.status_id ??
      r?.Status?.Status_ID ??
      r?.Status?.status_id ??
      r?.status?.Status_ID ??
      r?.status?.status_id;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;

    const name = r?.Status?.Status ?? r?.status?.name ?? r?.status?.Status;
    if (name === 'อนุมัติ') return 2;
    if (name === 'สำเร็จ') return 4;
    return null;
  };

  const getStatusText = (r: any) => {
    const named =
      r?.Status?.Status ??
      r?.Status?.status ??
      r?.status?.name ??
      r?.status?.Status;
    if (typeof named === 'string' && named.trim()) return named;

    const id = normalizeStatusId(r);
    if (id && statusMap[id]) return statusMap[id];
    if (id === 2) return 'อนุมัติ';
    if (id === 4) return 'สำเร็จ';
    return '-';
  };

  const getParcelName = (r: any) => {
    const nameFromObj =
      r?.Parcel?.ParcelName ??
      r?.parcel?.ParcelName ??
      r?.ParcelName ??
      r?.parcel_name;
    if (nameFromObj) return nameFromObj;

    const pid =
      r?.PID ?? r?.pid ?? r?.Parcel?.PID ?? r?.parcel?.PID;
    const p = parcelMapById[Number(pid)];
    return p?.ParcelName ?? '-';
  };

  const getStaffName = (r: any) => {
    const staff = r?.Staff ?? r?.staff;
    const f1 = staff?.FirstName ?? staff?.firstName ?? staff?.first_name ?? staff?.Name ?? staff?.name;
    const l1 = staff?.LastName ?? staff?.lastName ?? staff?.last_name;
    if (f1 || l1) return [f1, l1].filter(Boolean).join(' ') || '-';

    const sid = Number(r?.StaffID ?? r?.Staff_ID ?? r?.staff_id);
    const s = staffMapById[sid];
    const f2 = s?.FirstName ?? s?.firstName ?? s?.first_name ?? s?.Name ?? s?.name;
    const l2 = s?.LastName ?? s?.lastName ?? s?.last_name;
    return [f2, l2].filter(Boolean).join(' ') || '-';
  };

  const parseRequestDate = (r: any) => {
    const raw = r.Request_Date ?? r.request_date ?? r.requestDate ?? r.date;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  // ✅ helper: ดึง PID ของพัสดุจาก request (พยายามอ่านได้หลายคีย์)
  const resolveRequestPID = (r: any) => {
    const pid =
      r?.PID ?? r?.pid ??
      r?.Parcel_ID ?? r?.parcel_id ??
      r?.Parcel?.PID ?? r?.parcel?.PID;
    if (pid) return Number(pid);

    // เผื่อไม่มี PID แต่มีชื่อ → map กลับหา PID
    const name = getParcelName(r);
    if (name && typeof name === 'string') {
      const found = parcels.find(p => (p.ParcelName ?? '').trim() === name.trim());
      if (found) return Number(found.PID);
    }
    return NaN;
  };

  // ✅ helper: ดึงจำนวนที่ขอ
  const resolveRequestAmount = (r: any) => {
    const raw =
      r?.Amount_Request ?? r?.amount_request ??
      r?.Amount ?? r?.amount ??
      r?.Qty ?? r?.qty ??
      r?.Quantity ?? r?.quantity;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };

  // ====== Approved Requestings ======
  const fetchApprovedRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await api.get(`/requestings`);
      const list = Array.isArray(res.data) ? res.data : [];

      const approved = list.filter((r) => normalizeStatusId(r) === 2);
      approved.sort((a, b) => parseRequestDate(b) - parseRequestDate(a));
      setApprovedRequests(approved);
    } catch (e) {
      console.error(e);
      setError('ไม่สามารถโหลดรายการขอเบิกที่อนุมัติได้');
      setApprovedRequests([]);
      showSnackbar('ไม่สามารถโหลดรายการขอเบิกที่อนุมัติได้', 'error');
    } finally {
      setLoadingRequests(false);
    }
  };

  const toggleApprovedPanel = () => {
    const next = !showApprovedPanel;
    setShowApprovedPanel(next);
    if (next) fetchApprovedRequests();
  };

  // ✅ เปลี่ยนเป็น: ลดสต็อก -> อัปเดตสถานะคำขอ -> refresh
  const markRequestCompleted = async (req: any) => {
    const id = Number(req?.Requesting_ID ?? req?.id);
    setProcessing(prev => ({ ...prev, [id]: true }));

    try {
      const pid = resolveRequestPID(req);
      const amount = resolveRequestAmount(req);

      if (!Number.isFinite(pid) || pid <= 0) {
        showSnackbar('ไม่พบพัสดุของคำขอนี้ (PID ว่าง)', 'error');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        showSnackbar('จำนวนที่ขอไม่ถูกต้อง', 'error');
        return;
      }

      // 1) ลดสต็อก (ฝั่งหลังบ้านจะบันทึก Operation: เบิก ให้เลย)
      await api.post(`/parcels/${pid}/reduce`, { amount });

      // 2) อัปเดตสถานะคำขอเป็น "สำเร็จ" (4)
      await api.put(`/requestings/${req.Requesting_ID}/status`, { Status_ID: 4 });

      // 3) อัปเดตหน้าจอ
      setApprovedRequests(prev => prev.filter(r => (r.Requesting_ID ?? r.id) !== (req.Requesting_ID ?? req.id)));
      showSnackbar('บันทึกการเบิกและอัปเดตคำขอเป็น "สำเร็จ" แล้ว', 'success');

      // refresh คลัง + ประวัติ
      try {
        const [pRes, oRes] = await Promise.all([api.get(`/parcels`), api.get(`/operations`)]);
        setParcels(pRes.data);
        setOperationLogs(oRes.data);
      } catch { /* เงียบๆ */ }
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.error || 'ทำรายการไม่สำเร็จ';
      showSnackbar(msg, 'error');
    } finally {
      setProcessing(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  /** ================= CRUD Parcel ================= */
  const nameNormalized = (s: string) => s.trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;

    const name = formData.name.trim();
    if (!name) {
      showSnackbar('กรุณากรอกชื่อพัสดุ', 'warning');
      return;
    }

    try {
      let res: any;

      if (action === 'addnew') {
        // ✅ กันชื่อซ้ำแบบไม่สนตัวพิมพ์และเว้นวรรค
        const exists = parcels.some(p => nameNormalized(p.ParcelName ?? '') === nameNormalized(name));
        if (exists) {
          showSnackbar('พัสดุนี้มีอยู่แล้ว', 'warning');
          return;
        }
        res = await api.post(`/parcels`, {
          parcelName: name,
          quantity: formData.quantity,
          type_ID: formData.typeId,
        });
        setParcels(prev => [...prev, res.data]);
        showSnackbar('เพิ่มพัสดุใหม่สำเร็จ', 'success');
      }

      if (action === 'edit' && currentParcel) {
        // ✅ กันชื่อซ้ำ (ยกเว้นตัวเอง)
        const dup = parcels.some(
          p => p.PID !== currentParcel.PID &&
            nameNormalized(p.ParcelName ?? '') === nameNormalized(name)
        );
        if (dup) {
          showSnackbar('ชื่อพัสดุนี้มีอยู่แล้ว', 'warning');
          return;
        }
        res = await api.put(`/parcels/${currentParcel.PID}`, {
          parcelName: name,
          quantity: formData.quantity,
          type_ID: formData.typeId,
        });
        setParcels(prev => prev.map(p => (p.PID === res.data.PID ? res.data : p)));
        showSnackbar('แก้ไขพัสดุสำเร็จ', 'success');
      }

      if (action === 'add' && currentParcel) {
        res = await api.post(`/parcels/${currentParcel.PID}/add`, { amount: formData.quantity });
        setParcels(prev => prev.map(p => (p.PID === res.data.PID ? res.data : p)));
        showSnackbar('เพิ่มจำนวนสำเร็จ', 'success');
      }

      if (action === 'reduce' && currentParcel) {
        res = await api.post(`/parcels/${currentParcel.PID}/reduce`, { amount: formData.quantity });
        setParcels(prev => prev.map(p => (p.PID === res.data.PID ? res.data : p)));
        showSnackbar('เบิก/ลดจำนวนสำเร็จ', 'success');
      }

      await refreshLogs();
      resetForm();
      setError(null);
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.error || 'เกิดข้อผิดพลาดในการดำเนินการ';
      setError(msg);
      showSnackbar(msg, 'error');
    }
  };

  // ✅ ลบพัสดุ (แอดมินเท่านั้น)
  const handleDelete = async (parcel: any) => {
    if (!parcel) return;
    const ok = window.confirm(`ยืนยันลบพัสดุ "${parcel.ParcelName}" ?`);
    if (!ok) return;

    try {
      await api.delete(`/parcels/${parcel.PID}`);
      setParcels(prev => prev.filter(p => p.PID !== parcel.PID));
      setSelectedParcelId(null);
      showSnackbar('ลบพัสดุสำเร็จ', 'success');
      await refreshLogs();
    } catch (e: any) {
      const msg = e?.response?.data?.error || 'ลบพัสดุไม่สำเร็จ';
      showSnackbar(msg, 'error');
    }
  };

  /** ================= Filter ================= */
  const filteredParcels = parcels
    .filter(p =>
      (p.ParcelName ?? '').toLowerCase().includes(searchName.toLowerCase()) &&
      (searchTypeId === null || p.Type_ID === searchTypeId),
    )
    .sort((a, b) => a.PID - b.PID);

  // จัดเรียงประวัติการดำเนินการล่าสุดอยู่บน
  const ts = (v: any) => {
    const t = new Date(v ?? "").getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const sortedOperationLogs = useMemo(
    () =>
      [...operationLogs].sort(
        (b, a) => ts(a?.DateTime ?? a?.date) - ts(b?.DateTime ?? b?.date)
      ),
    [operationLogs]
  );

  return (
    <div className="p-4">
      {error && <div style={{ color: 'red', marginBottom: 16 }}>{error}</div>}

      <Typography variant="h4" gutterBottom>ระบบคลังพัสดุ</Typography>

      {/* ปุ่มเพิ่ม + ปุ่มเปิดรายการอนุมัติ + ช่องค้นหา */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" color="primary" onClick={() => setAction('addnew')}>
            เพิ่มพัสดุใหม่
          </Button>

          <Button
            variant={showApprovedPanel ? 'outlined' : 'contained'}
            color="success"
            onClick={toggleApprovedPanel}
          >
            {showApprovedPanel ? 'ซ่อนรายการขอเบิก (อนุมัติ)' : 'รายการขอเบิก (อนุมัติ)'}
          </Button>

          {showApprovedPanel && (
            <Button variant="text" onClick={fetchApprovedRequests} disabled={loadingRequests}>
              รีเฟรชรายการ
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="ค้นหาชื่อพัสดุ"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>ประเภทพัสดุ</InputLabel>
            <Select
              value={searchTypeId ?? ''}
              onChange={(e) => setSearchTypeId(e.target.value ? Number(e.target.value) : null)}
              label="ประเภทพัสดุ"
            >
              <MenuItem value="">ทั้งหมด</MenuItem>
              {types.map((t: any) => (
                <MenuItem key={t.Type_ID} value={t.Type_ID}>{t.Type}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {/* ตารางพัสดุ */}
      <TableContainer component={Paper} sx={{ maxHeight: 400, overflow: 'auto' }}>
        <Table sx={{ minWidth: 650 }}>
          <TableHead>
            <TableRow>
              <TableCell>รหัสพัสดุ</TableCell>
              <TableCell align="right">ชื่อ</TableCell>
              <TableCell align="right">ประเภท</TableCell>
              <TableCell align="right">จำนวนปัจจุบัน</TableCell>
              <TableCell align="right">สถานะ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredParcels.map((parcel: any) => (
              <TableRow
                key={parcel.PID}
                hover
                selected={selectedParcelId === parcel.PID}
                onClick={() => { setSelectedParcelId(parcel.PID); resetForm(); }}
                sx={{ cursor: 'pointer' }}
              >
                <TableCell>{parcel.PID}</TableCell>
                <TableCell align="right">{parcel.ParcelName}</TableCell>
                <TableCell align="right">{typeMap[parcel.Type_ID] || '-'}</TableCell>
                <TableCell align="right">{parcel.Quantity}</TableCell>
                <TableCell align="right">{parcel.Status || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ปุ่มแก้ไข/เบิก/เพิ่ม ของแถวที่เลือก + ปุ่มลบ (ขวาสุด เฉพาะแอดมิน) */}
      {selectedParcel && (
        <Box mt={2} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* ฝั่งซ้าย */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained" color="warning"
              onClick={() => {
                setCurrentParcel(selectedParcel);
                setFormData({
                  name: selectedParcel.ParcelName,
                  quantity: selectedParcel.Quantity,
                  typeId: selectedParcel.Type_ID,
                });
                setAction('edit');
              }}
            >
              แก้ไข
            </Button>
            <Button
              variant="contained" color="error"
              onClick={() => {
                setCurrentParcel(selectedParcel);
                setFormData({ name: selectedParcel.ParcelName, quantity: 1, typeId: selectedParcel.Type_ID });
                setAction('reduce');
              }}
            >
              เบิก
            </Button>
            <Button
              variant="contained" color="primary"
              onClick={() => {
                setCurrentParcel(selectedParcel);
                setFormData({ name: selectedParcel.ParcelName, quantity: 1, typeId: selectedParcel.Type_ID });
                setAction('add');
              }}
            >
              เพิ่ม
            </Button>
          </Box>

          {/* ฝั่งขวา — แอดมินเท่านั้น */}
          {isAdmin && (
            <Box sx={{ ml: 'auto' }}>
              <Button
                variant="contained"
                color="error"
                onClick={() => handleDelete(selectedParcel)}
              >
                ลบพัสดุ
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* ฟอร์มดำเนินการ */}
      {action && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded">
          <Typography variant="h6" mb={2}>
            {action === 'addnew' ? 'เพิ่มพัสดุใหม่'
              : action === 'edit' ? 'แก้ไขพัสดุ'
                : action === 'reduce' ? 'เบิกพัสดุ'
                  : 'เพิ่มจำนวนพัสดุ'}
          </Typography>

          <TextField
            label="ชื่อพัสดุ"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            sx={{ mr: 2, mb: 2 }}
          />
          <TextField
            label="จำนวน"
            name="quantity"
            type="number"
            value={formData.quantity}
            onChange={handleInputChange}
            required
            sx={{ mr: 2, mb: 2 }}
          />

          {(action === 'addnew' || action === 'edit') && (
            <FormControl sx={{ minWidth: 120, mr: 2, mb: 2 }}>
              <InputLabel>ประเภท</InputLabel>
              <Select name="typeId" value={formData.typeId} onChange={handleInputChange} label="ประเภท">
                {types.map((t: any) => (
                  <MenuItem key={t.Type_ID} value={t.Type_ID}>{t.Type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Button type="submit" variant="contained" color="primary" sx={{ mr: 1 }}>
            ยืนยัน
          </Button>
          <Button type="button" variant="outlined" color="secondary" onClick={resetForm}>
            ยกเลิก
          </Button>
        </form>
      )}

      {/* ====== Panel: รายการขอเบิกที่ "อนุมัติ" ====== */}
      {showApprovedPanel && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>รายการขอเบิกที่อนุมัติ</Typography>

          {loadingRequests ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={18} /> <span>กำลังโหลด...</span>
            </Box>
          ) : (
            <TableContainer component={Paper} sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>เลขที่คำขอ</TableCell>
                    <TableCell>พัสดุ</TableCell>
                    <TableCell align="right">จำนวนที่ขอ</TableCell>
                    <TableCell>วันที่ขอ</TableCell>
                    <TableCell>ผู้ขอ</TableCell>
                    <TableCell>สถานะ</TableCell>
                    <TableCell align="center">การดำเนินการ</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {approvedRequests.map((r: any) => (
                    <TableRow key={r.Requesting_ID} hover>
                      <TableCell>{r.Requesting_NO}</TableCell>
                      <TableCell>{getParcelName(r)}</TableCell>
                      <TableCell align="right">{resolveRequestAmount(r) || r.Amount_Request}</TableCell>
                      <TableCell>
                        {new Date(r.Request_Date ?? r.request_date ?? r.date)
                          .toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </TableCell>

                      <TableCell>{getStaffName(r)}</TableCell>
                      <TableCell>{getStatusText(r)}</TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          color="success"
                          onClick={() => markRequestCompleted(r)}
                          disabled={!!processing[r.Requesting_ID]}
                        >
                          {processing[r.Requesting_ID] ? 'กำลังบันทึก...' : 'สำเร็จ'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {approvedRequests.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center">ไม่พบรายการขอเบิกที่อนุมัติ</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* ประวัติการดำเนินการ */}
      {operationLogs.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>ประวัติการดำเนินการ</Typography>
          <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>เวลา</TableCell>
                  <TableCell>สถานะ</TableCell>
                  <TableCell>ชื่อ</TableCell>
                  <TableCell>ชื่อใหม่</TableCell>
                  <TableCell>ประเภท</TableCell>
                  <TableCell>ประเภทใหม่</TableCell>
                  <TableCell>จำนวนก่อนหน้า</TableCell>
                  <TableCell>เปลี่ยนแปลง</TableCell>
                  <TableCell>จำนวนใหม่</TableCell>
                  <TableCell>ชื่อผู้ดำเนินการ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedOperationLogs.map((log: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(log.DateTime).toLocaleString()}</TableCell>
                    <TableCell>{operatorLabel(log)}</TableCell>
                    <TableCell>{log.OldParcelName || log.Parcel?.ParcelName || '-'}</TableCell>
                    <TableCell>{log.NewParcelName || ''}</TableCell>
                    <TableCell>
                      {log.OldTypeID != null
                        ? typeMap[log.OldTypeID] || '-'
                        : log.Parcel
                          ? typeMap[log.Parcel.Type_ID]
                          : '-'}
                    </TableCell>
                    <TableCell>{log.NewTypeID != null ? (typeMap[log.NewTypeID] || '') : ''}</TableCell>
                    <TableCell>{log.OldQuantity}</TableCell>
                    <TableCell>{log.ChangeAmount}</TableCell>
                    <TableCell>{log.NewQuantity}</TableCell>
                    <TableCell>{log.Member?.FirstName || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ✅ Snackbar แจ้งเตือน */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default InventorySystem;
