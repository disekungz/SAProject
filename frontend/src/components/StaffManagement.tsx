import { useState, useEffect } from "react";
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
  Avatar,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  MailOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";

const { Title } = Typography;
const { Option } = Select;

interface Gender {
  Gender_ID: number;
  Gender: string;
}

interface Rank {
  RankID: number;
  RankName: string;
}

interface Staff {
  StaffID?: number;
  Email?: string;
  Username: string;
  Password?: string;
  FirstName: string;
  LastName: string;
  Birthday: string | Dayjs;
  Status: string;
  Address: string;
  Gender_ID?: number;
  Gender?: Gender;
  RankID?: number;
  Rank?: Rank;
}

// สุ่ม StaffID 3 หลัก (int)
const generateStaffID = () => Math.floor(100 + Math.random() * 900);

const calculateAge = (birthday: string | Dayjs) => {
  const birth = dayjs(birthday);
  const today = dayjs();
  return today.diff(birth, "year");
};

// ฟังก์ชันสำหรับแสดงสีของ Status
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

// ฟังก์ชันสำหรับแสดงสี Avatar ตามเพศ
const getGenderColor = (gender: string) => {
  switch (gender) {
    case "ชาย":
      return "#1890ff";
    case "หญิง":
      return "#ff69b4";
    default:
      return "#87d068";
  }
};

export default function StaffManagement() {
  const [form] = Form.useForm<Staff>();
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [filtered, setFiltered] = useState<Staff[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [searchValue, setSearchValue] = useState("");
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

  // --- Fetch Ranks
  const fetchRanks = async () => {
    try {
      const res = await axios.get("http://localhost:8088/api/ranks");
      setRanks(res.data);
    } catch {
      message.error("โหลดข้อมูลตำแหน่งไม่สำเร็จ");
    }
  };

  useEffect(() => {
    fetchStaffs();
    fetchGenders();
    fetchRanks();
  }, []);

  useEffect(() => {
    applyFilter(searchValue);
  }, [staffs, searchValue]);

  const applyFilter = (q: string) => {
    if (!q) return setFiltered(staffs);
    const lower = q.toLowerCase();
    setFiltered(
      staffs.filter(
        (s) =>
          (s.FirstName && s.FirstName.toLowerCase().includes(lower)) ||
          (s.LastName && s.LastName.toLowerCase().includes(lower)) ||
          (s.StaffID && s.StaffID.toString().includes(lower)) ||
          (s.Username && s.Username.toLowerCase().includes(lower)) ||
          (s.Email && s.Email.toLowerCase().includes(lower))
      )
    );
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
      RankID: record.RankID || record.Rank?.RankID,
    });
    form.setFieldsValue({ Password: "" });
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
    if (editing && !values.Password) {
      delete values.Password;
    }

    const payload = {
      ...values,
      Birthday: values.Birthday ? values.Birthday.toISOString() : null,
      StaffID: editing?.StaffID || generateStaffID(),
      Gender_ID: values.Gender_ID,
      RankID: values.RankID,
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

  // --- ปรับปรุง Table columns ให้อ่านง่ายขึ้น ---
  const columns = [
    {
      title: "#",
      key: "index",
      width: 50,
      align: "center" as const,
      render: (_: any, _r: Staff, index: number) => (
        <span style={{ color: "#666" }}>{index + 1}</span>
      ),
    },
    {
      title: "รหัส",
      dataIndex: "StaffID",
      width: 80,
      align: "center" as const,
      render: (id: number) => (
        <Tag color="blue" style={{ margin: 0, fontWeight: "bold" }}>
          {id}
        </Tag>
      ),
    },
    {
      title: "ข้อมูลส่วนตัว",
      key: "personal",
      width: 220,
      render: (_: any, r: Staff) => {
        const genderName =
          r.Gender?.Gender ||
          genders.find((g) => g.Gender_ID === r.Gender_ID)?.Gender ||
          "-";
        const age = calculateAge(r.Birthday);

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar
              icon={<UserOutlined />}
              style={{
                backgroundColor: getGenderColor(genderName),
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "14px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.FirstName} {r.LastName}
              </div>
              <div
                style={{
                  color: "#666",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <span>{genderName}</span>
                <span>•</span>
                <span>{age} ปี</span>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "ตำแหน่ง & สถานะ",
      key: "position_status",
      width: 160,
      render: (_: any, r: Staff) => {
        const rankName =
          r.Rank?.RankName ||
          ranks.find((rank) => rank.RankID === r.RankID)?.RankName ||
          "-";

        return (
          <div>
            <div
              style={{
                fontWeight: "bold",
                color: "#1890ff",
                marginBottom: 4,
              }}
            >
              {rankName}
            </div>
            <Tag color={getStatusColor(r.Status)}>{r.Status}</Tag>
          </div>
        );
      },
    },
    {
      title: "ข้อมูลติดต่อ",
      key: "contact",
      width: 200,
      render: (_: any, r: Staff) => (
        <div style={{ fontSize: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <UserOutlined style={{ color: "#666" }} />
            <span style={{ fontWeight: "bold" }}>{r.Username}</span>
          </div>
          {r.Email && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "#666",
              }}
            >
              <MailOutlined />
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {r.Email}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "วันเกิด",
      dataIndex: "Birthday",
      width: 100,
      align: "center" as const,
      render: (d: string) => (
        <div style={{ fontSize: "12px", textAlign: "center" }}>
          <CalendarOutlined style={{ color: "#666", marginRight: 4 }} />
          {dayjs(d).format("DD/MM/YY")}
        </div>
      ),
    },
    {
      title: "ที่อยู่",
      dataIndex: "Address",
      width: 150,
      render: (address: string) => (
        <div
          style={{
            fontSize: "12px",
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <EnvironmentOutlined
            style={{ color: "#666", marginTop: 2, flexShrink: 0 }}
          />
          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {address || "-"}
          </span>
        </div>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 140,
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
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              style={{ minWidth: 50 }}
            >
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1500, margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
          <UserOutlined style={{ marginRight: 12 }} />
          จัดการเจ้าหน้าที่
        </Title>
        <p style={{ color: "#666", margin: "8px 0 0 0" }}>
          ระบบจัดการข้อมูลเจ้าหน้าที่ในองค์กร
        </p>
      </div>

      <Card style={{ marginBottom: 24 }} bodyStyle={{ padding: "16px 24px" }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={16} md={18}>
            <Input
              placeholder="ค้นหาด้วย รหัส, ชื่อ-นามสกุล, Username หรือ Email"
              allowClear
              size="large"
              prefix={<SearchOutlined style={{ color: "#1890ff" }} />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onPressEnter={() => applyFilter(searchValue)}
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} sm={8} md={6}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openAdd}
              size="large"
              block
              style={{ borderRadius: 8, fontWeight: "bold" }}
            >
              เพิ่มเจ้าหน้าที่ใหม่
            </Button>
          </Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filtered.map((d, index) => ({ ...d, key: index }))}
          loading={tableLoading}
          pagination={{
            pageSize: 8,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `แสดง ${range[0]}-${range[1]} จาก ${total} รายการ`,
            pageSizeOptions: ["5", "8", "10", "20"],
          }}
          bordered
          scroll={{ x: 1400 }}
          size="small"
          style={{
            fontSize: "14px",
          }}
          rowClassName={(_, index) => (index % 2 === 0 ? "" : "")}
        />
      </Card>

      <Modal
        title={
          <div
            style={{ fontSize: "18px", fontWeight: "bold", color: "#1890ff" }}
          >
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
        width={800}
        centered
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ color: "#666", marginBottom: 16 }}>
              ข้อมูลส่วนตัว
            </Title>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="ชื่อ"
                  name="FirstName"
                  rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
                >
                  <Input size="large" />
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
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ color: "#666", marginBottom: 16 }}>
              ข้อมูลการทำงาน
            </Title>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="ตำแหน่ง"
                  name="RankID"
                  rules={[{ required: true, message: "กรุณาเลือกตำแหน่ง" }]}
                >
                  <Select placeholder="เลือกตำแหน่ง" size="large">
                    {ranks.map((r) => (
                      <Option key={r.RankID} value={r.RankID}>
                        {r.RankName}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
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
          </div>

          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ color: "#666", marginBottom: 16 }}>
              ข้อมูลบัญชีผู้ใช้
            </Title>
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Username"
                  name="Username"
                  rules={[{ required: true, message: "กรุณากรอก Username" }]}
                >
                  <Input size="large" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Password"
                  name="Password"
                  rules={[
                    { required: !editing, message: "กรุณากรอก Password" },
                  ]}
                  help={
                    editing ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยนรหัสผ่าน" : ""
                  }
                >
                  <Input.Password size="large" />
                </Form.Item>
              </Col>
              <Col xs={24}>
                <Form.Item label="อีเมล" name="Email">
                  <Input size="large" type="email" />
                </Form.Item>
              </Col>
            </Row>
          </div>

          <div style={{ marginBottom: 24 }}>
            <Title level={5} style={{ color: "#666", marginBottom: 16 }}>
              ข้อมูลติดต่อ
            </Title>
            <Col xs={24}>
              <Form.Item label="ที่อยู่" name="Address">
                <Input.TextArea rows={3} size="large" />
              </Form.Item>
            </Col>
          </div>

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
                style={{ fontWeight: "bold" }}
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
