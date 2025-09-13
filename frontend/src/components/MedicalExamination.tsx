import { useState, useEffect, useMemo } from "react";
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
  Table,
  Space,
  Modal,
  Popconfirm,
  Select,
  Tag,
  Avatar,
  InputNumber,
  notification,
} from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
  UserOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import localeData from "dayjs/plugin/localizedFormat";
dayjs.extend(localeData);

const { Title } = Typography;

const API_URL = "http://localhost:8088/api";

/* =========================
 * Types
 * =======================*/
interface Prisoner {
  Prisoner_ID: number;
  Inmate_ID: string;
  FirstName: string;
  LastName: string;
}

type WorkStatus = "ทำงานอยู่" | "ไม่ได้ทำงาน";

interface Staff {
  StaffID: number;
  FirstName: string;
  Status?: WorkStatus;
}

interface Parcel {
  PID: number;
  ParcelName: string;
  Type_ID: number;
}

interface MedicalHistory {
  MedicalID: number;
  Initial_symptoms: string;
  Diagnosis: string;
  Medicine: number;
  MedicineAmount: number;
  Date_Inspection: string;
  Next_appointment?: string | null;
  Prisoner_ID: number;
  StaffID: number;
  Doctor: string;
  Prisoner?: Prisoner;
  Staff?: Staff;
  Parcel?: Parcel;
}

/* =========================
 * Utils
 * =======================*/
const getRandomColor = (id: number) => {
  const colors = ["#f56a00","#7265e6","#ffbf00","#00a2ae","#87d068","#ff69b4","#1890ff","#52c41a"];
  return colors[id % colors.length];
};

export default function PrisonerMedicalExam() {
  const [form] = Form.useForm();

  // ✅ Notification bottom-right
  const [notify, notifyHolder] = notification.useNotification();
  const toast = {
    success: (msg: string, desc?: string) => notify.success({ message: msg, description: desc, placement: "bottomRight" }),
    error: (msg: string, desc?: string) => notify.error({ message: msg, description: desc, placement: "bottomRight" }),
    info: (msg: string, desc?: string) => notify.info({ message: msg, description: desc, placement: "bottomRight" }),
  };

  const [medicalHistories, setMedicalHistories] = useState<MedicalHistory[]>([]);
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filtered, setFiltered] = useState<MedicalHistory[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<MedicalHistory | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 👉 สำหรับลำดับต่อหน้า
  const [tablePagination, setTablePagination] = useState({ current: 1, pageSize: 8 });

  const isView = selected !== null && !isEditing;

  /* ---------- Fetch Data ---------- */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [medicalRes, prisonerRes, staffsRes, parcelsRes] = await Promise.all([
        axios.get(`${API_URL}/medical_histories`),
        axios.get(`${API_URL}/prisoners`),
        axios.get(`${API_URL}/staffs`),
        axios.get(`${API_URL}/parcels`),
      ]);

      const medicalRaw = Array.isArray(medicalRes.data) ? medicalRes.data : medicalRes.data?.data || [];
      const prisonerData: Prisoner[] = Array.isArray(prisonerRes.data) ? prisonerRes.data : prisonerRes.data?.data || [];

      // ✅ normalize staffs + status
      const staffsData: Staff[] = (Array.isArray(staffsRes.data) ? staffsRes.data : staffsRes.data?.data || []).map((s: any) => ({
        StaffID: Number(s.StaffID ?? s.staff_id ?? s.id ?? 0),
        FirstName: String(s.FirstName ?? s.first_name ?? s.firstName ?? "-"),
        Status: (s.Status ?? s.status ?? "ทำงานอยู่") as WorkStatus,
      }));

      const parcelsData: Parcel[] = (Array.isArray(parcelsRes.data) ? parcelsRes.data : parcelsRes.data?.data || [])
        .filter((p: Parcel) => Number(p.Type_ID) === 3);

      const mergedData: MedicalHistory[] = medicalRaw.map((history: any) => {
        const normalized: MedicalHistory = {
          MedicalID: Number(history.MedicalID ?? history.medical_id ?? history.id ?? 0),
          Initial_symptoms: history.Initial_symptoms ?? history.initial_symptoms ?? "",
          Diagnosis: history.Diagnosis ?? history.diagnosis ?? "",
          Medicine: Number(history.Medicine ?? history.medicine ?? 0),
          MedicineAmount: Number(history.MedicineAmount ?? history.medicine_amount ?? 0),
          Date_Inspection: history.Date_Inspection ?? history.date_inspection ?? dayjs().toISOString(),
          Next_appointment: history.Next_appointment ?? history.next_appointment ?? null,
          Prisoner_ID: Number(history.Prisoner_ID ?? history.prisoner_id ?? 0),
          StaffID: Number(history.StaffID ?? history.staff_id ?? 0),
          Doctor: String(history.Doctor ?? history.doctor ?? ""),
        };
        const prisoner = prisonerData.find((p) => p.Prisoner_ID === normalized.Prisoner_ID);
        const staff = staffsData.find((s) => s.StaffID === normalized.StaffID);
        const parcel = parcelsData.find((p) => p.PID === Number(normalized.Medicine));
        return { ...normalized, Prisoner: prisoner, Staff: staff, Parcel: parcel };
      });

      setMedicalHistories(mergedData);
      setPrisoners(prisonerData);
      setStaffs(staffsData);
      setParcels(parcelsData);
      setFiltered(mergedData);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { applyFilter(searchValue); }, [medicalHistories, searchValue]);

  /* ---------- Derived ---------- */
  // เฉพาะเจ้าหน้าที่ที่ "ทำงานอยู่"
  const activeStaffs = useMemo(
    () => staffs.filter((s) => (s.Status ?? "ทำงานอยู่") === "ทำงานอยู่"),
    [staffs]
  );

  // เจ้าหน้าที่ที่ถูกเลือกอยู่ในฟอร์มปัจจุบัน (ใช้ StaffID ในฟอร์ม)
  const currentStaff = useMemo(() => {
    const id = Number(form.getFieldValue("StaffID"));
    if (!id) return undefined;
    return staffs.find((s) => s.StaffID === id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffs, modalOpen, selected]);

  // รายการ option: active + แถม currentStaff ถ้าไม่ได้ทำงาน (เพื่อให้ label แสดงชื่อ ไม่ใช่เลข)
  const staffOptions = useMemo(() => {
    const opts = activeStaffs.map((s) => ({
      value: s.StaffID,
      label: s.FirstName,
      disabled: false,
    }));

    if (
      currentStaff &&
      (currentStaff.Status ?? "ทำงานอยู่") !== "ทำงานอยู่" &&
      !opts.some((o) => o.value === currentStaff.StaffID)
    ) {
      opts.unshift({
        value: currentStaff.StaffID,
        label: `${currentStaff.FirstName} (ไม่ได้ทำงาน)`,
        disabled: true, // แสดงชื่อได้ แต่กันไม่ให้เลือกซ้ำ
      });
    }
    return opts;
  }, [activeStaffs, currentStaff]);

  const applyFilter = (q: string) => {
    if (!q) { setFiltered(medicalHistories); return; }
    const lower = q.toLowerCase();
    setFiltered(
      medicalHistories.filter((r) =>
        (r.Prisoner?.Inmate_ID || "").toLowerCase().includes(lower) ||
        ((r.Prisoner?.FirstName || "") + " " + (r.Prisoner?.LastName || "")).toLowerCase().includes(lower) ||
        (r.Doctor || "").toLowerCase().includes(lower) ||
        (r.Staff?.FirstName || "").toLowerCase().includes(lower) ||
        (r.Parcel?.ParcelName || "").toLowerCase().includes(lower) ||
        (r.Initial_symptoms || "").toLowerCase().includes(lower) ||
        (r.Diagnosis || "").toLowerCase().includes(lower)
      )
    );
    setTablePagination((p) => ({ ...p, current: 1 }));
  };

  /* ---------- Modal & Form ---------- */
  const openAdd = () => {
    form.resetFields();
    form.setFieldsValue({ StaffID: undefined }); // กันค่าค้าง
    setSelected(null);
    setIsEditing(true);
    setModalOpen(true);
  };

  const openView = (record: MedicalHistory) => {
    setSelected(record);
    setIsEditing(false);
    form.setFieldsValue({
      ...record,
      Date_Inspection: dayjs(record.Date_Inspection),
      Next_appointment: record.Next_appointment ? dayjs(record.Next_appointment) : undefined,
      Medicine: record.Medicine,
      MedicineAmount: record.MedicineAmount,
      Doctor: record.Doctor,
      Prisoner_ID: record.Prisoner_ID,
      StaffID: record.StaffID,
    });
    setModalOpen(true);
  };

  const onFinish = async (values: any) => {
    // ✅ กันพลาด: ถ้า staff ไม่ได้ทำงานให้บล็อก
    const chosenStaff = staffs.find((s) => s.StaffID === Number(values.StaffID));
    if (!chosenStaff || (chosenStaff.Status ?? "ทำงานอยู่") !== "ทำงานอยู่") {
      toast.error("ไม่สามารถบันทึกได้: เจ้าหน้าที่คนนี้ไม่ได้ทำงานอยู่");
      return;
    }

    const basePayload = {
      ...values,
      Date_Inspection: values.Date_Inspection?.toISOString(),
      Next_appointment: values.Next_appointment ? values.Next_appointment.toISOString() : null,
    };

    const payload = {
      ...basePayload,
      Prisoner_ID: Number(values.Prisoner_ID),
      StaffID: Number(values.StaffID),
      Medicine: Number(values.Medicine ?? selected?.Medicine ?? 0),
      MedicineAmount: Number(values.MedicineAmount ?? selected?.MedicineAmount ?? 0),
      Doctor: String(values.Doctor || "").trim(),
    };

    try {
      setSubmitting(true);
      if (selected && isEditing) {
        await axios.put(`${API_URL}/medical_histories/${selected.MedicalID}`, payload);
        toast.success("บันทึกการแก้ไขเรียบร้อย");
      } else if (!selected && isEditing) {
        await axios.post(`${API_URL}/medical_histories`, payload);
        toast.success("เพิ่มข้อมูลการตรวจรักษาเรียบร้อย");

        // สร้างคำร้องเบิกยาเฉพาะตอนเพิ่ม
        try {
          const requestingPayload = {
            PID: payload.Medicine,
            Amount_Request: payload.MedicineAmount,
            Staff_ID: payload.StaffID,
            Request_Date: dayjs().format("YYYY-MM-DD"),
          };
          await axios.post(`${API_URL}/requestings`, requestingPayload);
          toast.success("สร้างคำร้องเบิกยาเรียบร้อย");
        } catch {
          toast.error("บันทึกการตรวจแล้ว แต่ไม่สามารถสร้างคำร้องเบิกได้");
        }
      }
      setModalOpen(false);
      form.resetFields();
      setSelected(null);
      setIsEditing(false);
      fetchData();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/medical_histories/${id}`);
      toast.success("ลบข้อมูลเรียบร้อย");
      fetchData();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  const renderNextAppointment = (date: string | null | undefined) => {
    if (!date) return <Tag color="default">ไม่มีการนัด</Tag>;
    const appointmentDate = dayjs(date);
    const today = dayjs();
    const diffDays = appointmentDate.diff(today, "day");

    if (diffDays < 0) {
      return (
        <div>
          <Tag color="red">เลยกำหนด</Tag>
          <div style={{ fontSize: "12px", color: "#999" }}>{appointmentDate.format("DD/MM/YYYY")}</div>
        </div>
      );
    } else if (diffDays === 0) {
      return (
        <div>
          <Tag color="orange">วันนี้</Tag>
          <div style={{ fontSize: "12px", color: "#999" }}>{appointmentDate.format("DD/MM/YYYY")}</div>
        </div>
      );
    } else if (diffDays <= 7) {
      return (
        <div>
          <Tag color="gold">ใกล้ถึงกำหนด</Tag>
          <div style={{ fontSize: "12px", color: "#999" }}>
            {appointmentDate.format("DD/MM/YYYY")} (อีก {diffDays} วัน)
          </div>
        </div>
      );
    } else {
      return (
        <div>
          <Tag color="green">นัดหมาย</Tag>
          <div style={{ fontSize: "12px", color: "#999" }}>{appointmentDate.format("DD/MM/YYYY")}</div>
        </div>
      );
    }
  };

  /* ---------- Table Columns ---------- */
  const columns = [
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
      width: 220,
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
              <div style={{ fontWeight: "bold", fontSize: "13px" }}>
                {prisoner.FirstName} {prisoner.LastName}
              </div>
              <Tag color="blue" style={{ fontSize: "11px" }}>รหัส: {prisoner.Inmate_ID}</Tag>
            </div>
          </div>
        );
      },
    },
    {
      title: "แพทย์ผู้ตรวจ",
      key: "doctor",
      width: 170,
      render: (_: any, record: MedicalHistory) => (
        <span style={{ color: "#1890ff", fontWeight: "bold", fontSize: "13px" }}>
          <ExperimentOutlined /> {record.Doctor || "-"}
        </span>
      ),
    },
    {
      title: "วันที่ตรวจ",
      dataIndex: "Date_Inspection",
      width: 110,
      render: (date: string) => (date ? dayjs(date).format("DD/MM/YYYY") : "-"),
    },
    {
      title: "การวินิจฉัย",
      dataIndex: "Diagnosis",
      width: 170,
      render: (text: string) => (
        <div style={{ color: "#52c41a", fontWeight: "bold", fontSize: "13px" }}>
          {text}
        </div>
      ),
    },
    {
      title: "ยา",
      dataIndex: ["Parcel", "ParcelName"],
      width: 140,
      render: (medicine: string) => <Tag color="green">{medicine || "-"}</Tag>,
    },
    {
      title: "จำนวน",
      dataIndex: "MedicineAmount",
      width: 90,
      align: "center" as const,
      render: (amount: number) => <Tag color="blue">{amount || "-"}</Tag>,
    },
    {
      title: "นัดครั้งถัดไป",
      key: "next_appointment",
      width: 160,
      render: (_: any, record: MedicalHistory) => renderNextAppointment(record.Next_appointment),
    },
    {
      title: "ผู้คุมที่บันทึก",
      width: 160,
      render: (_: any, record: MedicalHistory) => {
        const st = record.Staff;
        const status = st?.Status ?? "ทำงานอยู่";
        const color = status === "ทำงานอยู่" ? "green" : "red";
        return (
          <span style={{ fontSize: "13px" }}>
            <span style={{ marginRight: 6 }}>👮</span>{st?.FirstName || "-"}
            {status === "ไม่ได้ทำงาน" && <Tag color={color} style={{ marginLeft: 6 }}>ไม่ได้ทำงาน</Tag>}
          </span>
        );
      },
    },
    {
      title: "จัดการ",
      key: "actions",
      width: 130,
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

  return (
    <div style={{ maxWidth: 1600, margin: "0 auto", padding: 20 }}>
      {notifyHolder /* ✅ ต้องมีเพื่อให้ toast โผล่มุมขวาล่าง */}

      <Title level={2}>
        <MedicineBoxOutlined /> บันทึกการตรวจ/รักษาผู้ต้องขัง
      </Title>

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={18}>
            <Input
              placeholder="ค้นหา รหัสนักโทษ, ชื่อ, แพทย์, ยา, อาการ, การวินิจฉัย"
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
          columns={columns as any}
          dataSource={filtered}
          loading={loading}
          rowKey="MedicalID"
          pagination={tablePagination}
          onChange={(pag: any) =>
            setTablePagination({
              current: pag.current || 1,
              pageSize: pag.pageSize || tablePagination.pageSize,
            })
          }
        />
      </Card>

      <Modal
        title={isView ? "ดูประวัติการตรวจรักษา" : (selected ? "แก้ไขประวัติการตรวจรักษา" : "เพิ่มการตรวจรักษา")}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setSelected(null); setIsEditing(false); }}
        footer={null}
        destroyOnClose
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="ผู้ต้องขัง" name="Prisoner_ID" rules={[{ required: isEditing, message: "กรุณาเลือกผู้ต้องขัง" }]}>
                <Select showSearch placeholder="เลือกผู้ต้องขัง" optionFilterProp="label" disabled={!isEditing}>
                  {prisoners.map((p) => (
                    <Select.Option
                      key={p.Prisoner_ID}
                      value={p.Prisoner_ID}
                      label={`${p.Inmate_ID} ${p.FirstName} ${p.LastName}`}
                    >
                      {p.FirstName} {p.LastName} (รหัสนักโทษ: {p.Inmate_ID})
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="แพทย์ผู้ตรวจ" name="Doctor" rules={[{ required: isEditing, message: "กรุณาระบุชื่อแพทย์" }]}>
                <Input placeholder="ระบุชื่อแพทย์ผู้ตรวจ" disabled={!isEditing} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item label="วันที่ตรวจ" name="Date_Inspection" rules={[{ required: isEditing, message: "กรุณาระบุวันที่ตรวจ" }]}>
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabled={!isEditing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="นัดครั้งถัดไป" name="Next_appointment">
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" disabled={!isEditing} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="อาการเบื้องต้น" name="Initial_symptoms" rules={[{ required: isEditing, message: "กรุณาระบุอาการ" }]}>
                <Input.TextArea rows={2} disabled={!isEditing} />
              </Form.Item>
            </Col>

            <Col span={24}>
              <Form.Item label="การวินิจฉัย" name="Diagnosis" rules={[{ required: isEditing, message: "กรุณาระบุการวินิจฉัย" }]}>
                <Input.TextArea rows={2} disabled={!isEditing} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="ยาที่จ่าย"
                name="Medicine"
                rules={[{ required: isEditing && !selected, message: "กรุณาเลือกยา" }]}
              >
                <Select
                  showSearch
                  placeholder="เลือกยา"
                  optionFilterProp="label"
                  disabled={!isEditing || !!selected}
                >
                  {parcels.map((p) => (
                    <Select.Option key={p.PID} value={p.PID} label={p.ParcelName}>
                      {p.ParcelName}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="จำนวนยาที่จ่าย"
                name="MedicineAmount"
                rules={[{ required: isEditing && !selected, message: "กรุณาระบุจำนวนยา" }]}
              >
                <InputNumber min={1} style={{ width: "100%" }} disabled={!isEditing || !!selected} />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="ผู้คุมที่ลงข้อมูล"
                name="StaffID"
                rules={[{ required: isEditing, message: "กรุณาเลือกผู้คุม" }]}
              >
                <Select
                  showSearch
                  placeholder="เลือกผู้คุม"
                  optionFilterProp="label"
                  disabled={!isEditing}
                  options={staffOptions} // ✅ ใช้ options ที่รวม currentStaff (ถ้าไม่ได้ทำงาน)
                />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            {selected && !isEditing ? (
              <Button onClick={() => setIsEditing(true)} icon={<EditOutlined />}>แก้ไข</Button>
            ) : (
              <span />
            )}

            <div style={{ marginLeft: "auto" }}>
              {selected && !isEditing ? (
                <Button type="primary" onClick={() => { setModalOpen(false); setSelected(null); form.resetFields(); }}>ปิด</Button>
              ) : (
                <>
                  <Button onClick={() => { setModalOpen(false); setSelected(null); setIsEditing(false); form.resetFields(); }} style={{ marginRight: 8 }}>
                    ยกเลิก
                  </Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    {selected ? "บันทึกการแก้ไข" : "เพิ่มการตรวจรักษา"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
