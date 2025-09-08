import { useMemo, useRef, useState, useEffect } from "react";
import {
  Input,
  Button,
  Card,
  Form,
  DatePicker,
  Row,
  Col,
  Typography,
  message,
  Select,
  Table,
  Space,
  Modal,
  Popconfirm,
  Tag,
  Segmented,
  Empty,
  Divider,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ReloadOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;
const { Option } = Select;

interface Gender {
  Gender_ID: number;
  Gender: string;
}

interface Staff {
  StaffID?: number;
  Email?: string;
  FirstName: string;
  LastName: string;
  Birthday: string | Dayjs;
  Status: string;
  Address: string;
  Gender_ID?: number;
  Gender?: Gender;
}

// สุ่ม StaffID 3 หลัก (int)
const generateStaffID = () => Math.floor(100 + Math.random() * 900);

const getStatusColor = (status: string) => {
  switch (status) {
    case "ทำงานอยู่":
      return "green";
    case "ไม่ได้ทำงาน":
      return "red";
    default:
      return "default";
  }
};

export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [filtered, setFiltered] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [genderFilter, setGenderFilter] = useState<number | undefined>();
  const [density, setDensity] = useState<"compact" | "default" | "spacious">("default");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [tableLoading, setTableLoading] = useState(false);

  // --- Fetch Staff
  const fetchStaffs = async () => {
    setTableLoading(true);
    try {
      const res = await axios.get("http://localhost:8088/api/staffs");
      setStaffs(res.data);
      setFiltered(res.data);
    } catch {
      message.error("โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setTableLoading(false);
    }
  };

  // --- Fetch Genders
  const fetchGenders = async () => {
    try {
      const res = await axios.get("http://localhost:8088/api/genders");
      setGenders(res.data);
    } catch {
      message.error("โหลดข้อมูลเพศไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchGenders();
  }, []);

  // --- Debounce search
  const debounceTimer = useRef<number | null>(null);
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      applyFilter(searchValue, statusFilter, genderFilter);
    }, 300);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [searchValue, statusFilter, genderFilter, staffs]);

  const clearFilters = () => {
    setSearchValue("");
    setStatusFilter(undefined);
    setGenderFilter(undefined);
    setFiltered(staffs);
  };

  const applyFilter = (
    q: string,
    status?: string,
    genderId?: number
  ) => {
    let next = [...staffs];
    if (q) {
      const lower = q.toLowerCase();
      next = next.filter(
        (s) =>
          (s.FirstName && s.FirstName.toLowerCase().includes(lower)) ||
          (s.LastName && s.LastName.toLowerCase().includes(lower)) ||
          (s.StaffID && s.StaffID.toString().includes(lower)) ||
          (s.Email && s.Email.toLowerCase().includes(lower))
      );
    }
    if (status) next = next.filter((s) => s.Status === status);
    if (genderId) next = next.filter((s) => (s.Gender_ID ?? s.Gender?.Gender_ID) === genderId);
    setFiltered(next);
  };

  // --- Modal handlers
  const openAdd = () => {
    form.resetFields();
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: Staff) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      Birthday: dayjs(record.Birthday),
      Gender_ID: record.Gender_ID || record.Gender?.Gender_ID,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id?: number) => {
    try {
      await axios.delete(`http://localhost:8088/api/staffs/${id}`);
      message.success("ลบข้อมูลสำเร็จ");
      fetchStaffs();
    } catch {
      message.error("ลบข้อมูลไม่สำเร็จ");
    }
  };

  const onFinish = async (values: any) => {
    const payload: Staff & { StaffID: number } = {
      ...values,
      Birthday: values.Birthday ? values.Birthday.toISOString() : null,
      StaffID: editing?.StaffID || generateStaffID(),
    };

    try {
      if (editing) {
        await axios.put(
          `http://localhost:8088/api/staffs/${editing.StaffID}`,
          payload
        );
        message.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post("http://localhost:8088/api/staffs", payload);
        message.success("เพิ่มเจ้าหน้าที่ใหม่สำเร็จ");
      }
      setModalOpen(false);
      fetchStaffs();
    } catch {
      message.error("บันทึกข้อมูลไม่สำเร็จ");
    }
  };

  const tableSize = useMemo(() => {
    if (density === "compact") return "small" as const;
    if (density === "spacious") return "large" as const;
    return "middle" as const;
  }, [density]);

  // --- Table columns ---
  const columns = [
    {
      title: "#",
      key: "index",
      width: 60,
      align: "center" as const,
      fixed: "left" as const,
      render: (_: any, _r: Staff, index: number) => (
        <span style={{ color: "#666" }}>{index + 1}</span>
      ),
    },
    {
      title: "รหัส",
      dataIndex: "StaffID",
      width: 100,
      align: "center" as const,
      render: (id: number) => (
        <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>{id}</Tag>
      ),
    },
    {
      title: "ชื่อ-นามสกุล",
      key: "name",
      width: 220,
      sorter: (a: Staff, b: Staff) =>
        `${a.FirstName} ${a.LastName}`.localeCompare(`${b.FirstName} ${b.LastName}`),
      render: (_: any, r: Staff) => (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: "#e6f4ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#1677ff",
              flexShrink: 0,
            }}
          >
            {(r.FirstName?.[0] || "?").toUpperCase()}
          </div>
          <span style={{ fontWeight: 600 }}>{r.FirstName} {r.LastName}</span>
        </div>
      ),
    },
    {
      title: "สถานะ",
      key: "status",
      width: 130,
      filters: [
        { text: "ทำงานอยู่", value: "ทำงานอยู่" },
        { text: "ไม่ได้ทำงาน", value: "ไม่ได้ทำงาน" },
      ],
      onFilter: (value: any, record: Staff) => record.Status === value,
      render: (_: any, r: Staff) => (
        <Tag color={getStatusColor(r.Status)} style={{ fontWeight: 600 }}>{r.Status}</Tag>
      ),
    },
    {
      title: "วันเกิด",
      dataIndex: "Birthday",
      width: 140,
      align: "center" as const,
      sorter: (a: Staff, b: Staff) => dayjs(a.Birthday).unix() - dayjs(b.Birthday).unix(),
      render: (d: string) => (
        <div style={{ fontSize: 12, textAlign: "center" }}>
          <CalendarOutlined style={{ color: "#666", marginRight: 6 }} />
          {dayjs(d).format("DD/MM/YY")}
        </div>
      ),
    },
    {
      title: "อีเมล",
      dataIndex: "Email",
      width: 260,
      ellipsis: true,
      render: (email: string) => (
        <Text style={{ color: "#595959" }} ellipsis>{email || "-"}</Text>
      ),
    },
    {
      title: "ที่อยู่",
      dataIndex: "Address",
      width: 320,
      ellipsis: true,
      render: (address: string) => (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }}>
          <EnvironmentOutlined style={{ color: "#666", marginTop: 2 }} />
          <Text style={{ color: "#595959" }} ellipsis>{address || "-"}</Text>
        </div>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 160,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: any, record: Staff) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            size="small"
            type="primary"
            ghost
            onClick={() => openEdit(record)}
            style={{ minWidth: 60 }}
          >
            แก้ไข
          </Button>
          <Popconfirm
            title="ยืนยันการลบ"
            description="แน่ใจหรือไม่ว่าจะลบเจ้าหน้าที่คนนี้?"
            onConfirm={() => handleDelete(record.StaffID)}
            okText="ลบ"
            cancelText="ยกเลิก"
          >
            <Button icon={<DeleteOutlined />} size="small" danger style={{ minWidth: 50 }}>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- Quick stats (UI บนหัวตาราง)
  const total = staffs.length;
  const working = staffs.filter((s) => s.Status === "ทำงานอยู่").length;
  const inactive = staffs.filter((s) => s.Status === "ไม่ได้ทำงาน").length;

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Title level={2} style={{ margin: 0, color: "#1677ff" }}>
          <UserOutlined style={{ marginRight: 12 }} /> จัดการเจ้าหน้าที่
        </Title>
        <Segmented
          size="large"
          options={[{ label: "กระชับ", value: "compact" }, { label: "ปกติ", value: "default" }, { label: "โปร่ง", value: "spacious" }]}
          value={density}
          onChange={(val) => setDensity(val as any)}
        />
      </div>

      {/* Toolbar */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="ค้นหาด้วย รหัส, ชื่อ-นามสกุล หรือ Email"
              allowClear
              size="large"
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="ค้นหาเจ้าหน้าที่"
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              placeholder={<span><FilterOutlined /> สถานะ</span>}
              size="large"
              style={{ width: "100%" }}
              options={[
                { label: "ทำงานอยู่", value: "ทำงานอยู่" },
                { label: "ไม่ได้ทำงาน", value: "ไม่ได้ทำงาน" },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              value={genderFilter}
              onChange={setGenderFilter}
              allowClear
              placeholder={<span><FilterOutlined /> เพศ</span>}
              size="large"
              style={{ width: "100%" }}
            >
              {genders.map((g) => (
                <Option key={g.Gender_ID} value={g.Gender_ID}>{g.Gender}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Space.Compact style={{ width: "100%" }}>
              <Button icon={<ReloadOutlined />} onClick={clearFilters} size="large">
                ล้างตัวกรอง
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} size="large">
                เพิ่ม
              </Button>
            </Space.Compact>
          </Col>
        </Row>

        <Divider style={{ margin: "12px 0" }} />

        {/* Quick stats */}
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <Card size="small" bordered style={{ background: "#f7fbff" }}>
              <Text strong>รวม</Text>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{total.toLocaleString()}</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" bordered style={{ background: "#f6ffed" }}>
              <Text strong>ทำงานอยู่</Text>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#52c41a" }}>{working.toLocaleString()}</div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card size="small" bordered style={{ background: "#fff1f0" }}>
              <Text strong>ไม่ได้ทำงาน</Text>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#ff4d4f" }}>{inactive.toLocaleString()}</div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          sticky
          columns={columns}
          rowKey={(r) => r.StaffID ?? `${r.FirstName}-${r.LastName}`}
          dataSource={filtered}
          loading={tableLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `แสดง ${range[0]}-${range[1]} จาก ${total} รายการ`,
            pageSizeOptions: ["5", "10", "20", "50"],
          }}
          bordered
          scroll={{ x: 1100 }}
          size={tableSize}
          locale={{
            emptyText: (
              <Empty
                description={
                  <span>
                    ไม่พบข้อมูล ลองปรับตัวกรองหรือคลิก <a onClick={clearFilters}>ล้างตัวกรอง</a>
                  </span>
                }
              />
            ),
          }}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={
          <div style={{ fontSize: 18, fontWeight: 700, color: "#1677ff" }}>
            <UserOutlined style={{ marginRight: 8 }} />
            {editing ? "แก้ไขข้อมูลเจ้าหน้าที่" : "เพิ่มข้อมูลเจ้าหน้าที่ใหม่"}
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={820}
        centered
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Card size="small" title="ข้อมูลส่วนตัว" style={{ marginBottom: 12 }}>
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="ชื่อ"
                  name="FirstName"
                  rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
                >
                  <Input size="large" autoFocus />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="นามสกุล"
                  name="LastName"
                  rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}
                >
                  <Input size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="เพศ"
                  name="Gender_ID"
                  rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}
                >
                  <Select placeholder="เลือกเพศ" size="large">
                    {genders.map((g) => (
                      <Option key={g.Gender_ID} value={g.Gender_ID}>
                        {g.Gender}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="วันเกิด"
                  name="Birthday"
                  rules={[{ required: true, message: "กรุณาเลือกวันเกิด" }]}
                >
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" size="large" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="ข้อมูลการทำงาน" style={{ marginBottom: 12 }}>
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="สถานะ"
                  name="Status"
                  rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}
                >
                  <Select size="large">
                    <Option value="ทำงานอยู่">ทำงานอยู่</Option>
                    <Option value="ไม่ได้ทำงาน">ไม่ได้ทำงาน</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <Card size="small" title="ข้อมูลติดต่อ">
            <Row gutter={12}>
              <Col xs={24}>
                <Form.Item label="อีเมล" name="Email" rules={[{ type: "email", message: "อีเมลไม่ถูกต้อง" }]}>
                  <Input size="large" type="email" placeholder="name@example.com" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="ที่อยู่" name="Address">
                  <Input.TextArea rows={3} size="large" placeholder="บ้านเลขที่ / ถนน / ตำบล / อำเภอ / จังหวัด" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          <div style={{ textAlign: "right", paddingTop: 8 }}>
            <Space size="middle">
              <Button
                size="large"
                onClick={() => {
                  setModalOpen(false);
                  form.resetFields();
                }}
              >
                ยกเลิก
              </Button>
              <Button type="primary" htmlType="submit" size="large" style={{ fontWeight: 700 }}>
                {editing ? "บันทึกการแก้ไข" : "เพิ่มเจ้าหน้าที่"}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}