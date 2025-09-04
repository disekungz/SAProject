import { useState, useEffect } from "react";
import axios from "axios";
import {
  Input,
  Button,
  Card,
  Form,
  DatePicker,
  Typography,
  Row,
  Col,
  message,
  Table,
  Space,
  Modal,
  Popconfirm,
  Select,
  Tag,
  Avatar,
  InputNumber,
} from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import localeData from "dayjs/plugin/localizedFormat";
dayjs.extend(localeData);

const { Title } = Typography;
const { Option } = Select;

// --- Interfaces ---
interface Prisoner {
  Prisoner_ID: number;
  Inmate_ID: string;
  FirstName: string;
  LastName: string;
}
interface Doctor { DoctorID: number; DoctorName: string; }
interface Staff { StaffID: number; FirstName: string; }
interface Parcel { PID: number; ParcelName: string; Type_ID: number; }

interface MedicalHistory {
  MedicalID: number;
  Initial_symptoms: string;
  Diagnosis: string;
  Medicine: number;
  MedicineAmount: number;
  Date_Inspection: string;
  Next_appointment?: string | null;
  Prisoner_ID: number;
  DoctorID: number;
  StaffID: number;
  Prisoner?: Prisoner;
  Doctor?: Doctor;
  Staff?: Staff;
  Parcel?: Parcel;
}

const API_URL = "http://localhost:8088/api";

// ฟังก์ชันสุ่มสี Avatar
const getRandomColor = (id: number) => {
  const colors = ["#f56a00","#7265e6","#ffbf00","#00a2ae","#87d068","#ff69b4","#1890ff","#52c41a"];
  return colors[id % colors.length];
};

export default function PrisonerMedicalExam() {
  const [form] = Form.useForm();
  const [medicalHistories, setMedicalHistories] = useState<MedicalHistory[]>([]);
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filtered, setFiltered] = useState<MedicalHistory[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // ใช้ selected เพื่อ "ดู" รายการ (read-only)
  const [selected, setSelected] = useState<MedicalHistory | null>(null);

  const [loading, setLoading] = useState(false);

  // 👉 เก็บสถานะหน้าปัจจุบัน/ขนาดหน้า เพื่อนับลำดับต่อหน้า
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 8 });

  // --- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      const [medicalRes, prisonerRes, doctorRes, staffsRes, parcelsRes] =
        await Promise.all([
          axios.get(`${API_URL}/medical_histories`),
          axios.get(`${API_URL}/prisoners`),
          axios.get(`${API_URL}/doctors`),
          axios.get(`${API_URL}/staffs`),
          axios.get(`${API_URL}/parcels`),
        ]);

      const medicalData: MedicalHistory[] = medicalRes.data || [];
      const prisonerData: Prisoner[] = prisonerRes.data || [];
      const doctorData: Doctor[] = doctorRes.data || [];
      const staffsData: Staff[] = staffsRes.data || [];
      const parcelsData: Parcel[] = (parcelsRes.data || []).filter((p: { Type_ID: number }) => p.Type_ID === 3);

      const mergedData = medicalData.map((history) => {
        const prisoner = prisonerData.find((p) => p.Prisoner_ID === history.Prisoner_ID);
        const doctor = doctorData.find((d) => d.DoctorID === history.DoctorID);
        const staff = staffsData.find((s) => s.StaffID === history.StaffID);
        const parcel = parcelsData.find((p) => p.PID === Number(history.Medicine));
        return { ...history, Prisoner: prisoner, Doctor: doctor, Staff: staff, Parcel: parcel };
      });

      setMedicalHistories(mergedData);
      setPrisoners(prisonerData);
      setDoctors(doctorData);
      setStaffs(staffsData);
      setParcels(parcelsData);
      setFiltered(mergedData);
    } catch {
      message.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { applyFilter(searchValue); }, [medicalHistories, searchValue]);

  const applyFilter = (q: string) => {
    if (!q) { setFiltered(medicalHistories); return; }
    const lower = q.toLowerCase();
    setFiltered(
      medicalHistories.filter(
        (r) =>
          r.Prisoner?.Inmate_ID?.toLowerCase().includes(lower) ||
          (r.Prisoner?.FirstName + " " + r.Prisoner?.LastName)?.toLowerCase().includes(lower) ||
          r.Doctor?.DoctorName?.toLowerCase().includes(lower) ||
          r.Staff?.FirstName?.toLowerCase().includes(lower) ||
          r.Parcel?.ParcelName?.toLowerCase().includes(lower) ||
          r.Initial_symptoms?.toLowerCase().includes(lower) ||
          r.Diagnosis?.toLowerCase().includes(lower)
      )
    );
    // รีเซ็ตไปหน้าแรกเมื่อมีการค้นหา
    setTablePagination((p) => ({ ...p, current: 1 }));
  };

  // --- Modal & Form ---
  const openAdd = () => {
    form.resetFields();
    setSelected(null); // โหมดเพิ่ม
    setModalOpen(true);
  };

  // เปิดโหมดดู (read-only)
  const openView = (record: MedicalHistory) => {
    setSelected(record);
    form.setFieldsValue({
      ...record,
      Date_Inspection: dayjs(record.Date_Inspection),
      Next_appointment: record.Next_appointment ? dayjs(record.Next_appointment) : null,
      Medicine: record.Medicine,
      MedicineAmount: record.MedicineAmount,
    });
    setModalOpen(true);
  };

  const onFinish = async (values: any) => {
    // ถ้าเป็นโหมด "ดู" ไม่ทำอะไร
    if (selected) {
      setModalOpen(false);
      return;
    }

    // โหมดเพิ่มใหม่
    const basePayload = {
      ...values,
      Date_Inspection: values.Date_Inspection.toISOString(),
      Next_appointment: values.Next_appointment ? values.Next_appointment.toISOString() : null,
    };

    const payload = {
      ...basePayload,
      Medicine: Number(values.Medicine),
      MedicineAmount: Number(values.MedicineAmount),
    };

    try {
      await axios.post(`${API_URL}/medical_histories`, payload);
      message.success("เพิ่มข้อมูลการตรวจรักษาเรียบร้อย");

      // ✅ สร้างคำร้องเบิกยาเฉพาะตอนเพิ่ม
      try {
        const requestingPayload = {
          PID: payload.Medicine,
          Amount_Request: payload.MedicineAmount,
          Staff_ID: payload.StaffID,
          Request_Date: dayjs().format("YYYY-MM-DD"),
        };
        await axios.post(`${API_URL}/requestings`, requestingPayload);
        message.success("สร้างคำร้องเบิกยาเรียบร้อย");
      } catch {
        message.error("บันทึกการตรวจแล้ว แต่ไม่สามารถสร้างคำร้องเบิกได้");
      }

      setModalOpen(false);
      form.resetFields();
      fetchData();
    } catch {
      message.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/medical_histories/${id}`);
      message.success("ลบข้อมูลเรียบร้อย");
      fetchData();
    } catch {
      message.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  // ฟังก์ชันแสดงสถานะวันนัด
  const renderNextAppointment = (date: string | null | undefined) => {
    if (!date) {
      return <Tag color="default">ไม่มีการนัด</Tag>;
    }

    const appointmentDate = dayjs(date);
    const today = dayjs();
    const diffDays = appointmentDate.diff(today, 'day');

    if (diffDays < 0) {
      // วันนัดผ่านมาแล้ว
      return (
        <div>
          <Tag color="red">เลยกำหนด</Tag>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {appointmentDate.format("DD/MM/YYYY")}
          </div>
        </div>
      );
    } else if (diffDays === 0) {
      // วันนัดวันนี้
      return (
        <div>
          <Tag color="orange">วันนี้</Tag>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {appointmentDate.format("DD/MM/YYYY")}
          </div>
        </div>
      );
    } else if (diffDays <= 7) {
      // วันนัดใกล้เข้ามา (ภายใน 7 วัน)
      return (
        <div>
          <Tag color="yellow">ใกล้ถึงกำหนด</Tag>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {appointmentDate.format("DD/MM/YYYY")} (อีก {diffDays} วัน)
          </div>
        </div>
      );
    } else {
      // วันนัดปกติ
      return (
        <div>
          <Tag color="green">นัดหมาย</Tag>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {appointmentDate.format("DD/MM/YYYY")}
          </div>
        </div>
      );
    }
  };

  // --- Table Columns ---
  const columns = [
    // ★ ลำดับรันนิ่งต่อหน้า
    {
      title: "ลำดับ",
      key: "seq",
      width: 70,
      align: "center" as const,
      render: (_: any, __: MedicalHistory, index: number) =>
        (tablePagination.current - 1) * tablePagination.pageSize + index + 1,
    },
    {
      title: "ข้อมูลผู้ต้องขัง",
      key: "prisoner_info",
      width: 200,
      render: (_: any, record: MedicalHistory) => {
        const prisoner = record.Prisoner;
        if (!prisoner) return "-";
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar
              style={{ backgroundColor: getRandomColor(prisoner.Prisoner_ID), flexShrink: 0 }}
              icon={<UserOutlined />}
            />
            <div>
              <div style={{ fontWeight: "bold", fontSize: '13px' }}>
                {prisoner.FirstName} {prisoner.LastName}
              </div>
              <Tag color="blue" style={{ fontSize: '11px' }}>รหัส: {prisoner.Inmate_ID}</Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: "แพทย์ผู้ตรวจ",
      key: "doctor",
      width: 140,
      render: (_: any, record: MedicalHistory) => (
        <span style={{ color: "#1890ff", fontWeight: "bold", fontSize: '13px' }}>
          <ExperimentOutlined /> {record.Doctor?.DoctorName || "-"}
        </span>
      ),
    },
    {
      title: "วันที่ตรวจ",
      dataIndex: "Date_Inspection",
      width: 100,
      render: (date: string) => (date ? dayjs(date).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "การวินิจฉัย",
      dataIndex: "Diagnosis",
      width: 150,
      render: (text: string) => (
        <div style={{ color: "#52c41a", fontWeight: "bold", fontSize: '13px' }}>
          {text}
        </div>
      ),
    },
    {
      title: "ยา",
      dataIndex: ["Parcel", "ParcelName"],
      width: 120,
      render: (medicine: string) => <Tag color="green">{medicine || "-"}</Tag>,
    },
    {
      title: "จำนวน",
      dataIndex: "MedicineAmount",
      width: 80,
      align: "center" as const,
      render: (amount: number) => <Tag color="blue">{amount || "-"}</Tag>,
    },
    {
      title: "นัดครั้งถัดไป",
      key: "next_appointment",
      width: 140,
      render: (_: any, record: MedicalHistory) => 
        renderNextAppointment(record.Next_appointment),
    },
    {
      title: "ผู้คุมที่บันทึก",
      width: 120,
      render: (_: any, record: MedicalHistory) => (
        <span style={{ fontSize: '13px' }}>
          <span style={{ marginRight: 6 }}>👮</span>{record.Staff?.FirstName || "-"}
        </span>
      ),
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 120,
      render: (_: any, record: MedicalHistory) => (
        <Space size="small">
          <Button icon={<EyeOutlined />} size="small" type="primary" ghost onClick={() => openView(record)}>
            ดู
          </Button>
          <Popconfirm title="ยืนยันการลบ" onConfirm={() => handleDelete(record.MedicalID)}>
            <Button icon={<DeleteOutlined />} size="small" danger>
              ลบ
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const isView = !!selected;

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      <Title level={2} style={{ color: "#1890ff" }}>
        <MedicineBoxOutlined /> บันทึกการตรวจ/รักษาผู้ต้องขัง
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={18}>
            <Input
              placeholder="ค้นหา รหัสนักโทษ, ชื่อ, ยา, อาการ, การวินิจฉัย"
              allowClear
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </Col>
          <Col xs={6}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} block>
              เพิ่มการตรวจรักษา
            </Button>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          loading={loading}
          rowKey="MedicalID"
          pagination={tablePagination}
          onChange={(pag) =>
            setTablePagination({
              current: pag.current || 1,
              pageSize: pag.pageSize || tablePagination.pageSize,
            })
          }
        />
      </Card>

      <Modal
        title={isView ? "ดูประวัติการตรวจรักษา" : "เพิ่มการตรวจรักษา"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setSelected(null); }}
        footer={null}
        destroyOnClose
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="ผู้ต้องขัง" name="Prisoner_ID" rules={[{ required: !isView }]}>
                <Select showSearch placeholder="เลือกผู้ต้องขัง" optionFilterProp="label" disabled={isView}>
                  {prisoners.map((p) => (
                    <Option
                      key={p.Prisoner_ID}
                      value={p.Prisoner_ID}
                      label={`${p.Inmate_ID} ${p.FirstName} ${p.LastName}`}
                    >
                      {p.FirstName} {p.LastName} (รหัสนักโทษ: {p.Inmate_ID})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="แพทย์ผู้ตรวจ" name="DoctorID" rules={[{ required: !isView }]}>
                <Select showSearch placeholder="เลือกแพทย์" optionFilterProp="label" disabled={isView}>
                  {doctors.map((d) => (
                    <Option key={d.DoctorID} value={d.DoctorID} label={d.DoctorName}>
                      {d.DoctorName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="วันที่ตรวจ" name="Date_Inspection" rules={[{ required: !isView }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabled={isView} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="นัดครั้งถัดไป" name="Next_appointment">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabled={isView} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="อาการเบื้องต้น" name="Initial_symptoms" rules={[{ required: !isView }]}>
                <Input.TextArea rows={2} disabled={isView} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="การวินิจฉัย" name="Diagnosis" rules={[{ required: !isView }]}>
                <Input.TextArea rows={2} disabled={isView} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="ยาที่จ่าย" name="Medicine" rules={[{ required: !isView }]}>
                <Select
                  showSearch
                  placeholder="เลือกยา"
                  optionFilterProp="label"
                  disabled={isView}
                >
                  {parcels.map((p) => (
                    <Option key={p.PID} value={p.PID} label={p.ParcelName}>
                      {p.ParcelName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="จำนวนยาที่จ่าย"
                name="MedicineAmount"
                rules={[{ required: !isView, message: "กรุณาระบุจำนวนยา" }]}
              >
                <InputNumber min={1} style={{ width: "100%" }} disabled={isView} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="ผู้คุมที่ลงข้อมูล" name="StaffID" rules={[{ required: !isView }]}>
                <Select showSearch placeholder="เลือกผู้คุม" optionFilterProp="label" disabled={isView}>
                  {staffs.map((s) => (
                    <Option key={s.StaffID} value={s.StaffID} label={s.FirstName}>
                      {s.FirstName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <div style={{ textAlign: "right" }}>
            {isView ? (
              <Button onClick={() => { setModalOpen(false); setSelected(null); }} type="primary">
                ปิด
              </Button>
            ) : (
              <>
                <Button onClick={() => setModalOpen(false)} style={{ marginRight: 8 }}>
                  ยกเลิก
                </Button>
                <Button type="primary" htmlType="submit">
                  เพิ่มการตรวจรักษา
                </Button>
              </>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}