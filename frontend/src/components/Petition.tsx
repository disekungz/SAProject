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
  notification,
  Col,
  AutoComplete,
  Tag,
  Avatar,
} from "antd";
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
import dayjs, { Dayjs } from "dayjs";
import { getUser } from "../lib/auth";
import { api } from "../lib/axios";

const { Title } = Typography;
const { Option } = Select;

// --- Interfaces (คงเดิม) ---
type ID = number;
interface Inmate { Prisoner_ID: ID; FirstName: string; LastName: string; }
interface Staff { StaffID: ID; FirstName:string; LastName: string; }
interface Status { Status_ID: ID; Status: string; }
interface Type_cum { ID: ID; Type_cum_name: string; }
interface Petition {
  ID: ID;
  Detail: string;
  Date_created: string;
  Inmate_ID: number;
  Staff_ID: number;
  Status_ID: number;
  Type_cum_ID: number;
  Inmate?: Inmate;
  Staff?: Staff;
  Status?: Status;
  Type?: Type_cum;
}
interface PetitionForm {
  ID?: number;
  Detail: string;
  Date_created: Dayjs | null;
  Inmate_ID: number | undefined;
  Inmate_Input?: string;
  Staff_ID: number | undefined;
  Status_ID: number | undefined;
  Type_cum_ID: number | undefined;
}

export default function Petition() {
  const user = getUser();
  // ⭐️ แก้ไข: เพิ่ม isAdmin เพื่อการตรวจสอบสิทธิ์ที่ละเอียดขึ้น
  const isAdmin = user?.rankId === 1;
  const isStaff = user?.rankId !== 3;
  
  const [notifyApi, contextHolder] = notification.useNotification();

  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [types, setTypes] = useState<Type_cum[]>([]);
  const [form] = Form.useForm<PetitionForm>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingPetition, setEditingPetition] = useState<Petition | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [filteredPetitions, setFilteredPetitions] = useState<Petition[]>([]);
  const [inmateOptions, setInmateOptions] = useState<{ value: string; label: string; key: number }[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [inmateRes, staffRes, statusRes, typesRes, petitionRes] = await Promise.all([
        api.get("/prisoners"),
        api.get("/staffs"),
        api.get("/statuses"),
        api.get("/typesc"),
        api.get("/petitions"),
      ]);

      const inmateData: Inmate[] = inmateRes.data || [];
      const staffData: Staff[] = staffRes.data || [];
      const statusData: Status[] = statusRes.data || [];
      const typesData: Type_cum[] = typesRes.data || [];
      const petitionData: Petition[] = petitionRes.data || [];
      
      const merged = petitionData.map((p) => ({
        ...p,
        Inmate: inmateData.find(i => i.Prisoner_ID === p.Inmate_ID),
        Staff: staffData.find(s => s.StaffID === p.Staff_ID),
        Status: statusData.find(st => st.Status_ID === p.Status_ID),
        Type: typesData.find(t => t.ID === p.Type_cum_ID),
      }));

      setInmates(inmateData);
      setStaffs(staffData);
      setStatuses(statusData);
      setTypes(typesData);
      setPetitions(merged);
      setFilteredPetitions(merged);
    } catch (error) {
      console.error("Fetch data error:", error);
      notifyApi.error({
        message: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถดึงข้อมูลคำร้องได้ อาจเกิดปัญหาการเชื่อมต่อหรือการยืนยันตัวตน",
      });
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (open && !editingPetition && statuses.length > 0) {
      const waitingStatus = statuses.find(st => st.Status === "รอ..." || st.Status === "รอดำเนินการ");
      if (waitingStatus) {
        form.setFieldsValue({ Status_ID: waitingStatus.Status_ID });
      }
    }
  }, [open, editingPetition, statuses, form]);

  useEffect(() => {
    if (!searchValue) {
      setFilteredPetitions(petitions);
    } else {
      const lowercasedValue = searchValue.toLowerCase().trim();
      const filteredData = petitions.filter(item => {
        const inmateName = `${item.Inmate?.FirstName} ${item.Inmate?.LastName}`.toLowerCase();
        const staffName = `${item.Staff?.FirstName} ${item.Staff?.LastName}`.toLowerCase();
        const detail = item.Detail?.toLowerCase() || '';
        return inmateName.includes(lowercasedValue) || staffName.includes(lowercasedValue) || detail.includes(lowercasedValue);
      });
      setFilteredPetitions(filteredData);
    }
  }, [searchValue, petitions]);
  
  const getStatusTag = (statusName?: string) => {
    switch (statusName) {
      case 'อนุมัติ': return <Tag color="success" icon={<CheckCircleOutlined />}>อนุมัติ</Tag>;
      case 'ปฏิเสธ': case 'ไม่อนุมัติ': return <Tag color="error" icon={<CloseCircleOutlined />}>ปฏิเสธ</Tag>;
      case 'รอดำเนินการ': case 'รอ...': return <Tag color="processing" icon={<ClockCircleOutlined />}>รอดำเนินการ</Tag>;
      case 'สำเร็จ': return <Tag color="purple" icon={<CheckCircleOutlined />}>สำเร็จ</Tag>;
      default: return <Tag icon={<ExclamationCircleOutlined />}>{statusName || 'ไม่ระบุ'}</Tag>;
    }
  };

  const getTypeTag = (typeName?: string) => {
    switch (typeName) {
      case 'สุขภาพ': return <Tag color="cyan">{typeName}</Tag>;
      case 'โอนย้าย': return <Tag color="purple">{typeName}</Tag>;
      case 'ทั่วไป': return <Tag color="gold">{typeName}</Tag>;
      default: return <Tag>{typeName || 'ไม่ระบุ'}</Tag>;
    }
  };

  const openAdd = () => {
    setEditingPetition(null);
    form.resetFields();
    const waitingStatus = statuses.find(st => st.Status === "รอ..." || st.Status === "รอดำเนินการ");
    if (waitingStatus) {
      form.setFieldsValue({ Status_ID: waitingStatus.Status_ID });
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
      Status_ID: record.Status_ID,
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

      if (editingPetition) {
        await api.put(`/petitions/${editingPetition.ID}`, payload);
        notifyApi.success({ message: "สำเร็จ", description: "อัปเดตข้อมูลคำร้องเรียบร้อยแล้ว" });
      } else {
        await api.post("/petitions", payload);
        notifyApi.success({ message: "สำเร็จ", description: "เพิ่มคำร้องใหม่เรียบร้อยแล้ว" });
      }
      setOpen(false);
      await fetchData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || "ไม่สามารถบันทึกข้อมูลคำร้องได้";
      notifyApi.error({ message: "เกิดข้อผิดพลาด", description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = () => {
    notifyApi.warning({ message: "ข้อมูลไม่ครบถ้วน", description: "กรุณากรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมาย *" });
  };

  const handleDelete = async (id: number) => {
    try {
      setLoading(true);
      await api.delete(`/petitions/${id}`);
      notifyApi.success({ message: "สำเร็จ", description: "ลบข้อมูลคำร้องเรียบร้อยแล้ว" });
      await fetchData();
    } catch (error: any) {
        const errorMsg = error.response?.data?.error || "ไม่สามารถลบข้อมูลคำร้องได้";
        notifyApi.error({ message: "เกิดข้อผิดพลาด", description: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleInmateSearch = (searchText: string) => {
    if (!searchText) setInmateOptions([]);
    else {
      const filtered = inmates.filter(p => `${p.FirstName} ${p.LastName}`.toLowerCase().includes(searchText.toLowerCase()));
      setInmateOptions(filtered.map(p => ({ value: `${p.FirstName} ${p.LastName}`, label: `${p.FirstName} ${p.LastName}`, key: p.Prisoner_ID })));
    }
  };
  
  const onInmateSelect = (_: string, option: { key: number }) => form.setFieldsValue({ Inmate_ID: option.key });
  const onInmateChange = (data: string) => { if(!data) form.setFieldsValue({ Inmate_ID: undefined }); };

  const columns = useMemo(
    () => [
      { title: "ลำดับ", key: "index", render: (_: any, __: any, index: number) => index + 1, width: 70, align: 'center' as const },
      { title: "ผู้ยื่นคำร้อง", render: (record: Petition) => <Space><Avatar icon={<UserOutlined />} /><span>{record.Inmate ? `${record.Inmate.FirstName} ${record.Inmate.LastName}` : 'N/A'}</span></Space> },
      { title: "ประเภท", dataIndex: ['Type', 'Type_cum_name'], render: (typeName: string) => getTypeTag(typeName) },
      { title: "สถานะ", dataIndex: ['Status', 'Status'], render: (status: string) => getStatusTag(status) },
      { title: "รายละเอียด", dataIndex: "Detail", ellipsis: true },
      { title: "วันที่ยื่น", dataIndex: "Date_created", render: (date: string) => (date ? dayjs(date).format("DD/MM/YYYY") : '-') },
      { title: "เจ้าหน้าที่ผู้รับเรื่อง", render: (record: Petition) => <span>{record.Staff ? `${record.Staff.FirstName} ${record.Staff.LastName}` : 'N/A'}</span> },
      {
        title: "การจัดการ",
        key: "action",
        render: (record: Petition) => {
          if (isStaff) {
            return (
              <Space>
                <Button type="primary" ghost icon={<EditOutlined />} size="small" onClick={() => openEdit(record)}>แก้ไข</Button>
                <Popconfirm title="ยืนยันการลบ?" onConfirm={() => handleDelete(record.ID)} okText="ยืนยัน" cancelText="ยกเลิก">
                  <Button icon={<DeleteOutlined />} size="small" danger>ลบ</Button>
                </Popconfirm>
              </Space>
            );
          }
          return null;
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isStaff],
  );

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      {contextHolder}
      <Title level={2} style={{ color: "#1890ff" }}><FileTextOutlined /> ระบบยื่นคำร้องทั่วไป</Title>
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={18}><Input placeholder="ค้นหา..." prefix={<SearchOutlined />} allowClear value={searchValue} onChange={e => setSearchValue(e.target.value)} /></Col>
          <Col xs={6}><Button type="primary" icon={<PlusOutlined />} onClick={openAdd} block disabled={!isStaff}>เพิ่มคำร้อง</Button></Col>
        </Row>
      </Card>
      <Card>
        <Table columns={columns} dataSource={filteredPetitions} rowKey="ID" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={editingPetition ? "แก้ไขคำร้อง" : "เพิ่มคำร้องใหม่"}
        open={open}
        onCancel={() => { setOpen(false); form.resetFields(); setEditingPetition(null); }}
        footer={null}
        destroyOnClose
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish} onFinishFailed={onFinishFailed}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="ผู้ยื่นคำร้อง" name="Inmate_Input" rules={[{ required: true, message: "กรุณาเลือกผู้ยื่นคำร้อง" }]}>
                <AutoComplete options={inmateOptions} onSearch={handleInmateSearch} onSelect={onInmateSelect} onChange={onInmateChange} placeholder="พิมพ์ชื่อเพื่อค้นหา..." />
              </Form.Item>
              <Form.Item name="Inmate_ID" hidden><Input /></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="ประเภทคำร้อง" name="Type_cum_ID" rules={[{ required: true, message: "กรุณาเลือกประเภท" }]}>
                <Select placeholder="เลือกประเภทคำร้อง">{types.map((t) => <Option key={t.ID} value={t.ID}>{t.Type_cum_name}</Option>)}</Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="รายละเอียดคำร้อง" name="Detail" rules={[{ required: true, message: "กรุณากรอกรายละเอียด" }]}>
                <Input.TextArea rows={4} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="วันที่ยื่น" name="Date_created" rules={[{ required: true, message: "กรุณาเลือกวันที่" }]}>
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="สถานะ" name="Status_ID" rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}>
                <Select
                  placeholder="เลือกสถานะ"
                  disabled={!isStaff}
                >
                  {statuses.map((st) => {
                    // ⭐️ เงื่อนไขใหม่:
                    // 1. แอดมิน (isAdmin) สามารถเลือกได้ทุกสถานะ (option ไม่ถูก disable)
                    // 2. ผู้คุม (!isAdmin แต่ isStaff) สามารถเลือกได้แค่สถานะ "รอ..."
                    const isWaitingStatus = st.Status === "รอ..." || st.Status === "รอดำเนินการ";
                    const optionDisabled = isStaff && !isAdmin && !isWaitingStatus;

                    return (
                      <Option key={st.Status_ID} value={st.Status_ID} disabled={optionDisabled}>
                        {st.Status}
                      </Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="เจ้าหน้าที่ผู้รับเรื่อง" name="Staff_ID" rules={[{ required: true, message: "กรุณาเลือกเจ้าหน้าที่" }]}>
                <Select showSearch placeholder="เลือกเจ้าหน้าที่" optionFilterProp="children">{staffs.map((s) => <Option key={s.StaffID} value={s.StaffID}>{s.FirstName} {s.LastName}</Option>)}</Select>
              </Form.Item>
            </Col>
          </Row>
          <div style={{ textAlign: "right", marginTop: 16 }}>
            <Button onClick={() => setOpen(false)} style={{ marginRight: 8 }}>ยกเลิก</Button>
            <Button type="primary" htmlType="submit" loading={loading} disabled={!isStaff}>บันทึกข้อมูล</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

