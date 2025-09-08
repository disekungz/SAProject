import { useState, useEffect, useMemo } from "react";
import {
  Input, Button, Card, Form, DatePicker, Row, Col, Typography, message,
  Select, Table, Space, Modal, Popconfirm, Tag, Empty, Badge, Avatar,
} from "antd";
import {
  SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined, UserOutlined,
  ReloadOutlined, MailOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import type { ColumnsType } from "antd/es/table";

const { Title, Text, Paragraph } = Typography;

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
  Gender?: Gender;
}

/* =========================
 * Config / Constants
 * =======================*/
const API_BASE = "http://localhost:8088/api";
const LAYOUT = {
  page: { maxWidth: 1400, margin: "0 auto", padding: 24 },
  toolbarCard: { marginBottom: 16 },
  tableScroll: { x: 1000 },
} as const;

/* =========================
 * Utils
 * =======================*/
const statusMap: Record<WorkStatus, { color: string; text: string }> = {
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

const toPayload = (formValues: Omit<Staff, 'StaffID'>) => ({
  ...formValues,
  Birthday: formValues.Birthday ? dayjs(formValues.Birthday).toISOString() : null,
});

/* =========================
 * Component
 * =======================*/
export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();

  // Data states
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [loading, setLoading] = useState({ table: true, submit: false });

  // Filter states
  const [filters, setFilters] = useState({
    query: "",
    gender: undefined as number | undefined,
    status: undefined as WorkStatus | undefined,
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
      const { data } = await axios.get<Staff[]>(`${API_BASE}/staffs`);
      setStaffs(data || []);
    } catch {
      message.error("โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setLoading(prev => ({ ...prev, table: false }));
    }
  };

  const fetchGenders = async () => {
    try {
      const { data } = await axios.get<Gender[]>(`${API_BASE}/genders`);
      setGenders(data || []);
    } catch {
      message.error("โหลดข้อมูลเพศไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchGenders();
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
      const matchGender = !gender || s.Gender_ID === gender;
      const matchStatus = !status || s.Status === status;

      return matchQuery && matchGender && matchStatus;
    });
  }, [staffs, filters]);
  
  const staffCounts = useMemo(() => ({
      total: staffs.length,
      active: staffs.filter(s => s.Status === 'ทำงานอยู่').length
  }), [staffs]);


  /* ---------- Handlers ---------- */
  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ query: "", gender: undefined, status: undefined });
    message.success("ล้างตัวกรองทั้งหมดแล้ว");
  };

  const openModal = (staff: Staff | null) => {
    setModal({ open: true, data: staff });
    if (staff) {
      form.setFieldsValue({
        ...staff,
        Birthday: staff.Birthday ? dayjs(staff.Birthday) : undefined,
      });
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
      message.success("ลบข้อมูลสำเร็จ");
      fetchStaffs(); // Refresh data
    } catch {
      message.error("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const onFinish = async (values: Omit<Staff, 'StaffID'>) => {
    setLoading(prev => ({ ...prev, submit: true }));
    const payload = toPayload(values);

    try {
      if (isEditing) {
        await axios.put(`${API_BASE}/staffs/${modal.data?.StaffID}`, payload);
        message.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post(`${API_BASE}/staffs`, payload);
        message.success("เพิ่มเจ้าหน้าที่ใหม่สำเร็จ");
      }
      closeModal();
      fetchStaffs(); // Refresh data
    } catch {
      message.error("บันทึกข้อมูลไม่สำเร็จ");
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
            {r.FirstName.charAt(0)}
          </Avatar>
          <div>
            <Text strong>{`${r.FirstName} ${r.LastName}`}</Text>
            <br />
            {r.Email && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                <MailOutlined style={{ marginRight: 4 }}/>{r.Email}
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
      dataIndex: ["Gender", "Gender"],
      width: 100,
      align: "center",
      responsive: ["sm"],
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
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Space align="center">
            <Title level={2} style={{ margin: 0 }}><UserOutlined /> จัดการข้อมูลเจ้าหน้าที่</Title>
            <Badge count={staffCounts.total} color="blue" title="จำนวนทั้งหมด" />
            <Badge count={staffCounts.active} color="green" title="ทำงานอยู่" />
          </Space>
          <Paragraph type="secondary">แสดง, เพิ่ม, แก้ไข และลบข้อมูลของเจ้าหน้าที่ในระบบ</Paragraph>
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
              <Select
                allowClear placeholder="กรองตามเพศ" style={{ width: 150 }}
                value={filters.gender}
                onChange={(v) => handleFilterChange("gender", v)}
                options={genders.map(g => ({ value: g.Gender_ID, label: g.Gender }))}
              />
              <Select
                allowClear placeholder="กรองตามสถานะ" style={{ width: 150 }}
                value={filters.status}
                onChange={(v) => handleFilterChange("status", v)}
                options={Object.entries(statusMap).map(([_, val]) => ({ value: val.text, label: val.text }))}
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
                <Select placeholder="เลือกเพศ" options={genders.map(g => ({ value: g.Gender_ID, label: g.Gender }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="วันเกิด" name="Birthday" rules={[{ required: true, message: "กรุณาเลือกวันเกิด" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="เลือกวันเกิด" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="สถานะการทำงาน" name="Status" rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}>
                <Select placeholder="เลือกสถานะ" options={Object.entries(statusMap).map(([_, val]) => ({ value: val.text, label: val.text }))} />
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
