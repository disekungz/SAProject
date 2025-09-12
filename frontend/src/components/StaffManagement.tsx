import { useState, useEffect, useMemo } from "react";
import {
  Input, Button, Card, Form, DatePicker, Row, Col, Typography,
  Select, Table, Space, Modal, Popconfirm, Tag, Empty, Avatar,
  Segmented, notification, Spin,
} from "antd";
import {
  SearchOutlined, EyeOutlined, DeleteOutlined, PlusOutlined,
  EditOutlined, UserOutlined, ReloadOutlined, MailOutlined,
  CheckCircleFilled, CloseCircleFilled,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;

/* =========================
 * Types
 * =======================*/
type WorkStatus = "ทำงานอยู่" | "ไม่ได้ทำงาน";

interface Gender {
  Gender_ID: number;
  Gender: string;
}

interface Staff {
  StaffID: number;
  Email?: string;
  FirstName: string;
  LastName: string;
  Birthday: string | Dayjs;
  Status: WorkStatus;
  Address: string;
  Gender_ID: number;
  Gender?: any | null;
}

/* =========================
 * Config / Constants
 * =======================*/
const API_BASE = "http://localhost:8088/api";
const LAYOUT = {
  page: { maxWidth: 1400, margin: "0 auto", padding: 24 },
  toolbarCard: { marginBottom: 16 },
  tableScroll: { x: 1200 },
} as const;

/* =========================
 * Utils
 * =======================*/
const generateRandomStaffID = () => Math.floor(100 + Math.random() * 900);
const generateUnique3DigitID = (existing: number[]) => {
  const used = new Set(existing);
  for (let i = 0; i < 200; i++) {
    const id = generateRandomStaffID();
    if (!used.has(id)) return id;
  }
  return generateRandomStaffID();
};

const statusMap: Record<WorkStatus, { color: string; text: WorkStatus }> = {
  "ทำงานอยู่": { color: "success", text: "ทำงานอยู่" },
  "ไม่ได้ทำงาน": { color: "error", text: "ไม่ได้ทำงาน" },
};

const calcAge = (birthday: string | Dayjs) => {
  if (!birthday) return "-";
  const b = dayjs(birthday);
  return b.isValid() ? `${dayjs().diff(b, "year")} ปี` : "-";
};

const getAvatarColor = (seed: number) => {
  const colors = ["#ff7a45", "#722ed1", "#fadb14", "#13c2c2", "#52c41a", "#eb2f96", "#1677ff"];
  return colors[Math.abs(seed) % colors.length];
};

const toPayload = (formValues: Partial<Omit<Staff, "StaffID">> & { StaffID?: number }) => ({
  ...formValues,
  Gender_ID: Number((formValues as any).Gender_ID),
  Birthday: formValues.Birthday ? dayjs(formValues.Birthday).toISOString() : null,
});

const getGenderText = (r: Staff, genders: Gender[]) => {
  const fromObj =
    (r as any)?.Gender?.Gender ??
    (r as any)?.gender?.Gender ??
    (r as any)?.Gender?.gender ??
    (r as any)?.gender?.gender ??
    (r as any)?.GenderName ??
    (r as any)?.genderName ??
    (r as any)?.Gender?.Name ??
    (r as any)?.gender?.Name;

  if (typeof fromObj === "string" && fromObj.trim()) return fromObj;

  const idNum = Number(r.Gender_ID);
  const found = genders.find((g) => Number(g.Gender_ID) === idNum);
  if (found?.Gender) return found.Gender;
  return "-";
};

/* =========================
 * Status TEXT toggle (ตาราง)
 * - เลือกอันไหน อันนั้นมีสี (เขียว/แดง) อีกอันเป็นสีเทา
 * - ไม่มีพื้นหลัง/กรอบ
 * =======================*/
function StatusPillToggle({
  value,
  onChange,
  loading,
  disabled,
}: {
  value: WorkStatus;
  onChange: (v: WorkStatus) => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`status-toggle-wrap ${loading ? "is-loading" : ""}`}>
      <Segmented
        className="status-segment --text-only"
        size="small"
        value={value}
        onChange={(v) => onChange(v as WorkStatus)}
        disabled={loading || disabled}
        options={[
          {
            value: "ทำงานอยู่",
            label: (
              <span className="seg-text seg-work">
                <CheckCircleFilled className="seg-ic" />
                ทำงานอยู่
              </span>
            ),
          },
          {
            value: "ไม่ได้ทำงาน",
            label: (
              <span className="seg-text seg-off">
                <CloseCircleFilled className="seg-ic" />
                ไม่ได้ทำงาน
              </span>
            ),
          },
        ]}
      />
      {loading && <Spin size="small" style={{ marginLeft: 6 }} />}
    </div>
  );
}

/* =========================
 * Component
 * =======================*/
export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();
  const [notify, notifyHolder] = notification.useNotification();
  const toast = {
    success: (msg: string, desc?: string) =>
      notify.success({ message: msg, description: desc, placement: "bottomRight" }),
    error: (msg: string, desc?: string) =>
      notify.error({ message: msg, description: desc, placement: "bottomRight" }),
    info: (msg: string, desc?: string) =>
      notify.info({ message: msg, description: desc, placement: "bottomRight" }),
  };

  // data
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [loading, setLoading] = useState({ table: true, submit: false });
  const [statusLoading, setStatusLoading] = useState<Record<number, boolean>>({});

  // filters
  const [filters, setFilters] = useState<{
    query: string;
    gender: number | undefined;
    status: WorkStatus | undefined;
  }>({ query: "", gender: undefined, status: undefined });

  // View/Edit/Add Modal states (อ้างอิง flow ระบบตรวจโรค)
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Staff | null>(null);
  const [isEditing, setIsEditing] = useState(false); // false = view

  const isView = selected !== null && !isEditing;

  /* ---------- Fetchers ---------- */
  const fetchStaffs = async () => {
    setLoading((prev) => ({ ...prev, table: true }));
    try {
      const { data } = await axios.get(`${API_BASE}/staffs`);
      const list = Array.isArray(data) ? data : data?.data;
      const normalized: Staff[] = (list || []).map((raw: any) => ({
        StaffID: Number(raw.StaffID ?? raw.staff_id ?? raw.id ?? 0),
        Email: raw.Email ?? raw.email ?? undefined,
        FirstName: raw.FirstName ?? raw.first_name ?? raw.firstName ?? "",
        LastName: raw.LastName ?? raw.last_name ?? raw.lastName ?? "",
        Birthday: raw.Birthday ?? raw.birthday ?? "",
        Status: (raw.Status ?? raw.status ?? "ทำงานอยู่") as WorkStatus,
        Address: raw.Address ?? raw.address ?? "",
        Gender_ID: Number(raw.Gender_ID ?? raw.gender_id ?? raw.genderId ?? raw.gender ?? 0),
        Gender: raw.Gender ?? raw.gender ?? null,
      }));
      setStaffs(normalized);
    } catch {
      toast.error("โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setLoading((prev) => ({ ...prev, table: false }));
    }
  };

  const fetchGenders = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/genders`);
      const list = Array.isArray(data) ? data : data?.data;
      const cleaned: Gender[] = (list || []).map((g: any) => ({
        Gender_ID: Number(g.Gender_ID ?? g.gender_id ?? g.id ?? g.genderId),
        Gender: g.Gender ?? g.gender ?? g.Name ?? g.name ?? "-",
      }));
      setGenders(cleaned);
    } catch {
      toast.error("โหลดข้อมูลเพศไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchGenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Derived ---------- */
  const filteredStaffs: Staff[] = useMemo(() => {
    const { query, gender, status } = filters;
    const q = query.trim().toLowerCase();
    if (!q && !gender && !status) return staffs;

    return staffs.filter((s) => {
      const name = `${s.FirstName} ${s.LastName}`.toLowerCase();
      const email = (s.Email ?? "").toLowerCase();
      const idStr = String(s.StaffID);

      const matchQuery = !q || name.includes(q) || email.includes(q) || idStr.includes(q);
      const matchGender = !gender || Number(s.Gender_ID) === Number(gender);
      const matchStatus = !status || s.Status === status;

      return matchQuery && matchGender && matchStatus;
    });
  }, [staffs, filters]);

  /* ---------- Handlers ---------- */
  const handleFilterChange = (key: keyof typeof filters, value: any) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => {
    setFilters({ query: "", gender: undefined, status: undefined });
    toast.success("ล้างตัวกรองทั้งหมดแล้ว");
  };

  // เปิดโหมดเพิ่ม (อ้างอิงระบบตรวจโรค)
  const openAdd = () => {
    form.resetFields();
    setSelected(null);
    setIsEditing(true);
    setModalOpen(true);
  };

  // เปิดโหมดดู (read-only) แบบเดียวกับระบบตรวจโรค
  const openView = (record: Staff) => {
    setSelected(record);
    setIsEditing(false);
    form.setFieldsValue({
      ...record,
      Gender_ID: Number(record.Gender_ID),
      Birthday: record.Birthday ? dayjs(record.Birthday) : undefined,
      Status: record.Status,
    } as any);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelected(null);
    setIsEditing(false);
    form.resetFields();
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/staffs/${id}`);
      toast.success("ลบข้อมูลสำเร็จ");
      fetchStaffs();
    } catch {
      toast.error("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const changeStatusInline = async (record: Staff, next: WorkStatus) => {
    if (record.Status === next) return;
    setStaffs((prev) => prev.map((s) => (s.StaffID === record.StaffID ? { ...s, Status: next } : s)));
    setStatusLoading((prev) => ({ ...prev, [record.StaffID]: true }));
    try {
      const fullPayload = toPayload({ ...record, Status: next });
      await axios.put(`${API_BASE}/staffs/${record.StaffID}`, fullPayload);
      toast.success(`อัปเดตสถานะเป็น "${next}" แล้ว`);
    } catch (e: any) {
      setStaffs((prev) =>
        prev.map((s) => (s.StaffID === record.StaffID ? { ...s, Status: record.Status } : s))
      );
      const errText = e?.response?.data?.error ?? "อัปเดตสถานะไม่สำเร็จ";
      toast.error(errText);
    } finally {
      setStatusLoading((prev) => ({ ...prev, [record.StaffID]: false }));
    }
  };

  const onFinish = async (values: Omit<Staff, "StaffID">) => {
    setLoading((prev) => ({ ...prev, submit: true }));
    try {
      if (selected && isEditing) {
        // แก้ไข (ห้ามแก้สถานะในหน้าแก้ไข -> ใช้สถานะเดิม)
        const payload = toPayload({ ...values, Status: selected.Status });
        await axios.put(`${API_BASE}/staffs/${selected.StaffID}`, payload);
        toast.success("แก้ไขข้อมูลสำเร็จ");
      } else if (!selected && isEditing) {
        // เพิ่ม
        const basePayload = toPayload(values);
        const finalPayload = {
          ...basePayload,
          StaffID: generateUnique3DigitID(staffs.map((s) => s.StaffID)),
        };
        await axios.post(`${API_BASE}/staffs`, finalPayload);
        toast.success("เพิ่มข้อมูลเจ้าหน้าที่สำเร็จ");
      }
      await fetchStaffs();
      closeModal();
    } catch (e: any) {
      const errText = e?.response?.data?.error ?? "บันทึกข้อมูลไม่สำเร็จ";
      toast.error(errText);
    } finally {
      setLoading((prev) => ({ ...prev, submit: false }));
    }
  };

  /* ---------- Table Columns ---------- */
  const columns: ColumnsType<Staff> = [
    {
      title: "เจ้าหน้าที่",
      key: "staffInfo",
      width: 280,
      fixed: "left",
      render: (_, r) => (
        <Space>
          <Avatar style={{ backgroundColor: getAvatarColor(r.StaffID) }} size="large">
            {r.FirstName?.charAt(0)}
          </Avatar>
          <div>
            <Text strong>{`${r.FirstName} ${r.LastName}`}</Text>
            <br />
            {r.Email && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <MailOutlined style={{ marginRight: 4 }} />
                {r.Email}
              </Text>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "รหัส",
      dataIndex: "StaffID",
      width: 90,
      align: "center",
      render: (id) => <Tag>#{id}</Tag>,
    },
    {
      title: "สถานะ",
      dataIndex: "Status",
      width: 260,
      align: "center",
      render: (_: WorkStatus, record) => (
        <StatusPillToggle
          value={record.Status}
          loading={!!statusLoading[record.StaffID]}
          onChange={(v) => changeStatusInline(record, v)}
        />
      ),
    },
    {
      title: "อายุ",
      dataIndex: "Birthday",
      width: 90,
      align: "center",
      responsive: ["md"],
      render: calcAge,
    },
    {
      title: "เพศ",
      key: "GenderText",
      width: 100,
      align: "center",
      responsive: ["sm"],
      render: (_: any, r: Staff) => getGenderText(r, genders),
    },
    {
      title: "ที่อยู่",
      dataIndex: "Address",
      ellipsis: true,
      responsive: ["lg"],
      render: (addr) => addr || "-",
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 200,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          {/* เปลี่ยนจาก แก้ไข → ดู (อ้างอิงอีกระบบ) */}
          <Button icon={<EyeOutlined />} type="primary" ghost size="small" onClick={() => openView(record)}>
            ดู
          </Button>
          <Popconfirm
            title="ยืนยันการลบ"
            description={`คุณแน่ใจหรือไม่ว่าต้องการลบ ${record.FirstName}?`}
            onConfirm={() => handleDelete(record.StaffID)}
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} danger size="small">
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={LAYOUT.page}>
      {notifyHolder}

      {/* --- styles ของ toggle แบบตัวหนังสือ --- */}
      <style>{`
        .status-toggle-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .status-toggle-wrap.is-loading { opacity: .85; }
        .status-segment.--text-only.ant-segmented,
        .status-segment.--text-only .ant-segmented-group {
          background: transparent !important;
          box-shadow: none !important;
          border: none !important;
          padding: 0 !important;
        }
        .status-segment.--text-only .ant-segmented-item {
          border-radius: 6px;
          padding: 0 6px;
          min-height: 0;
          line-height: 1.2;
        }
        /* base = เทา */
        .status-segment.--text-only .seg-text {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 13px;
          color: #8c8c8c;
        }
        .status-segment.--text-only .seg-ic { font-size: 14px; }
        /* selected = สีจริง */
        .status-segment.--text-only .ant-segmented-item-selected .seg-work { color: #1a7a43; }
        .status-segment.--text-only .ant-segmented-item-selected .seg-off  { color: #b4232c; }
        .status-segment.--text-only .ant-segmented-item-selected,
        .status-segment.--text-only .ant-segmented-item:hover {
          background: transparent !important;
        }
      `}</style>

      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <Title level={2} style={{ margin: 0 }}>
              <UserOutlined /> จัดการข้อมูลเจ้าหน้าที่
            </Title>
          </Space>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openAdd}>
            เพิ่มเจ้าหน้าที่
          </Button>
        </Col>
      </Row>

      {/* Toolbar */}
      <Card style={LAYOUT.toolbarCard}>
        <Row gutter={[16, 16]} justify="space-between">
          <Col xs={24} md={16}>
            <Space wrap>
              <Input
                placeholder="ค้นหา ชื่อ, รหัส, อีเมล..."
                allowClear
                prefix={<SearchOutlined />}
                style={{ width: 300 }}
                value={filters.query}
                onChange={(e) => handleFilterChange("query", e.target.value)}
              />
              <Select<number>
                allowClear
                placeholder="กรองตามเพศ"
                style={{ width: 150 }}
                value={filters.gender}
                onChange={(v) => handleFilterChange("gender", v)}
                options={genders.map((g) => ({ value: g.Gender_ID, label: g.Gender }))}
              />
              <Select<WorkStatus>
                allowClear
                placeholder="กรองตามสถานะ"
                style={{ width: 150 }}
                value={filters.status}
                onChange={(v) => handleFilterChange("status", v)}
                options={Object.entries(statusMap).map(([_, val]) => ({
                  value: val.text as WorkStatus,
                  label: val.text,
                }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>
                ล้างตัวกรอง
              </Button>
              <Button onClick={fetchStaffs} loading={loading.table}>
                โหลดใหม่
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table<Staff>
          rowKey="StaffID"
          columns={columns}
          dataSource={filteredStaffs}
          loading={loading.table}
          locale={{ emptyText: <Empty description="ไม่พบข้อมูลเจ้าหน้าที่" /> }}
          pagination={{
            showTotal: (total, range) => `แสดง ${range[0]}-${range[1]} จาก ${total} รายการ`,
            defaultPageSize: 10,
            pageSizeOptions: ["10", "20", "50"],
            showSizeChanger: true,
          }}
          scroll={LAYOUT.tableScroll}
        />
      </Card>

      {/* Modal: เพิ่ม/ดู/แก้ไข (Reference Style) */}
      <Modal
        title={
          isView ? "ดูข้อมูลเจ้าหน้าที่" : (selected ? "แก้ไขข้อมูลเจ้าหน้าที่" : "เพิ่มเจ้าหน้าที่")
        }
        open={modalOpen}
        onCancel={closeModal}
        footer={null}
        destroyOnClose
        width={720}
        centered
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          {/* แถบข้อมูลส่วนหัว/สถานะในมุมมอง (แสดงสถานะเป็นตัวหนังสือ; ถ้า view = กดไม่ได้) */}
          {selected && (
            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar style={{ backgroundColor: getAvatarColor(selected.StaffID) }}>
                  {selected.FirstName?.charAt(0)}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 700 }}>{selected.FirstName} {selected.LastName}</div>
                  <div style={{ color: "#8c8c8c" }}>รหัส #{selected.StaffID}</div>
                </div>
              </div>

              {/* สถานะ (disabled ใน view และ edit modal ตามข้อกำชับเดิม) */}
              <StatusPillToggle
                value={selected.Status}
                onChange={() => {}}
                disabled={true}
              />
            </div>
          )}

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="ชื่อ" name="FirstName" rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}>
                <Input placeholder="เช่น สมชาย" disabled={isView} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="นามสกุล" name="LastName" rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}>
                <Input placeholder="เช่น ใจดี" disabled={isView} />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="เพศ" name="Gender_ID" rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}>
                <Select<number>
                  placeholder="เลือกเพศ"
                  disabled={isView}
                  options={genders.map((g) => ({ value: g.Gender_ID, label: g.Gender }))}
                />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="วันเกิด" name="Birthday" rules={[{ required: true, message: "กรุณาเลือกวันเกิด" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="เลือกวันเกิด" disabled={isView} />
              </Form.Item>
            </Col>

            {/* สถานะการทำงาน: แสดงเฉพาะตอนเพิ่มใหม่ เท่านั้น (ตามข้อกำชับเดิม) */}
            {!selected && isEditing && (
              <Col xs={24} sm={12}>
                <Form.Item
                  label="สถานะการทำงาน"
                  name="Status"
                  rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}
                  initialValue="ทำงานอยู่"
                >
                  <Select<WorkStatus>
                    placeholder="เลือกสถานะ"
                    options={[
                      { value: "ทำงานอยู่", label: "ทำงานอยู่" },
                      { value: "ไม่ได้ทำงาน", label: "ไม่ได้ทำงาน" },
                    ]}
                  />
                </Form.Item>
              </Col>
            )}

            <Col xs={24}>
              <Form.Item label="อีเมล" name="Email" rules={[{ type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" }]}>
                <Input type="email" placeholder="name@example.com" disabled={isView} />
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="ที่อยู่" name="Address">
                <Input.TextArea rows={3} placeholder="รายละเอียดที่อยู่" disabled={isView} />
              </Form.Item>
            </Col>
          </Row>

          {/* Footer แบบเดียวกับอีกระบบ: ปุ่มแก้ไขในหน้า “ดู” / ปุ่มยกเลิก-บันทึกในหน้า เพิ่ม/แก้ไข */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            {selected && isView ? (
              <Button onClick={() => setIsEditing(true)} icon={<EditOutlined />}>
                แก้ไข
              </Button>
            ) : (
              <span />
            )}

            <div style={{ marginLeft: "auto" }}>
              {selected && isView ? (
                <Button type="primary" onClick={closeModal}>ปิด</Button>
              ) : (
                <>
                  <Button onClick={closeModal} style={{ marginRight: 8 }}>
                    ยกเลิก
                  </Button>
                  <Button type="primary" htmlType="submit" loading={loading.submit}>
                    {selected ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
