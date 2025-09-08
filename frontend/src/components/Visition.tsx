import { useEffect, useMemo, useState } from "react";
import {
  Input,
  Button,
  Card,
  Form,
  DatePicker,
  Typography,
  Row,
  Space,
  Table,
  Modal,
  Popconfirm,
  Select,
  message,
  Col,
  AutoComplete,
  Tag,
  Avatar,
} from "antd";
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import { getUser } from "../lib/auth"; // Import getUser function

const { Title, Text } = Typography;
const { Option } = Select;

// Base API URL
const api = axios.create({
  baseURL: "http://localhost:8088",
});

// --- Interfaces ---
type ID = number;

interface Inmate {
  Prisoner_ID: ID;
  FirstName: string;
  LastName: string;
}

interface Staff {
  StaffID: ID;
  FirstName: string;
  LastName: string;
}

interface Status {
  Status_ID: ID;
  Status: string;
}

interface Petition {
  ID: ID;
  Detail: string;
  Date_created: string;
  Inmate_ID: number;
  Staff_ID: number;
  Status_ID: number;
  Inmate?: Inmate;
  Staff?: Staff;
  Status?: Status;
}

interface PetitionForm {
  ID?: number;
  Detail: string;
  Date_created: Dayjs | null;
  Inmate_ID: number | undefined;
  Inmate_Input?: string;
  Staff_ID: number | undefined;
  Status_ID: number | undefined;
}

export default function Petition() {
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [form] = Form.useForm<PetitionForm>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPetition, setEditingPetition] = useState<Petition | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [filteredPetitions, setFilteredPetitions] = useState<Petition[]>([]);
  const [inmateOptions, setInmateOptions] = useState<{ value: string; label: string; key: number }[]>([]);

  // Get user role from the actual login system
  const currentUser = getUser();
  const userRole = currentUser?.rankId === 3 ? 'guard' : 'admin';

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [inmateRes, staffRes, statusRes, petitionRes] = await Promise.all([
        api.get("/api/prisoners"),
        api.get("/api/staffs"),
        api.get("/api/statuses"),
        api.get("/api/petitions"),
      ]);

      const inmateData: Inmate[] = inmateRes.data || [];
      const staffData: Staff[] = staffRes.data || [];
      const statusData: Status[] = statusRes.data || [];
      const petitionData: Petition[] = petitionRes.data || [];

      const merged = petitionData.map((p) => ({
        ...p,
        Inmate: inmateData.find(i => i.Prisoner_ID === p.Inmate_ID),
        Staff: staffData.find(s => s.StaffID === p.Staff_ID),
        Status: statusData.find(st => st.Status_ID === p.Status_ID),
      }));

      setInmates(inmateData);
      setStaffs(staffData);
      setStatuses(statusData);
      setPetitions(merged);
    } catch (error) {
      message.error("ไม่สามารถดึงข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Filtering based on search and user role ---
  useEffect(() => {
    let roleFilteredData = petitions;
    if (userRole === 'guard') {
      const pendingStatusId = statuses.find(s => s.Status === 'รอดำเนินการ')?.Status_ID;
      roleFilteredData = petitions.filter(p => p.Status_ID === pendingStatusId);
    }

    const lowercasedValue = searchValue.toLowerCase().trim();
    if (!lowercasedValue) {
      setFilteredPetitions(roleFilteredData);
    } else {
      const searchFilteredData = roleFilteredData.filter(item => {
        const inmateName = `${item.Inmate?.FirstName || ''} ${item.Inmate?.LastName || ''}`.toLowerCase();
        const staffName = `${item.Staff?.FirstName || ''} ${item.Staff?.LastName || ''}`.toLowerCase();
        const detail = item.Detail?.toLowerCase() || '';
        return inmateName.includes(lowercasedValue) || staffName.includes(lowercasedValue) || detail.includes(lowercasedValue);
      });
      setFilteredPetitions(searchFilteredData);
    }
  }, [searchValue, petitions, userRole, statuses]);

  // --- Tag Renderers ---
  const getStatusTag = (statusName?: string) => {
    switch (statusName) {
      case 'อนุมัติ': return <Tag color="success" icon={<CheckCircleOutlined />}>อนุมัติ</Tag>;
      case 'ปฏิเสธ': case 'ไม่อนุมัติ': return <Tag color="error" icon={<CloseCircleOutlined />}>ปฏิเสธ</Tag>;
      case 'รอดำเนินการ': return <Tag color="processing" icon={<ClockCircleOutlined />}>รอดำเนินการ</Tag>;
      default: return <Tag icon={<ExclamationCircleOutlined />}>{statusName || 'ไม่ระบุ'}</Tag>;
    }
  };

  // --- Modal & Form Handlers ---
  const openAdd = () => {
    setEditingPetition(null);
    form.resetFields();

    // Set default status for guards
    if (userRole === 'guard') {
      const pendingStatus = statuses.find(st => st.Status === "รอดำเนินการ")?.Status_ID;
      form.setFieldsValue({ Status_ID: pendingStatus });
    }

    setOpen(true);
  };

  const openEdit = (record: Petition) => {
    setEditingPetition(record);
    const inmateText = record.Inmate ? `${record.Inmate.FirstName} ${record.Inmate.LastName}` : '';
    form.setFieldsValue({
      ...record,
      Date_created: record.Date_created ? dayjs(record.Date_created) : null,
      Inmate_Input: inmateText,
    });
    setOpen(true);
  };

  const onFinish = async (values: PetitionForm) => {
    setLoading(true);
    try {
      const payload = {
        ...values,
        Date_created: values.Date_created?.toISOString(),
      };
      delete (payload as any).Inmate_Input;

      // Force 'Pending' status if user is a guard
      if (userRole === 'guard') {
        const pendingStatusId = statuses.find(s => s.Status === 'รอดำเนินการ')?.Status_ID;
        payload.Status_ID = pendingStatusId;
      }

      if (editingPetition) {
        await api.put(`/api/petitions/${editingPetition.ID}`, payload);
        message.success("แก้ไขคำร้องสำเร็จ");
      } else {
        await api.post("/api/petitions", payload);
        message.success("เพิ่มคำร้องสำเร็จ");
      }
      setOpen(false);
      fetchData();
    } catch (error) {
      message.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/petitions/${id}`);
      message.success("ลบคำร้องสำเร็จ");
      fetchData();
    } catch (error) {
      message.error("เกิดข้อผิดพลาดในการลบคำร้อง");
    }
  };

  // --- Autocomplete Handlers ---
  const handleInmateSearch = (searchText: string) => {
    if (!searchText) {
      setInmateOptions([]);
    } else {
      const filtered = inmates.filter(p =>
        `${p.FirstName} ${p.LastName}`.toLowerCase().includes(searchText.toLowerCase())
      );
      setInmateOptions(filtered.map(p => ({
        value: `${p.FirstName} ${p.LastName}`,
        label: `${p.FirstName} ${p.LastName}`,
        key: p.Prisoner_ID,
      })));
    }
  };

  const onInmateSelect = (_: string, option: { key: number }) => {
    form.setFieldsValue({ Inmate_ID: option.key });
  };

  const onInmateChange = (data: string) => {
    if (!data) {
      form.setFieldsValue({ Inmate_ID: undefined });
    }
  };

  // --- Table Columns ---
  const columns = useMemo((): ColumnsType<Petition> => {
    const baseColumns: ColumnsType<Petition> = [
      { title: "ลำดับ", key: "index", render: (_, __, index) => index + 1, width: 70, align: 'center' },
      { title: "ผู้ยื่นคำร้อง", render: (record) => <Space><Avatar icon={<UserOutlined />} /><span>{record.Inmate ? `${record.Inmate.FirstName} ${record.Inmate.LastName}` : '-'}</span></Space> },
      { title: "สถานะ", render: (record) => getStatusTag(record.Status?.Status) },
      { title: "รายละเอียด", dataIndex: "Detail", ellipsis: true },
      { title: "วันที่ยื่น", dataIndex: "Date_created", render: (date: string) => (date ? dayjs(date).format("DD/MM/YYYY") : '-') },
      { title: "เจ้าหน้าที่ผู้รับเรื่อง", render: (record) => <span>{record.Staff ? `${record.Staff.FirstName} ${record.Staff.LastName}` : '-'}</span> },
    ];

    if (userRole === 'admin') {
      baseColumns.push({
        title: "การจัดการ", key: "action", render: (record) => (
          <Space>
            <Button type="primary" ghost icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>แก้ไข</Button>
            <Popconfirm title="ยืนยันการลบ?" description="คุณต้องการลบคำร้องนี้ใช่หรือไม่?" onConfirm={() => handleDelete(record.ID)} okText="ยืนยัน" cancelText="ยกเลิก">
              <Button icon={<DeleteOutlined />} size="small" danger>ลบ</Button>
            </Popconfirm>
          </Space>
        )
      });
    }

    return baseColumns;
  }, [inmates, staffs, statuses, userRole]);

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      <Title level={2} style={{ color: "#1890ff" }}><FileTextOutlined /> ระบบยื่นคำร้องทั่วไป</Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} align="middle">
          <Col xs={12} md={12}>
            <Input
              placeholder="ค้นหาจากชื่อผู้ร้อง, เจ้าหน้าที่, รายละเอียด..."
              prefix={<SearchOutlined />}
              allowClear
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
            />
          </Col>
          <Col xs={6} md={6}>
            {userRole === 'admin' && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} block>
                เพิ่มคำร้อง
              </Button>
            )}
          </Col>
          <Col xs={6} md={6} style={{ textAlign: 'right' }}>
            <Space>
              <Text strong>บทบาท:</Text>
              <Text>{userRole === 'admin' ? 'Admin' : 'Guard'}</Text>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filteredPetitions}
          rowKey="ID"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingPetition ? "แก้ไขคำร้อง" : "เพิ่มคำร้องใหม่"}
        open={open}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
          setEditingPetition(null);
        }}
        footer={null}
        destroyOnClose
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ Status_ID: statuses.find(st => st.Status === "รอดำเนินการ")?.Status_ID }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="ผู้ยื่นคำร้อง" name="Inmate_Input" rules={[{ required: true, message: "กรุณาเลือกผู้ยื่นคำร้อง" }]}>
                <AutoComplete
                  options={inmateOptions}
                  onSearch={handleInmateSearch}
                  onSelect={onInmateSelect}
                  onChange={onInmateChange}
                  placeholder="พิมพ์ชื่อผู้ต้องขังเพื่อค้นหา..."
                />
              </Form.Item>
              <Form.Item name="Inmate_ID" hidden>
                <Input />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item label="เจ้าหน้าที่ผู้รับเรื่อง" name="Staff_ID" rules={[{ required: true, message: "กรุณาเลือกเจ้าหน้าที่" }]}>
                <Select showSearch placeholder="เลือกเจ้าหน้าที่" optionFilterProp="children">
                  {staffs.map((s) => (
                    <Option key={s.StaffID} value={s.StaffID}>
                      {s.FirstName} {s.LastName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            
            <Col span={24}>
              <Form.Item label="รายละเอียดคำร้อง" name="Detail" rules={[{ required: true, message: "กรุณากรอกรายละเอียด" }]}>
                <Input.TextArea rows={4} placeholder="ระบุรายละเอียด..." />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="วันที่ยื่น" name="Date_created" rules={[{ required: true, message: "กรุณาเลือกวันที่" }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="สถานะ" name="Status_ID" rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}>
                <Select placeholder="เลือกสถานะ" disabled={userRole === 'guard'}>
                  {userRole === 'guard'
                    ? statuses.filter(st => st.Status === "รอดำเนินการ").map(st => (
                        <Option key={st.Status_ID} value={st.Status_ID}>
                          {st.Status}
                        </Option>
                      ))
                    : statuses.map(st => (
                        <Option key={st.Status_ID} value={st.Status_ID}>
                          {st.Status}
                        </Option>
                      ))
                  }
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Button onClick={() => setOpen(false)} style={{ marginRight: 8 }}>
              ยกเลิก
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              บันทึกข้อมูล
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
