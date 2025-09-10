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
      api.error({ message: "Error", description: "Could not load visitation data." });
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
        api.error({ message: "Error", description: "User data not found. Please log in again." });
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
        api.success({ message: "สำเร็จ", description: "อัพเดทคำร้องการเยี่ยมแล้ว." });
      } else {
        await axios.post(`${API_URL}/visitations`, payload, authHeader);
        api.success({ message: "สำเร็จ", description: "สร้างคำร้องการเยี่ยมแล้ว.." });
      }

      setOpen(false);
      form.resetFields();
      fetchData();
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.response?.data?.error || "An error occurred";
      api.error({ message: "Error", description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const token = getToken();
    try {
      await axios.delete(`${API_URL}/visitations/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      api.success({ message: "สำเร็จ", description: "ลบคำร้องการเยี่ยมแล้ว.." });
      fetchData();
    } catch (error:any) {
        const errorMessage = error.response?.data?.error || "Could not delete visitation";
        api.error({ message: "Error", description: errorMessage });
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
      default: return <Tag>{statusName || "N/A"}</Tag>;
    }
  };

  const columns = [
    { title: "No.", key: "index", render: (_: any, __: any, idx: number) => idx + 1, width: 70 },
    { title: "Inmate", render: (_: any, r: Visitation) => `${r.Inmate?.FirstName} ${r.Inmate?.LastName}` },
    { title: "Visitor", render: (_: any, r: Visitation) => `${r.Visitor?.FirstName} ${r.Visitor?.LastName}` },
    { title: "Citizen ID", render: (_: any, r: Visitation) => r.Visitor?.Citizen_ID },
    { title: "Relationship", dataIndex: ["Relationship", "Relationship_name"] },
    { title: "Staff", render: (_: any, r: Visitation) => `${r.Staff?.FirstName} ${r.Staff?.LastName}` },
    { title: "Status", dataIndex: ["Status", "Status"], render: (status: string) => getStatusTag(status) },
    { title: "Visit Date", dataIndex: "Visit_Date", render: (date: string) => dayjs(date).format("DD/MM/YYYY") },
    { title: "Time Slot", dataIndex: ["TimeSlot", "TimeSlot_Name"] },
    {
      title: "Action",
      key: "action",
      render: (_: any, r: Visitation) => {
        const canManage = !isVisitor || (currentUser?.citizenId === r.Visitor?.Citizen_ID);
        
        if (!canManage) {
            return null;
        }
        
        return (
            <Space>
                <Button type="primary" ghost icon={<EditOutlined />} size="small" onClick={() => openEdit(r)}>แก้ไข</Button>
                <Popconfirm title="Confirm Delete?" onConfirm={() => handleDelete(r.ID)} okText="Confirm" cancelText="Cancel">
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
                placeholder="Search..."
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

      <Modal title={editing ? "Edit Visitation" : "Add Visitation"} open={open} onCancel={() => setOpen(false)} footer={null} width={700}>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Inmate"
                name="Inmate_Input"
                rules={[{ required: true, message: "Please select an inmate" }]}
              >
                <AutoComplete
                  options={inmateOptions}
                  onSearch={handleInmateSearch}
                  onSelect={onInmateSelect}
                  onChange={onInmateChange}
                  placeholder="Search for an inmate..."
                />
              </Form.Item>
              <Form.Item name="Inmate_ID" hidden><Input /></Form.Item>
            </Col>
            
            {!isVisitor && (
                <>
                    <Col span={8}>
                    <Form.Item label="Visitor First Name" name="VisitorFirstName" rules={[{ required: true, message: "Please enter first name" }]}>
                        <Input placeholder="First Name" />
                    </Form.Item>
                    </Col>
                    <Col span={8}>
                    <Form.Item label="Visitor Last Name" name="VisitorLastName" rules={[{ required: true, message: "Please enter last name" }]}>
                        <Input placeholder="Last Name" />
                    </Form.Item>
                    </Col>
                    <Col span={8}>
                    <Form.Item label="Visitor Citizen ID" name="VisitorCitizenID" rules={[{ required: true, message: "Please enter Citizen ID" }]}>
                        <Input placeholder="Citizen ID" />
                    </Form.Item>
                    </Col>
                </>
            )}

            <Col span={12}>
              <Form.Item label="Relationship" name="Relationship_ID" rules={[{ required: true, message: "Please select a relationship" }]}>
                <Select placeholder="Select a relationship">
                  {relationships.map(r => <Option key={r.ID} value={r.ID}>{r.Relationship_name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Staff" name="Staff_ID" rules={[{ required: true, message: "Please select a staff member" }]}>
                <Select showSearch filterOption={(input, option) => String(option?.children).toLowerCase().includes(input.toLowerCase())} placeholder="Select a staff member">
                  {staffs.map(s => <Option key={s.StaffID} value={s.StaffID}>{s.FirstName} {s.LastName}</Option>)}
                </Select>
              </Form.Item>
            </Col>

            {!isVisitor && (
                 <Col span={24}>
                 <Form.Item
                    label="Status"
                    name="Status_ID"
                    rules={[{ required: true, message: "Please select a status" }]}
                    >
                    <Select placeholder="Select a status">
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
              <Form.Item label="Visit Date" name="Visit_Date" rules={[{ required: true, message: "Please select a visit date" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" onChange={handleDateChange} disabledDate={disabledWeekend} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Time Slot" name="TimeSlot_ID" rules={[{ required: true, message: "Please select a time slot" }]}>
                <Select placeholder="Select a time slot">
                  {timeSlots.map(ts => <Option key={ts.ID} value={ts.ID} disabled={bookedSlots.includes(ts.ID)}>{ts.TimeSlot_Name}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row justify="end">
            <Space>
              <Button onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={loading}>Save</Button>
            </Space>
          </Row>
        </Form>
      </Modal>
    </Layout>
  );
}

