import { useState, useEffect, useMemo } from "react";
import {
  Input, Button, Card, Form, DatePicker, Row, Col, Typography, message,
  Select, Table, Space, Modal, Popconfirm, Tag, Empty, Avatar,
} from "antd";
import {
  SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UserOutlined,
  ReloadOutlined, MailOutlined,
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
  Gender_ID: number;      // ทำให้เป็น number เสมอ (normalize ตอนดึง)
  Gender?: any | null;    // รองรับหลายรูปแบบที่ backend อาจส่งมา
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
// ✅ สร้างเลข 3 หลักระหว่าง 100-999
const generateRandomStaffID = () => Math.floor(100 + Math.random() * 900);

// ✅ สุ่มจนไม่ซ้ำกับที่มีอยู่ในตาราง (กันชนเบื้องต้น)
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

// ✅ แปลงค่าใน payload ให้ตรงชนิด
const toPayload = (formValues: Omit<Staff, 'StaffID'>) => ({
  ...formValues,
  Gender_ID: Number((formValues as any).Gender_ID),
  Birthday: formValues.Birthday ? dayjs(formValues.Birthday).toISOString() : null,
});

// ✅ ดึงชื่อเพศได้หลายรูปแบบ + fallback ด้วย lookup จาก genders
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
  const found = genders.find(g => Number(g.Gender_ID) === idNum);
  if (found?.Gender) return found.Gender;

  return "-";
};

/* =========================
 * Component
 * =======================*/
export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();
  const [msg, contextHolder] = message.useMessage(); // ✅ ใช้ message.useMessage

  // Data states
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [loading, setLoading] = useState({ table: true, submit: false });

  // Filter states
  const [filters, setFilters] = useState<{
    query: string;
    gender: number | undefined;
    status: WorkStatus | undefined;
  }>({
    query: "",
    gender: undefined,
    status: undefined,
  });

  // Modal state
  const [modal, setModal] = useState<{ open: boolean, data: Staff | null }>({
    open: false,
    data: null,
  });
  const isEditing = !!modal.data;

  /* ---------- Fetchers ---------- */
  const fetchStaffs = async () => {
    setLoading(prev => ({ ...prev, table: true }));
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
      msg.error("โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setLoading(prev => ({ ...prev, table: false }));
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
      msg.error("โหลดข้อมูลเพศไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchGenders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Derived Data (Memoized) ---------- */
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
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ query: "", gender: undefined, status: undefined });
    msg.success("ล้างตัวกรองทั้งหมดแล้ว");
  };

  const openModal = (staff: Staff | null) => {
    setModal({ open: true, data: staff });
    if (staff) {
      form.setFieldsValue({
        ...staff,
        Gender_ID: Number(staff.Gender_ID),
        Birthday: staff.Birthday ? dayjs(staff.Birthday) : undefined,
      } as any);
    } else {
      form.resetFields();
    }
  };

  const closeModal = () => {
    setModal({ open: false, data: null });
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_BASE}/staffs/${id}`);
      msg.success("ลบข้อมูลสำเร็จ");
      fetchStaffs();
    } catch {
      msg.error("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const onFinish = async (values: Omit<Staff, 'StaffID'>) => {
    setLoading(prev => ({ ...prev, submit: true }));

    try {
      if (isEditing) {
        const payload = toPayload(values);
        await axios.put(`${API_BASE}/staffs/${modal.data?.StaffID}`, payload);
        msg.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        const basePayload = toPayload(values);
        const finalPayload = {
          ...basePayload,
          StaffID: generateUnique3DigitID(staffs.map(s => s.StaffID)), // ✅ 3 หลัก & กันซ้ำหน้าบ้าน
        };

        await axios.post(`${API_BASE}/staffs`, finalPayload);
        // 🔔 แจ้งเตือนทันทีหลังเพิ่ม
        msg.success("เพิ่มข้อมูลเจ้าหน้าที่สำเร็จ");
      }

      await fetchStaffs();
      closeModal();
    } catch (e: any) {
      const msgText = e?.response?.data?.error ?? "บันทึกข้อมูลไม่สำเร็จ";
      msg.error(msgText);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  };

  /* ---------- Table Columns Definition ---------- */
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
                <MailOutlined style={{ marginRight: 4 }}/> {r.Email}
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
      width: 120,
      align: "center",
      render: (status: WorkStatus) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>
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
      width: 175,
      align: "center",
      fixed: "right",
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            type="primary"
            ghost
            size="small"
            onClick={() => openModal(record)}
          >
            แก้ไข
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

  /* ---------- Render ---------- */
  return (
    <div style={LAYOUT.page}>
      {contextHolder} {/* ✅ ต้องมีเพื่อให้ toast โผล่แน่นอน */}

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
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => openModal(null)}>
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
                options={genders.map(g => ({ value: g.Gender_ID, label: g.Gender }))}
              />
              <Select<WorkStatus>
                allowClear
                placeholder="กรองตามสถานะ"
                style={{ width: 150 }}
                value={filters.status}
                onChange={(v) => handleFilterChange("status", v)}
                options={Object.entries(statusMap).map(([_, val]) => ({ value: val.text as WorkStatus, label: val.text }))}
              />
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: 'right' }}>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={resetFilters}>ล้างตัวกรอง</Button>
              <Button onClick={fetchStaffs} loading={loading.table}>โหลดใหม่</Button>
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

      {/* Modal */}
      <Modal
        title={
          <Title level={4} style={{ margin: 0 }}>
            <UserOutlined style={{ marginRight: 8 }} />
            {isEditing ? "แก้ไขข้อมูลเจ้าหน้าที่" : "เพิ่มเจ้าหน้าที่ใหม่"}
          </Title>
        }
        open={modal.open}
        onCancel={closeModal}
        destroyOnClose
        width={720}
        centered
        footer={[
          <Button key="back" onClick={closeModal}>ยกเลิก</Button>,
          <Button key="submit" type="primary" loading={loading.submit} onClick={() => form.submit()}>
            {isEditing ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="ชื่อ" name="FirstName" rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}>
                <Input placeholder="เช่น สมชาย" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="นามสกุล" name="LastName" rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}>
                <Input placeholder="เช่น ใจดี" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="เพศ" name="Gender_ID" rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}>
                <Select<number>
                  placeholder="เลือกเพศ"
                  options={genders.map(g => ({ value: g.Gender_ID, label: g.Gender }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="วันเกิด" name="Birthday" rules={[{ required: true, message: "กรุณาเลือกวันเกิด" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="เลือกวันเกิด" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="สถานะการทำงาน" name="Status" rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}>
                <Select<WorkStatus>
                  placeholder="เลือกสถานะ"
                  options={Object.entries(statusMap).map(([_, val]) => ({ value: val.text as WorkStatus, label: val.text }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="อีเมล" name="Email" rules={[{ type: 'email', message: 'รูปแบบอีเมลไม่ถูกต้อง' }]}>
                <Input type="email" placeholder="name@example.com" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="ที่อยู่" name="Address">
                <Input.TextArea rows={3} placeholder="รายละเอียดที่อยู่" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
