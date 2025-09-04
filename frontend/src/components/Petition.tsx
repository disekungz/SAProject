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
  Layout,
  theme,
} from "antd";
import {
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import axios from "axios";
import dayjs, { Dayjs } from "dayjs";

const { Title } = Typography;
const { Option } = Select;
const { Header, Content } = Layout;

const api = axios.create({
  baseURL: "http://localhost:8088",
});

type ID = number;

// --- Interfaces ---
interface Inmate {
  Prisoner_ID: ID;
  FirstName: string;
  LastName: string;
  Citizen_ID: string;
}

interface Staff {
  StaffID: ID;
  FirstName: string;
  LastName: string;
}

// --- 1. แก้ไข Interface Status ---
interface Status {
  Status_ID: ID; // เปลี่ยนจาก ID
  Status: string;
}

interface PetitionTypeCum {
  ID: ID;
  Type_cum_name: string;
}

interface Petition {
  ID: ID;
  Detail: string;
  Date_created: string;
  Inmate_ID: number;
  Inmate?: Inmate;
  Staff_ID: number;
  Staff?: Staff;
  Status_ID: number;
  Status?: Status;
  Type_cum_ID: number;
  Type?: PetitionTypeCum;
}

interface PetitionForm extends Omit<Petition, "Date_created"> {
  Date_created: Dayjs | null;
  Inmate_Input?: string;
}

export default function Petition() {
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [inmates, setInmates] = useState<Inmate[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [types, setTypes] = useState<PetitionTypeCum[]>([]);
  const [form] = Form.useForm<PetitionForm>();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filteredPetitions, setFilteredPetitions] = useState<Petition[]>([]);
  const [inmateOptions, setInmateOptions] = useState<{ value: string; label: string; key: number }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inmateRes, staffRes, statusRes, typesRes, petitionRes] = await Promise.all([
        api.get("/api/prisoners"),
        api.get("/api/staffs"),
        api.get("/api/statuses"),
        api.get("/api/typesc"),
        api.get("/api/petitions"),
      ]);

      const inmateData: Inmate[] = inmateRes.data || [];
      const staffData: Staff[] = staffRes.data || [];
      const statusData: Status[] = statusRes.data || [];
      const typesData: PetitionTypeCum[] = typesRes.data || [];
      const petitionData: Petition[] = petitionRes.data || [];

      setInmates(inmateData);
      setStaffs(staffData);
      setStatuses(statusData);
      setTypes(typesData);
      
      const merged = petitionData.map((p: Petition) => ({
        ...p,
        Inmate: inmateData.find(i => i.Prisoner_ID === p.Inmate_ID),
        Staff: staffData.find(s => s.StaffID === p.Staff_ID),
        Status: statusData.find(st => st.Status_ID === p.Status_ID), // 2. แก้ไขการ find
        Type: typesData.find(t => t.ID === p.Type_cum_ID),
      }));

      setPetitions(merged);
      setFilteredPetitions(merged);
    } catch (error) {
      message.error("ไม่สามารถดึงข้อมูลได้");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const lowercasedValue = searchValue.toLowerCase().trim();
    if (lowercasedValue === "") {
      setFilteredPetitions(petitions);
    } else {
      const filteredData = petitions.filter(item => {
        const inmateName = `${item.Inmate?.FirstName} ${item.Inmate?.LastName}`.toLowerCase();
        const staffName = `${item.Staff?.FirstName} ${item.Staff?.LastName}`.toLowerCase();
        const detail = item.Detail?.toLowerCase() || '';
        
        return inmateName.includes(lowercasedValue) || 
               staffName.includes(lowercasedValue) ||
               detail.includes(lowercasedValue);
      });
      setFilteredPetitions(filteredData);
    }
  }, [searchValue, petitions]);
  
  const getStatusTag = (statusName?: string) => {
    switch (statusName) {
        case 'อนุมัติ':
            return <Tag color="green">อนุมัติ</Tag>;
        case 'ปฏิเสธ':
        case 'ไม่อนุมัติ':
            return <Tag color="red">ปฏิเสธ</Tag>;
        case 'รอดำเนินการ':
        case 'รอ...':
            return <Tag color="blue">รอดำเนินการ</Tag>;
        case 'สำเร็จ':
            return <Tag color="purple">สำเร็จ</Tag>
        default:
            return <Tag>{statusName || 'ไม่ระบุ'}</Tag>;
    }
  };

  const getTypeTag = (typeName?: string) => {
    switch (typeName) {
        case 'สุขภาพ':
            return <Tag color="cyan">สุขภาพ</Tag>;
        case 'โอนย้าย':
            return <Tag color="purple">โอนย้าย</Tag>;
        case 'ทั่วไป':
            return <Tag color="gold">ทั่วไป</Tag>;
        default:
            return <Tag>ไม่ระบุ</Tag>;
    }
  };


 const columns = useMemo(
  () => [
    {
      title: "ลำดับ",
      key: "index",
      render: (_: any, __: any, index: number) => index + 1,
      width: 70
    },
    {
      title: "ผู้ยื่นคำร้อง",
      render: (record: Petition) => `${record.Inmate?.FirstName} ${record.Inmate?.LastName}`,
    },
    {
      title: "ประเภท",
      dataIndex: ['Type', 'Type_cum_name'],
      render: (typeName: string) => getTypeTag(typeName),
    },
    {
      title: "สถานะ",
      dataIndex: ['Status', 'Status'],
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "รายละเอียด",   // 👈 เพิ่มตรงนี้
      dataIndex: "Detail",
      render: (text: string) => text || "-",
      ellipsis: true, // ถ้าเนื้อหายาวจะย่อและมี tooltip
    },
    {
      title: "วันที่ยื่น",
      dataIndex: "Date_created",
      render: (date: string) => date ? dayjs(date).format("DD/MM/YYYY") : '-',
    },
    {
      title: "เจ้าหน้าที่ผู้รับเรื่อง",
      render: (record: Petition) => `${record.Staff?.FirstName} ${record.Staff?.LastName}`,
    },
    {
      title: "การจัดการ",
      key: "action",
      render: (record: Petition) => (
        <Space>
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            size="small"
            onClick={() => {
              setEditing(true);
              setOpen(true);
              const inmateText = record.Inmate ? `${record.Inmate.FirstName} ${record.Inmate.LastName}` : '';
              form.setFieldsValue({
                ...record,
                Date_created: record.Date_created ? dayjs(record.Date_created) : null,
                Inmate_Input: inmateText,
              });
            }}
          >
            แก้ไข
          </Button>
          <Popconfirm
            title="ยืนยันการลบ?"
            onConfirm={() => handleDelete(record.ID)}
            okText="ยืนยัน"
            cancelText="ยกเลิก"
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ],
  [petitions],
);


  const handleInmateSearch = (searchText: string) => {
    if (!searchText) {
      setInmateOptions([]);
    } else {
      const filtered = inmates.filter(p =>
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
  
  const onInmateSelect = (value: string, option: { key: number }) => {
     form.setFieldsValue({ Inmate_ID: option.key });
  };
  
  const onInmateChange = (data: string) => {
      if(!data){
          form.setFieldsValue({ Inmate_ID: undefined });
      }
  }

  const handleDelete = async (id: number) => {
    try {
        await api.delete(`/api/petitions/${id}`);
        message.success("ลบคำร้องสำเร็จ");
        fetchData();
    } catch (error) {
        message.error("เกิดข้อผิดพลาดในการลบคำร้อง");
    }
  };

  const onFinish = async (values: PetitionForm) => {
    setLoading(true);
    try {
      const { Inmate_Input, ...rest } = values;
      const payload = {
        ...rest,
        Detail: values.Detail,
        Inmate_ID: values.Inmate_ID,
        Staff_ID: values.Staff_ID,
        Status_ID: values.Status_ID,
        Type_ID: values.Type_cum_ID,
        Date_created: values.Date_created?.toISOString(),
      };

      if (editing) {
        await api.put(`/api/petitions/${form.getFieldValue("ID")}`, payload);
        message.success("แก้ไขสำเร็จ");
      } else {
        await api.post("/api/petitions", payload);
        message.success("เพิ่มคำร้องสำเร็จ");
      }
      setOpen(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      message.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
        <Header style={{ padding: '0 16px', background: colorBgContainer, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: borderRadiusLG }}>
            <Title level={3} style={{ margin: 0 }}>ระบบยื่นคำร้องทั่วไป</Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(false); setOpen(true); form.resetFields(); }}>
            เพิ่มคำร้อง
            </Button>
        </Header>
        <Content style={{ padding: '16px 0' }}>
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
                <Table columns={columns} dataSource={filteredPetitions} rowKey="ID" loading={loading} bordered />
            </Card>
        </Content>
      <Modal
        title={editing ? "แก้ไขคำร้อง" : "เพิ่มคำร้อง"}
        open={open}
        onCancel={() => {
          setOpen(false);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          style={{marginTop: 24}}
          initialValues={{
            Status_ID: statuses.find((st) => st.Status === "รอดำเนินการ" || st.Status === "รอ...")?.Status_ID,
          }}
        >
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item label="รายละเอียด" name="Detail" rules={[{ required: true, message: "กรุณากรอกรายละเอียด" }]}>
                <Input.TextArea rows={3} placeholder="ระบุรายละเอียดคำร้อง..."/>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
                label="ผู้ยื่นคำร้อง"
                name="Inmate_Input"
                rules={[{ required: true, message: "กรุณาพิมพ์และเลือกผู้ยื่นคำร้อง" }]}
            >
                <AutoComplete
                options={inmateOptions}
                onSearch={handleInmateSearch}
                onSelect={onInmateSelect}
                onChange={onInmateChange}
                placeholder="พิมพ์ชื่อผู้ต้องขัง..."
                />
            </Form.Item>
            <Form.Item name="Inmate_ID" hidden><Input /></Form.Item>
           </Col>
           <Col span={12}>
            <Form.Item label="เจ้าหน้าที่" name="Staff_ID" rules={[{ required: true, message: "กรุณาเลือกเจ้าหน้าที่" }]}>
                <Select showSearch filterOption={(input, option) => (String(option?.children)).toLowerCase().includes(input.toLowerCase())} placeholder="เลือกเจ้าหน้าที่ผู้รับเรื่อง">
                {staffs.map((s) => (
                    <Option key={s.StaffID} value={s.StaffID}>
                    {s.FirstName} {s.LastName}
                    </Option>
                ))}
                </Select>
            </Form.Item>
           </Col>
           <Col span={12}>
            <Form.Item label="ประเภทคำร้อง" name="Type_cum_ID" rules={[{ required: true, message: "กรุณาเลือกประเภทคำร้อง" }]}>
                <Select placeholder="เลือกประเภท">
                {types.map((t) => (
                    <Option key={t.ID} value={t.ID}>
                    {t.Type_cum_name}
                    </Option>
                ))}
                </Select>
            </Form.Item>
           </Col>
           <Col span={12}>
            <Form.Item label="สถานะ" name="Status_ID" rules={[{ required: true, message: "กรุณาเลือกสถานะ" }]}>
                <Select placeholder="เลือกสถานะ">
                {statuses.map((st) => (
                    <Option key={st.Status_ID} value={st.Status_ID}>
                        {st.Status}
                    </Option> 
                ))}
                </Select>
            </Form.Item>
           </Col>
           <Col span={24}>
            <Form.Item label="วันที่ยื่น" name="Date_created" rules={[{ required: true, message: "กรุณาเลือกวันที่ยื่น" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
            </Form.Item>
           </Col>
        </Row>
          <Row justify="end" style={{marginTop: 24}}>
            <Space>
              <Button onClick={() => setOpen(false)}>ยกเลิก</Button>
              <Button loading={loading} type="primary" htmlType="submit">
                {editing ? "บันทึก" : "เพิ่ม"}
              </Button>
            </Space>
          </Row>
        </Form>
      </Modal>
    </Layout>
  );
}