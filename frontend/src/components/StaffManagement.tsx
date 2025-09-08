import { useState, useEffect, useMemo } from "react";
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
  Empty,
  Divider,
  Badge,
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

const calcAge = (birthday: string | Dayjs) => {
  if (!birthday) return "-";
  const b = dayjs(birthday);
  if (!b.isValid()) return "-";
  return dayjs().diff(b, "year");
};

export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  // Toolbar state
  const [searchValue, setSearchValue] = useState("");
  const [filterGender, setFilterGender] = useState<number | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  // --- Fetch ---
  const fetchStaffs = async () => {
    setTableLoading(true);
    try {
      const res = await axios.get("http://localhost:8088/api/staffs");
      setStaffs(res.data);
    } catch {
      message.error("โหลดข้อมูลเจ้าหน้าที่ไม่สำเร็จ");
    } finally {
      setTableLoading(false);
    }
  };

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

  // --- Derived data (อ่านง่ายด้วย useMemo) ---
  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    return staffs.filter((s) => {
      const matchQ =
        !q ||
        `${s.FirstName ?? ""} ${s.LastName ?? ""}`.toLowerCase().includes(q) ||
        (s.Email ?? "").toLowerCase().includes(q) ||
        String(s.StaffID ?? "").includes(q);

      const matchGender =
        !filterGender ||
        s.Gender_ID === filterGender ||
        s.Gender?.Gender_ID === filterGender;

      const matchStatus = !filterStatus || s.Status === filterStatus;

      return matchQ && matchGender && matchStatus;
    });
  }, [staffs, searchValue, filterGender, filterStatus]);

  const resetFilters = () => {
    setSearchValue("");
    setFilterGender(undefined);
    setFilterStatus(undefined);
  };

  // --- Modal handlers ---
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
      Gender_ID: record.Gender_ID ?? record.Gender?.Gender_ID,
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
      Gender_ID: values.Gender_ID,
      Email: values.Email,
      Address: values.Address,
      FirstName: values.FirstName,
      LastName: values.LastName,
      Status: values.Status,
    };

    try {
      if (editing?.StaffID) {
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

  // --- Table columns (อ่านง่าย + ตัดคำ + sticky header) ---
  const columns = [
    {
      title: "#",
      key: "index",
      width: 60,
      align: "center" as const,
      render: (_: any, _r: Staff, index: number) => (
        <Text type="secondary">{index + 1}</Text>
      ),
    },
    {
      title: "รหัส",
      dataIndex: "StaffID",
      width: 90,
      align: "center" as const,
      render: (id: number) => (
        <Tag color="blue" style={{ margin: 0, fontWeight: 600 }}>
          {id}
        </Tag>
      ),
    },
    {
      title: "ชื่อ - นามสกุล",
      key: "name",
      width: 220,
      ellipsis: true,
      render: (_: any, r: Staff) => (
        <Text strong ellipsis={{ tooltip: `${r.FirstName} ${r.LastName}` }}>
          {r.FirstName} {r.LastName}
        </Text>
      ),
    },
    {
      title: "อายุ",
      key: "age",
      width: 80,
      align: "center" as const,
      render: (_: any, r: Staff) => <Text>{calcAge(r.Birthday)}</Text>,
    },
    {
      title: "วันเกิด",
      dataIndex: "Birthday",
      width: 120,
      align: "center" as const,
      render: (d: string) => (
        <Text>
          <CalendarOutlined style={{ color: "#8c8c8c", marginRight: 6 }} />
          {dayjs(d).format("DD/MM/YY")}
        </Text>
      ),
    },
    {
      title: "สถานะ",
      dataIndex: "Status",
      width: 120,
      align: "center" as const,
      render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: "อีเมล",
      dataIndex: "Email",
      width: 240,
      ellipsis: true,
      render: (email: string) => (
        <Text ellipsis={{ tooltip: email || "-" }}>{email || "-"}</Text>
      ),
    },
    {
      title: "ที่อยู่",
      dataIndex: "Address",
      width: 260,
      ellipsis: true,
      render: (address: string) => (
        <Space size={6}>
          <EnvironmentOutlined style={{ color: "#8c8c8c" }} />
          <Text ellipsis={{ tooltip: address || "-" }} style={{ maxWidth: 200 }}>
            {address || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 150,
      fixed: "right" as const,
      align: "center" as const,
      render: (_: any, record: Staff) => (
        <Space size="small" wrap>
          <Button
            icon={<EditOutlined />}
            size="small"
            type="primary"
            ghost
            onClick={() => openEdit(record)}
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
            <Button icon={<DeleteOutlined />} size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const totalActive = useMemo(
    () => staffs.filter((s) => s.Status === "ทำงานอยู่").length,
    [staffs]
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <Space size="small" align="center">
          <Title level={3} style={{ margin: 0, color: "#1677ff" }}>
            <UserOutlined style={{ marginRight: 8 }} />
            จัดการเจ้าหน้าที่
          </Title>
          <Badge
            count={staffs.length}
            style={{ backgroundColor: "#1677ff" }}
            title="จำนวนทั้งหมด"
          />
          <Badge
            count={totalActive}
            style={{ backgroundColor: "#52c41a" }}
            title="ทำงานอยู่"
          />
        </Space>
      </div>

      {/* Toolbar */}
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} md={10}>
            <Input
              placeholder="ค้นหา: รหัส / ชื่อ-สกุล / Email"
              allowClear
              size="large"
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={() => {}}
            />
          </Col>
          <Col xs={24} md={5}>
            <Select
              allowClear
              size="large"
              placeholder="กรองตามเพศ"
              style={{ width: "100%" }}
              value={filterGender}
              onChange={setFilterGender}
              suffixIcon={<FilterOutlined />}
            >
              {genders.map((g) => (
                <Option key={g.Gender_ID} value={g.Gender_ID}>
                  {g.Gender}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={5}>
            <Select
              allowClear
              size="large"
              placeholder="กรองตามสถานะ"
              style={{ width: "100%" }}
              value={filterStatus}
              onChange={setFilterStatus}
              suffixIcon={<FilterOutlined />}
            >
              <Option value="ทำงานอยู่">ทำงานอยู่</Option>
              <Option value="ไม่ได้ทำงาน">ไม่ได้ทำงาน</Option>
            </Select>
          </Col>
          <Col xs={24} md={4}>
            <Space.Compact style={{ width: "100%" }}>
              <Button
                icon={<ReloadOutlined />}
                onClick={resetFilters}
                size="large"
              >
                ล้างตัวกรอง
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAdd}
                size="large"
              >
                เพิ่ม
              </Button>
            </Space.Compact>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table
          rowKey={(r) => String(r.StaffID ?? Math.random())}
          columns={columns}
          dataSource={filtered}
          loading={tableLoading}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="ไม่พบข้อมูล"
              />
            ),
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `แสดง ${range[0]}-${range[1]} จาก ${total} รายการ`,
            pageSizeOptions: ["5", "10", "20", "50"],
          }}
          bordered
          sticky
          size="middle"
          scroll={{ x: 1100, y: 520 }}
          style={{ fontSize: 14 }}
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
        width={760}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark="optional"
        >
          <Divider orientation="left">ข้อมูลส่วนตัว</Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="ชื่อ"
                name="FirstName"
                rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
              >
                <Input size="large" placeholder="เช่น สมชาย" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="นามสกุล"
                name="LastName"
                rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}
              >
                <Input size="large" placeholder="เช่น ใจดี" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="เพศ"
                name="Gender_ID"
                rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}
                tooltip="ใช้เพื่อการจัดสรรงาน/สถิติ"
              >
                <Select placeholder="เลือกเพศ" size="large" allowClear>
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
                tooltip="ใช้คำนวณอายุโดยอัตโนมัติ"
              >
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD/MM/YYYY"
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">ข้อมูลการทำงาน</Divider>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="สถานะ"
                name="Status"
                rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}
              >
                <Select size="large" placeholder="เลือกสถานะ" allowClear>
                  <Option value="ทำงานอยู่">ทำงานอยู่</Option>
                  <Option value="ไม่ได้ทำงาน">ไม่ได้ทำงาน</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">ข้อมูลติดต่อ</Divider>
          <Row gutter={16}>
            <Col xs={24}>
              <Form.Item label="อีเมล" name="Email">
                <Input size="large" type="email" placeholder="name@example.com" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item label="ที่อยู่" name="Address">
                <Input.TextArea rows={3} size="large" placeholder="รายละเอียดที่อยู่" />
              </Form.Item>
            </Col>
          </Row>

          <div
            style={{
              textAlign: "right",
              borderTop: "1px solid #f0f0f0",
              paddingTop: 16,
            }}
          >
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
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                style={{ fontWeight: 600 }}
              >
                {editing ? "บันทึกการแก้ไข" : "เพิ่มเจ้าหน้าที่"}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
