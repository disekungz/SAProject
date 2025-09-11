import { useState, useEffect } from "react";
import {
  Input,
  Button,
  Card,
  Form,
  DatePicker,
  Typography,
  Row,
  Col,
  Table,
  Space,
  Modal,
  Popconfirm,
  Select,
  AutoComplete,
  Tag,
  Layout,
  theme,
  notification,
} from "antd";
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";
import { getUser, getToken } from "../lib/auth";

const { Title } = Typography;
const { Option } = Select;
const { Header, Content } = Layout;

const API_URL = "http://localhost:8088/api";

// --- Interfaces ---
interface TimeSlot { ID: number; TimeSlot_Name: string; }
interface Inmate { Prisoner_ID: number; FirstName: string; LastName: string; }
interface Visitor { ID: number; FirstName: string; LastName: string; Citizen_ID: string; }
interface Staff { StaffID: number; FirstName: string; LastName: string; }
interface Status { Status_ID: number; Status: string; }
interface Relationship { ID: number; Relationship_name: string; }

interface Visitation {
  ID: number;
  Visit_Date: string;
  Inmate_ID: number;
  Visitor_ID: number;
  Staff_ID: number;
  Status_ID: number;
  Relationship_ID: number;
  TimeSlot_ID: number;
  Inmate?: Inmate;
  Visitor?: Visitor;
  Staff?: Staff;
  Status?: Status;
  Relationship?: Relationship;
  TimeSlot?: TimeSlot;
}

interface VisitationForm {
  ID?: number;
  Visit_Date: Dayjs | null;
  TimeSlot_ID: number | undefined;
  Inmate_ID: number | undefined;
  Inmate_Input?: string;
  VisitorFirstName?: string;
  VisitorLastName?: string;
  VisitorCitizenID?: string;
  Staff_ID: number | undefined;
  Status_ID: number | undefined;
  Relationship_ID: number | undefined;
}

export default function Visition() {
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();
  const [api, contextHolder] = notification.useNotification();

  const currentUser = getUser();
  const isVisitor = currentUser?.rankId === 3;

  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [prisoners, setPrisoners] = useState<Inmate[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [form] = Form.useForm<VisitationForm>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Visitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filteredVisitations, setFilteredVisitations] = useState<Visitation[]>([]);
  const [bookedSlots, setBookedSlots] = useState<number[]>([]);
  const [inmateOptions, setInmateOptions] = useState<{ value: string; label: string; key: number }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      
      const [vRes, pRes, sRes, stRes, rRes, tsRes] = await Promise.all([
        axios.get(`${API_URL}/visitations`, authHeader),
        axios.get(`${API_URL}/prisoners`, authHeader),
        axios.get(`${API_URL}/staffs`, authHeader),
        axios.get(`${API_URL}/statuses`, authHeader),
        axios.get(`${API_URL}/relationships`, authHeader),
        axios.get(`${API_URL}/timeslots`, authHeader),
      ]);

      const visitData: Visitation[] = vRes.data || [];
      const prisonerData: Inmate[] = pRes.data || [];
      const staffData: Staff[] = sRes.data || [];
      const statusData: Status[] = stRes.data || [];
      const relationshipData: Relationship[] = rRes.data || [];
      const timeSlotData: TimeSlot[] = tsRes.data || [];

      const merged = visitData.map(v => ({
        ...v,
        Inmate: prisonerData.find(p => p.Prisoner_ID === v.Inmate_ID),
        Staff: staffData.find(s => s.StaffID === v.Staff_ID),
        Status: statusData.find(st => st.Status_ID === v.Status_ID),
        Relationship: relationshipData.find(r => r.ID === v.Relationship_ID),
        TimeSlot: timeSlotData.find(ts => ts.ID === v.TimeSlot_ID),
      }));

      setVisitations(merged);
      setFilteredVisitations(merged);
      setPrisoners(prisonerData);
      setStaffs(staffData);
      setStatuses(statusData);
      setRelationships(relationshipData);
      setTimeSlots(timeSlotData);
    } catch (error) {
      console.error(error);
      api.error({ message: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลการเยี่ยมได้" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const lowercasedValue = searchValue.toLowerCase().trim();
    if (lowercasedValue === "") {
      setFilteredVisitations(visitations);
    } else {
      const filteredData = visitations.filter(item => {
        const inmateName = `${item.Inmate?.FirstName} ${item.Inmate?.LastName}`.toLowerCase();
        const visitorName = `${item.Visitor?.FirstName} ${item.Visitor?.LastName}`.toLowerCase();
        const staffName = `${item.Staff?.FirstName} ${item.Staff?.LastName}`.toLowerCase();

        return (
          inmateName.includes(lowercasedValue) ||
          visitorName.includes(lowercasedValue) ||
          staffName.includes(lowercasedValue)
        );
      });
      setFilteredVisitations(filteredData);
    }
  }, [searchValue, visitations]);

  const handleDateChange = (date: Dayjs | null) => {
    if (!date) {
      setBookedSlots([]);
      return;
    }
    const dateString = date.format("YYYY-MM-DD");
    const bookedForDate = visitations
      .filter(v => dayjs(v.Visit_Date).format("YYYY-MM-DD") === dateString)
      .filter(v => v.ID !== editing?.ID)
      .map(v => v.TimeSlot_ID);

    setBookedSlots(bookedForDate);

    const currentSelectedSlot = form.getFieldValue("TimeSlot_ID");
    if (bookedForDate.includes(currentSelectedSlot)) {
      form.setFieldsValue({ TimeSlot_ID: undefined });
    }
  };

  const openAdd = () => {
    form.resetFields();
    setEditing(null);
    setBookedSlots([]);
    if (isVisitor) {
      const pending = statuses.find(s => s.Status === "รอดำเนินการ" || s.Status === "รอ...");
      if (pending) form.setFieldsValue({ Status_ID: pending.Status_ID });
    }
    setOpen(true);
  };

  const openEdit = (record: Visitation) => {
    setEditing(record);
    const visitDate = dayjs(record.Visit_Date);
    const initialInmateText = record.Inmate ? `${record.Inmate.FirstName} ${record.Inmate.LastName}` : "";
    form.setFieldsValue({
      ...record,
      Visit_Date: visitDate,
      TimeSlot_ID: record.TimeSlot_ID,
      Inmate_ID: record.Inmate_ID,
      Inmate_Input: initialInmateText,
      VisitorFirstName: record.Visitor?.FirstName,
      VisitorLastName: record.Visitor?.LastName,
      VisitorCitizenID: record.Visitor?.Citizen_ID,
    });

    const dateString = visitDate.format("YYYY-MM-DD");
    const bookedForDate = visitations
      .filter(v => dayjs(v.Visit_Date).format("YYYY-MM-DD") === dateString)
      .filter(v => v.ID !== record.ID)
      .map(v => v.TimeSlot_ID);
    setBookedSlots(bookedForDate);
    setOpen(true);
  };

  const handleInmateSearch = (searchText: string) => {
    if (!searchText) {
      setInmateOptions([]);
    } else {
      const filtered = prisoners.filter(p =>
        `${p.FirstName} ${p.LastName}`.toLowerCase().includes(searchText.toLowerCase())
      );
      setInmateOptions(
        filtered.map(p => ({
          value: `${p.FirstName} ${p.LastName}`,
          label: `${p.FirstName} ${p.LastName}`,
          key: p.Prisoner_ID,
        }))
      );
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

  const onFinish = async (values: VisitationForm) => {
    setLoading(true);
    const token = getToken();
    try {
      if (isVisitor && !currentUser?.citizenId) {
        api.error({ message: "เกิดข้อผิดพลาด", description: "ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบอีกครั้ง" });
        setLoading(false);
        return;
      }

      const visitorData = isVisitor
        ? {
            VisitorFirstName: currentUser?.firstName,
            VisitorLastName: currentUser?.lastName,
            VisitorCitizenID: currentUser?.citizenId,
          }
        : {
            VisitorFirstName: values.VisitorFirstName,
            VisitorLastName: values.VisitorLastName,
            VisitorCitizenID: values.VisitorCitizenID,
          };

      const payload = {
        Visit_Date: values.Visit_Date?.format("YYYY-MM-DD"),
        TimeSlot_ID: values.TimeSlot_ID,
        Inmate_ID: values.Inmate_ID,
        Relationship_ID: values.Relationship_ID,
        Staff_ID: values.Staff_ID,
        Status_ID: values.Status_ID,
        ...visitorData
      };

      if (isVisitor) {
        const pending = statuses.find(s => s.Status === "รอดำเนินการ" || s.Status === "รอ...");
        if (pending) payload.Status_ID = pending.Status_ID;
      }
      
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };

      if (editing) {
        await axios.put(`${API_URL}/visitations/${editing.ID}`, payload, authHeader);
        api.success({ message: "สำเร็จ", description: "อัปเดตข้อมูลการเยี่ยมเรียบร้อยแล้ว" });
      } else {
        await axios.post(`${API_URL}/visitations`, payload, authHeader);
        api.success({ message: "สำเร็จ", description: "สร้างข้อมูลการเยี่ยมเรียบร้อยแล้ว" });
      }

      setOpen(false);
      form.resetFields();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.response?.data?.error || "เกิดข้อผิดพลาดบางอย่าง";
      api.error({ message: "เกิดข้อผิดพลาด", description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const token = getToken();
    try {
      await axios.delete(`${API_URL}/visitations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      api.success({ message: "สำเร็จ", description: "ลบข้อมูลการเยี่ยมเรียบร้อยแล้ว" });
      fetchData();
    } catch (error:any) {
        const errorMessage = error.response?.data?.error || "ไม่สามารถลบข้อมูลการเยี่ยมได้";
        api.error({ message: "เกิดข้อผิดพลาด", description: errorMessage });
    }
  };

  const disabledWeekend = (current: Dayjs) => {
    return current && (current.day() === 0 || current.day() === 6);
  };

  const getStatusTag = (statusName?: string) => {
    switch (statusName) {
      case "อนุมัติ": return <Tag color="green">อนุมัติ</Tag>;
      case "ปฏิเสธ": case "ไม่อนุมัติ": return <Tag color="red">ปฏิเสธ</Tag>;
      case "รอดำเนินการ": case "รอ...": return <Tag color="blue">รอดำเนินการ</Tag>;
      case "สำเร็จ": return <Tag color="purple">สำเร็จ</Tag>;
      default: return <Tag>{statusName || "ไม่ระบุ"}</Tag>;
    }
  };

  const columns = [
    { title: "ลำดับ", key: "index", render: (_: any, __: any, idx: number) => idx + 1, width: 70 },
    { title: "ผู้ต้องขัง", render: (_: any, r: Visitation) => `${r.Inmate?.FirstName} ${r.Inmate?.LastName}` },
    { title: "ผู้เข้าเยี่ยม", render: (_: any, r: Visitation) => `${r.Visitor?.FirstName} ${r.Visitor?.LastName}` },
    { title: "เลขบัตรประชาชน", render: (_: any, r: Visitation) => r.Visitor?.Citizen_ID },
    { title: "ความสัมพันธ์", dataIndex: ["Relationship", "Relationship_name"] },
    { title: "เจ้าหน้าที่", render: (_: any, r: Visitation) => `${r.Staff?.FirstName} ${r.Staff?.LastName}` },
    { title: "สถานะ", dataIndex: ["Status", "Status"], render: (status: string) => getStatusTag(status) },
    { title: "วันที่เข้าเยี่ยม", dataIndex: "Visit_Date", render: (date: string) => dayjs(date).format("DD/MM/YYYY") },
    { title: "ช่วงเวลา", dataIndex: ["TimeSlot", "TimeSlot_Name"] },
    {
      title: "การจัดการ",
      key: "action",
      render: (_: any, r: Visitation) => {
        const canManage = !isVisitor || (currentUser?.citizenId === r.Visitor?.Citizen_ID);
        
        if (!canManage) {
            return null;
        }
        
        return (
            <Space>
                <Button type="primary" ghost icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>แก้ไข</Button>
                <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDelete(r.ID)} okText="ยืนยัน" cancelText="ยกเลิก">
                    <Button icon={<DeleteOutlined />} size="small" danger>ลบคำร้อง</Button>
                </Popconfirm>
            </Space>
        )
      },
    },
  ];

  return (
    <Layout>
      {contextHolder}
      <Header style={{ padding: "0 16px", background: colorBgContainer, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: borderRadiusLG }}>
        <Title level={3} style={{ margin: 0 }}>ยื่นคำร้องขอเยี่ยมผู้ต้องขัง</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
          เพิ่มข้อมูลการเยี่ยม
        </Button>
      </Header>
      <Content style={{ padding: "16px 0" }}>
        <Card bordered={false}>
          <Row justify="end" style={{ marginBottom: 16 }}>
            <Col>
              <Input
                placeholder="ค้นหา..."
                prefix={<SearchOutlined />}
                allowClear
                value={searchValue}
                onChange={e => setSearchValue(e.target.value)}
                style={{ width: 300 }}
              />
            </Col>
          </Row>
          <Table
            columns={columns}
            dataSource={filteredVisitations}
            rowKey="ID"
            loading={loading}
            bordered
          />
        </Card>
      </Content>

      <Modal title={editing ? "แก้ไขข้อมูลการเยี่ยม" : "เพิ่มข้อมูลการเยี่ยม"} open={open} onCancel={() => setOpen(false)} footer={null} width={700}>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="ผู้ต้องขัง"
                name="Inmate_Input"
                rules={[{ required: true, message: "กรุณาเลือกผู้ต้องขัง" }]}
              >
                <AutoComplete
                  options={inmateOptions}
                  onSearch={handleInmateSearch}
                  onSelect={onInmateSelect}
                  onChange={onInmateChange}
                  placeholder="ค้นหาผู้ต้องขัง..."
                />
              </Form.Item>
              <Form.Item name="Inmate_ID" hidden><Input /></Form.Item>
            </Col>
            
            {!isVisitor && (
                <>
                    <Col span={8}>
                    <Form.Item label="ชื่อจริงผู้เข้าเยี่ยม" name="VisitorFirstName" rules={[{ required: true, message: "กรุณากรอกชื่อจริง" }]}>
                        <Input placeholder="ชื่อจริง" />
                    </Form.Item>
                    </Col>
                    <Col span={8}>
                    <Form.Item label="นามสกุลผู้เข้าเยี่ยม" name="VisitorLastName" rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}>
                        <Input placeholder="นามสกุล" />
                    </Form.Item>
                    </Col>
                    <Col span={8}>
                    <Form.Item label="เลขบัตรประชาชนผู้เข้าเยี่ยม" name="VisitorCitizenID" rules={[{ required: true, message: "กรุณากรอกเลขบัตรประชาชน" }]}>
                        <Input placeholder="เลขบัตรประชาชน" />
                    </Form.Item>
                    </Col>
                </>
            )}

            <Col span={12}>
              <Form.Item label="ความสัมพันธ์" name="Relationship_ID" rules={[{ required: true, message: "กรุณาเลือกความสัมพันธ์" }]}>
                <Select placeholder="เลือกความสัมพันธ์">
                  {relationships.map(r => <Option key={r.ID} value={r.ID}>{r.Relationship_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="เจ้าหน้าที่" name="Staff_ID" rules={[{ required: true, message: "กรุณาเลือกเจ้าหน้าที่" }]}>
                <Select showSearch filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())} placeholder="เลือกเจ้าหน้าที่">
                  {staffs.map(s => <Option key={s.StaffID} value={s.StaffID}>{s.FirstName} {s.LastName}</Option>)}
                </Select>
              </Form.Item>
            </Col>

            {!isVisitor && (
                 <Col span={24}>
                 <Form.Item
                    label="สถานะ"
                    name="Status_ID"
                    rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}
                    >
                    <Select placeholder="เลือกสถานะ">
                        {statuses.map(st => (
                            <Option key={st.Status_ID} value={st.Status_ID}>
                                {st.Status}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
               </Col>
            )}
           
            <Col span={12}>
              <Form.Item label="วันที่เข้าเยี่ยม" name="Visit_Date" rules={[{ required: true, message: "กรุณาเลือกวันที่เข้าเยี่ยม" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" onChange={handleDateChange} disabledDate={disabledWeekend} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="ช่วงเวลา" name="TimeSlot_ID" rules={[{ required: true, message: "กรุณาเลือกช่วงเวลา" }]}>
                <Select placeholder="เลือกช่วงเวลา">
                  {timeSlots.map(ts => <Option key={ts.ID} value={ts.ID} disabled={bookedSlots.includes(ts.ID)}>{ts.TimeSlot_Name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end">
            <Space>
              <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button type="primary" htmlType="submit" loading={loading}>บันทึก</Button>
            </Space>
          </Row>
        </Form>
      </Modal>
    </Layout>
  );
}
