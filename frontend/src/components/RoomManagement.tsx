/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import {
  Input,
  Button,
  Card,
  Form,
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

const { Title } = Typography;
const { Option } = Select;

// --- Interfaces ---
interface Room {
  Room_ID: number;
  Room_Name: string;
  Room_Status: string;
}

interface RoomFormValues {
  gender: "M" | "F";
  zone: string;
  number: string;
}

const API_URL = "http://localhost:8088/api";

export default function RoomManagement() {
  const [form] = Form.useForm<RoomFormValues>();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filteredRooms, setFilteredRooms] = useState<Room[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [tableLoading, setTableLoading] = useState(false);

  const fetchData = async () => {
    setTableLoading(true);
    try {
      const roomsRes = await axios.get(`${API_URL}/rooms`);
      const allRooms = roomsRes.data || [];
      setRooms(allRooms);
      setFilteredRooms(allRooms);
    } catch {
      message.error("โหลดข้อมูลห้องไม่สำเร็จ");
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const lower = searchValue.toLowerCase();
    setFilteredRooms(
      rooms.filter((r) => r.Room_Name.toLowerCase().includes(lower))
    );
  }, [searchValue, rooms]);

  const zones = Array.from(Array(26)).map((_, i) =>
    String.fromCharCode(i + 65)
  );

  const generateNextRoomNumber = (gender: "M" | "F", zone: string) => {
    const prefix = `${gender}${zone}-`;
    const relevantRooms = rooms.filter((r) => r.Room_Name.startsWith(prefix));
    if (relevantRooms.length === 0) return "001";
    const maxNum = relevantRooms.reduce((max, r) => {
      const numPart = parseInt(r.Room_Name.split("-")[1], 10);
      return numPart > max ? numPart : max;
    }, 0);
    return (maxNum + 1).toString().padStart(3, "0");
  };

  const openAdd = () => {
    setEditingRoom(null);
    form.resetFields();
    form.setFieldsValue({ gender: "M", zone: "A" });
    const nextNumber = generateNextRoomNumber("M", "A");
    form.setFieldsValue({ number: nextNumber });
    setModalOpen(true);
  };

  const openEdit = (record: Room) => {
    setEditingRoom(record);
    const gender = record.Room_Name[0] as "M" | "F";
    const zone = record.Room_Name[1];
    const number = record.Room_Name.split("-")[1];
    form.setFieldsValue({ gender, zone, number });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/rooms/${id}`);
      message.success("ลบข้อมูลห้องสำเร็จ");
      fetchData();
    } catch (err: any) {
      message.error(
        `ลบข้อมูลไม่สำเร็จ: ${err.response?.data?.error || err.message}`
      );
    }
  };

  const onFinish = async (values: RoomFormValues) => {
    const roomName = `${values.gender}${values.zone}-${values.number}`;
    try {
      if (editingRoom) {
        const payload = { Room_Name: roomName };
        await axios.put(`${API_URL}/rooms/${editingRoom.Room_ID}`, payload);
        message.success("แก้ไขข้อมูลห้องสำเร็จ");
      } else {
        const payload = { Room_Name: roomName };
        await axios.post(`${API_URL}/rooms`, payload);
        message.success("เพิ่มข้อมูลห้องสำเร็จ");
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      message.error(
        `บันทึกข้อมูลไม่สำเร็จ: ${err.response?.data?.error || err.message}`
      );
    }
  };

  const handleFormChange = () => {
    if (!editingRoom) {
      const { gender, zone } = form.getFieldsValue();
      if (gender && zone) {
        const nextNumber = generateNextRoomNumber(gender, zone);
        form.setFieldsValue({ number: nextNumber });
      }
    }
  };

  const columns = [
    {
      title: "ห้องขัง",
      dataIndex: "Room_Name",
      key: "Room_Name",
      sorter: (a: Room, b: Room) => a.Room_Name.localeCompare(b.Room_Name),
    },
    {
      title: "สถานะ",
      dataIndex: "Room_Status",
      key: "Room_Status",
      render: (status: string) => (
        <Tag color={status === "ว่าง" ? "blue" : "orange"}>{status}</Tag>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      render: (_: any, record: Room) => (
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
            onConfirm={() => handleDelete(record.Room_ID)}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "16px 0" }}>
      <Title level={2}>จัดการข้อมูลห้องขัง</Title>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} justify="space-between">
          <Col xs={24} sm={12}>
            <Input
              placeholder="ค้นหาชื่อห้องขัง..."
              allowClear
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              เพิ่มห้องขัง
            </Button>
          </Col>
        </Row>
      </Card>
      <Card>
        <Table
          columns={columns}
          dataSource={filteredRooms.map((r) => ({ ...r, key: r.Room_ID }))}
          loading={tableLoading}
          pagination={{ pageSize: 10 }}
          bordered
        />
      </Card>
      <Modal
        title={editingRoom ? "แก้ไขข้อมูลห้องขัง" : "เพิ่มข้อมูลห้องขัง"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onValuesChange={handleFormChange}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Room For Gender"
                name="gender"
                rules={[{ required: true, message: "กรุณาเลือกเพศ" }]}
              >
                <Select placeholder="เลือกเพศ">
                  <Option value="M">M (Male)</Option>
                  <Option value="F">F (Female)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Zone"
                name="zone"
                rules={[{ required: true, message: "กรุณาเลือกโซน" }]}
              >
                <Select placeholder="เลือกโซน">
                  {zones.map((z) => (
                    <Option key={z} value={z}>
                      {z}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Room Number" name="number">
                <Input disabled />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>ยกเลิก</Button>
              <Button type="primary" htmlType="submit">
                {editingRoom ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
