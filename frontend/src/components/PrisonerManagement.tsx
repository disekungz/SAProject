/* eslint-disable @typescript-eslint/no-explicit-any */
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
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import "dayjs/locale/th"; // For Thai locale if needed

dayjs.locale("th");

const { Title } = Typography;
const { Option } = Select;

// --- Interfaces ---
interface Gender {
  Gender_ID: number;
  Gender: string;
}

interface Room {
  Room_ID: number;
  Room_Name: string;
  Room_Status: string;
}

interface Work {
  Work_ID: number;
  Work_Name: string;
}

interface Prisoner {
  Prisoner_ID: number; // PK (ตัวเลข)
  Inmate_ID: string; // ID ที่แสดงผล (P-XXXX)
  Citizen_ID: string;
  Case_ID: string;
  FirstName: string;
  LastName: string;
  Birthday: string | Dayjs;
  EntryDate: string | Dayjs;
  ReleaseDate: string | Dayjs | null;
  Gender_ID?: number;
  Gender?: Gender;
  Room_ID?: number | null;
  Room?: Room;
  Work_ID?: number;
  Work?: Work;
}

const API_URL = "http://localhost:8088/api";

export default function PrisonerManagement() {
  const [form] = Form.useForm<Prisoner>();
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [filtered, setFiltered] = useState<Prisoner[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Prisoner | null>(null);
  const [tableLoading, setTableLoading] = useState(false);

  // State สำหรับเก็บค่าเพศที่ถูกเลือกในฟอร์ม
  const [selectedGenderId, setSelectedGenderId] = useState<number | null>(null);

  // --- Fetch Data ---
  const fetchData = async () => {
    setTableLoading(true);
    try {
      const [prisonersRes, gendersRes, roomsRes, worksRes] = await Promise.all([
        axios.get(`${API_URL}/prisoners`),
        axios.get(`${API_URL}/genders`),
        axios.get(`${API_URL}/rooms`),
        axios.get(`${API_URL}/works`),
      ]);
      setPrisoners(prisonersRes.data || []);
      setFiltered(prisonersRes.data || []);
      setGenders(gendersRes.data || []);
      setRooms(roomsRes.data || []);
      setWorks(worksRes.data || []);
    } catch {
      message.error("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const lower = searchValue.toLowerCase();
    setFiltered(
      prisoners.filter(
        (p) =>
          p.Inmate_ID.toLowerCase().includes(lower) ||
          (p.Case_ID && p.Case_ID.toLowerCase().includes(lower)) ||
          (p.FirstName && p.FirstName.toLowerCase().includes(lower)) ||
          (p.LastName && p.LastName.toLowerCase().includes(lower)) ||
          (p.Citizen_ID && p.Citizen_ID.toLowerCase().includes(lower))
      )
    );
  }, [searchValue, prisoners]);

  // --- Modal & Form Handlers ---
  const openAdd = async () => {
    setEditing(null);
    setSelectedGenderId(null); // Reset เพศที่เลือก
    form.resetFields();
    try {
      const res = await axios.get(`${API_URL}/prisoners/next-inmate-id`);
      const nextId = res.data.inmate_id;
      form.setFieldsValue({ Inmate_ID: nextId });
      setModalOpen(true);
    } catch {
      message.error("ไม่สามารถสร้างหมายเลขนักโทษได้ โปรดลองอีกครั้ง");
    }
  };

  const openEdit = (record: Prisoner) => {
    setEditing(record);
    // Set เพศเริ่มต้นเมื่อเปิดฟอร์มแก้ไข
    setSelectedGenderId(record.Gender_ID || record.Gender?.Gender_ID || null);
    form.setFieldsValue({
      ...record,
      Birthday: dayjs(record.Birthday),
      EntryDate: dayjs(record.EntryDate),
      ReleaseDate: record.ReleaseDate ? dayjs(record.ReleaseDate) : null,
      Gender_ID: record.Gender_ID || record.Gender?.Gender_ID,
      Room_ID: record.Room_ID || record.Room?.Room_ID,
      Work_ID: record.Work_ID || record.Work?.Work_ID,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/prisoners/${id}`);
      message.success("ลบข้อมูลนักโทษสำเร็จ");
      fetchData();
    } catch (err: any) {
      message.error(
        `ลบข้อมูลไม่สำเร็จ: ${err.response?.data?.error || err.message}`
      );
    }
  };

  const onFinish = async (values: any) => {
    const transformedPayload = {
      ...values,
      Birthday: dayjs(values.Birthday).format("YYYY-MM-DD"),
      EntryDate: dayjs(values.EntryDate).format("YYYY-MM-DD"),
      ReleaseDate: values.ReleaseDate
        ? dayjs(values.ReleaseDate).format("YYYY-MM-DD")
        : null,
    };

    try {
      if (editing) {
        delete transformedPayload.Inmate_ID;
        await axios.put(
          `${API_URL}/prisoners/${editing.Prisoner_ID}`,
          transformedPayload
        );
        message.success("แก้ไขข้อมูลสำเร็จ");
      } else {
        await axios.post(`${API_URL}/prisoners`, transformedPayload);
        message.success("เพิ่มข้อมูลนักโทษสำเร็จ");
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      message.error(
        `บันทึกข้อมูลไม่สำเร็จ: ${err.response?.data?.error || err.message}`
      );
    }
  };

  // --- Table Columns ---
  const columns = [
    { title: "หมายเลขนักโทษ", dataIndex: "Inmate_ID", width: 150 },
    { title: "เลขบัตรประชาชน", dataIndex: "Citizen_ID" },
    { title: "หมายเลขคดี", dataIndex: "Case_ID" },
    {
      title: "ชื่อ-นามสกุล",
      render: (_: any, r: Prisoner) => `${r.FirstName} ${r.LastName}`,
    },
    {
      title: "เพศ",
      render: (_: any, r: Prisoner) =>
        r.Gender?.Gender ||
        genders.find((g) => g.Gender_ID === r.Gender_ID)?.Gender ||
        "-",
    },
    {
      title: "วันที่เข้า",
      dataIndex: "EntryDate",
      render: (d: string) => dayjs(d).format("DD/MM/YYYY"),
    },
    {
      title: "วันพ้นโทษ",
      dataIndex: "ReleaseDate",
      render: (d: string | null) => (d ? dayjs(d).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "สถานะ",
      dataIndex: "ReleaseDate",
      key: "status",
      render: (releaseDate: string | null) => {
        // เงื่อนไขที่ 1: ไม่มีวันปล่อยตัว
        if (!releaseDate) {
          return <Tag color="red">คุมขังอยู่</Tag>;
        }

        // เงื่อนไขที่ 2: มีวันปล่อยตัว แต่วันนั้นเป็นวันในอนาคต
        // .isAfter(dayjs()) จะคืนค่า true ถ้า releaseDate อยู่หลังวันปัจจุบัน
        if (dayjs(releaseDate).isAfter(dayjs())) {
          return <Tag color="red">คุมขังอยู่</Tag>;
        }

        // เงื่อนไขที่ 3: มีวันปล่อยตัว และเป็นวันปัจจุบันหรืออดีต
        return <Tag color="green">ปล่อยตัวแล้ว</Tag>;
      },
    },
    {
      title: "จัดการ",
      key: "actions",
      render: (_: any, record: Prisoner) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEdit(record)}
          >
            แก้ไข
          </Button>
          <Popconfirm
            title="แน่ใจหรือไม่ว่าจะลบ?"
            onConfirm={() => handleDelete(record.Prisoner_ID)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // --- ตัวแปรสำหรับกรองห้องที่ว่างและตรงตามเพศ ---
  const availableRooms = rooms.filter((room) => {
    // เงื่อนไข 1: ถ้าเป็นการแก้ไข ให้แสดงห้องปัจจุบันของนักโทษด้วยเสมอ
    if (editing && room.Room_ID === editing.Room_ID) {
      return true;
    }

    // เงื่อนไข 2: ห้องต้องมีสถานะเป็น "ว่าง"
    if (room.Room_Status !== "ว่าง") {
      return false;
    }

    // เงื่อนไข 3: กรองตามเพศที่เลือก
    if (selectedGenderId) {
      // *** สำคัญ: ปรับ ID ของเพศให้ตรงกับข้อมูลในฐานข้อมูลของคุณ ***
      const isMaleSelected = selectedGenderId === 1; // <--- ปรับ ID ของเพศชาย
      const isFemaleSelected = selectedGenderId === 2; // <--- ปรับ ID ของเพศหญิง

      if (isMaleSelected && room.Room_Name.startsWith("M")) {
        return true;
      }
      if (isFemaleSelected && room.Room_Name.startsWith("F")) {
        return true;
      }
      return false; // ถ้าเลือกเพศแล้ว แต่ห้องไม่ตรงประเภท ก็ไม่ต้องแสดง
    }

    // ถ้ายังไม่เลือกเพศ ก็ไม่ต้องแสดงห้องใดๆ (ยกเว้นห้องปัจจุบันตอนแก้ไข)
    return false;
  });

  // --- ฟังก์ชันสำหรับ Handle การเปลี่ยนแปลงในฟอร์ม ---
  const handleFormValuesChange = (changedValues: any) => {
    // ถ้ามีการเปลี่ยนเพศ
    if (changedValues.Gender_ID) {
      const newGenderId = changedValues.Gender_ID;
      setSelectedGenderId(newGenderId);

      // ตรวจสอบว่าห้องที่เลือกไว้ยังใช้ได้กับเพศใหม่หรือไม่
      const currentRoomId = form.getFieldValue("Room_ID");
      if (currentRoomId) {
        const currentRoom = rooms.find((r) => r.Room_ID === currentRoomId);
        if (currentRoom) {
          // *** สำคัญ: ปรับ ID ของเพศให้ตรงกับข้อมูลในฐานข้อมูลของคุณ ***
          const isMale = newGenderId === 1; // <--- ปรับ ID ของเพศชาย
          const roomIsForMale = currentRoom.Room_Name.startsWith("M");

          // ถ้าเพศกับห้องไม่ตรงกัน ให้ล้างค่าห้องที่เลือกไว้
          if ((isMale && !roomIsForMale) || (!isMale && roomIsForMale)) {
            form.setFieldsValue({ Room_ID: null });
          }
        }
      }
    }
  };

  return (
    <div style={{ maxWidth: 1250, margin: "0 auto", padding: "16px 0" }}>
      <Title level={2}>จัดการข้อมูลนักโทษ</Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} justify="space-between">
          <Col xs={24} sm={12}>
            <Input
              placeholder="ค้นหาโดยหมายเลขนักโทษ, คดี, หรือชื่อ"
              allowClear
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              เพิ่มข้อมูลนักโทษ
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered.map((d) => ({ ...d, key: d.Prisoner_ID }))}
          loading={tableLoading}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>

      <Modal
        title={editing ? "แก้ไขข้อมูลนักโทษ" : "เพิ่มข้อมูลนักโทษ"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={handleFormValuesChange} // เพิ่ม prop นี้เพื่อตรวจจับการเปลี่ยนแปลง
        >
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="หมายเลขนักโทษ" name="Inmate_ID">
                <Input disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="หมายเลขคดี (Case ID)"
                name="Case_ID"
                rules={[{ required: true, message: "กรุณากรอกหมายเลขคดี" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="ชื่อ"
                name="FirstName"
                rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="นามสกุล"
                name="LastName"
                rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="เลขบัตรประชาชน"
                name="Citizen_ID"
                rules={[
                  { required: true, message: "กรุณากรอกเลขบัตรประชาชน" },
                  { len: 13, message: "เลขบัตรประชาชนต้องมี 13 หลัก" },
                ]}
              >
                <Input maxLength={13} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="เพศ"
                name="Gender_ID"
                rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}
              >
                <Select placeholder="เลือกเพศ">
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
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="วันที่เข้า"
                name="EntryDate"
                rules={[{ required: true, message: "กรุณาเลือกวันที่เข้า" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="วันพ้นโทษ" name="ReleaseDate">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="ห้องขัง"
                name="Room_ID"
                rules={[{ required: true, message: "กรุณาเลือกห้องขัง" }]}
              >
                <Select
                  placeholder="กรุณาเลือกเพศก่อน"
                  disabled={!selectedGenderId}
                >
                  {availableRooms.map((r) => (
                    <Option key={r.Room_ID} value={r.Room_ID}>
                      {r.Room_Status === "ว่าง"
                        ? r.Room_Name
                        : `${r.Room_Name} (${r.Room_Status})`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="งาน"
                name="Work_ID"
                rules={[{ required: true, message: "กรุณาเลือกงาน" }]}
              >
                <Select placeholder="เลือกงาน">
                  {works.map((w) => (
                    <Option key={w.Work_ID} value={w.Work_ID}>
                      {w.Work_Name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>ยกเลิก</Button>
              <Button type="primary" htmlType="submit">
                {editing ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
