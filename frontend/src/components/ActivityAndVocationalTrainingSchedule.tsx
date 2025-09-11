import { useState, useEffect, type FC } from "react";
import {
  Input, Button, Form, DatePicker, Typography, Row, Col,
  Table, Space, Modal, Popconfirm, Select, TimePicker, Tag, Dropdown,
  notification,
} from "antd";
import {
  SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined,
  EyeOutlined, MoreOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localizedFormat";
import axios from "axios";

dayjs.extend(localeData);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

const BASE = "http://localhost:8088/api";

// ---------- Types ----------
interface PrisonerRecord { Prisoner_ID: number; Inmate_ID: string; FirstName: string; LastName: string; }
interface StaffRecord { StaffID: number; FirstName: string; LastName: string; Status: string; }
interface ActivityMasterRecord { activity_ID: number; activityName: string; description: string; location: string; }
interface EnrollmentRecord { enrollment_ID: number; prisoner: PrisonerRecord; status: number; remarks: string; }
interface ActivityRecord { schedule_ID: number; activity: ActivityMasterRecord; staff: StaffRecord; startDate: Dayjs | null; endDate: Dayjs | null; startTime: string | null; endTime: string | null; max: number; enrollment: EnrollmentRecord[];}
interface ActivityScheduleFormValues { activityId: number; staffId: number; dateRange: [Dayjs, Dayjs]; timeRange: [Dayjs, Dayjs]; maxParticipants: number; }
interface ActivityMasterFormValues { activityName: string; location: string; description: string; }

// ---------- Mappers ----------
const mapPrisoner = (p: any): PrisonerRecord => ({ Prisoner_ID: p.Prisoner_ID ?? 0, Inmate_ID: p.Inmate_ID ?? "", FirstName: p.FirstName ?? "", LastName: p.LastName ?? "", });
const mapStaff = (s: any): StaffRecord => ({ StaffID: s.StaffID ?? 0, FirstName: s.FirstName ?? "", LastName: s.LastName ?? "", Status: s.Status ?? "", });
const mapActivityMaster = (a: any): ActivityMasterRecord => ({ activity_ID: a.activity_ID ?? 0, activityName: a.activityName ?? "", description: a.description ?? "", location: a.location ?? "", });
const mapEnrollment = (e: any): EnrollmentRecord => ({ enrollment_ID: e.enrollment_ID ?? 0, prisoner: e.prisoner ? mapPrisoner(e.prisoner) : {} as PrisonerRecord, status: e.status ?? 0, remarks: e.remarks ?? "", });

const mapSchedule = (s: any): ActivityRecord => {
  const act = s.activity ?? {};
  const stf = s.staff ?? {};
  const enroll = s.enrollment ?? [];
  return {
    schedule_ID: s.schedule_ID ?? 0,
    activity: mapActivityMaster(act),
    staff: mapStaff(stf),
    startDate: s.StartDate ? dayjs(s.StartDate) : null,
    endDate: s.EndDate ? dayjs(s.EndDate) : null,
    startTime: s.StartTime ?? null,
    endTime: s.EndTime ?? null,
    max: s.max ?? 0,
    enrollment: Array.isArray(enroll) ? enroll.map(mapEnrollment) : [],
  };
};

// ---------- Component ----------
const ActivityAndVocationalTrainingSchedule: FC = () => {
  const [scheduleForm] = Form.useForm<ActivityScheduleFormValues>();
  const [participantForm] = Form.useForm();
  const [withdrawalForm] = Form.useForm();
  const [activityForm] = Form.useForm<ActivityMasterFormValues>();

  const [notify, contextHolder] = notification.useNotification();
  const toast = {
    success: (msg: string, desc?: string) => notify.success({ message: msg, description: desc, placement: "bottomRight" }),
    error: (msg: string, desc?: string) => notify.error({ message: msg, description: desc, placement: "bottomRight" }),
    warning: (msg: string, desc?: string) => notify.warning({ message: msg, description: desc, placement: "bottomRight" }),
  };

  // Data states
  const [data, setData] = useState<ActivityRecord[]>([]);
  const [filtered, setFiltered] = useState<ActivityRecord[]>([]);
  const [prisoners, setPrisoners] = useState<PrisonerRecord[]>([]);
  const [staffs, setStaffs] = useState<StaffRecord[]>([]);
  const [activities, setActivities] = useState<ActivityMasterRecord[]>([]);
  
  // Modal & UI states
  const [searchValue, setSearchValue] = useState("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ActivityRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<ActivityRecord | null>(null);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [currentEnrollment, setCurrentEnrollment] = useState<EnrollmentRecord | null>(null);
  const [activityManagementModalOpen, setActivityManagementModalOpen] = useState(false);
  const [activityFormModalOpen, setActivityFormModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityMasterRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // ---------- API Calls ----------
  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${BASE}/schedules`);
      setData((res.data || []).map(mapSchedule));
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลตารางกิจกรรมได้");
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await axios.get(`${BASE}/activities`);
      setActivities((res.data || []).map(mapActivityMaster));
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลกิจกรรมหลักได้");
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSchedules(),
        fetchActivities(),
        axios.get(`${BASE}/prisoners`).then(res => setPrisoners((res.data || []).map(mapPrisoner))),
        axios.get(`${BASE}/staffs`).then(res => setStaffs((res.data || []).map(mapStaff))),
      ]);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลเริ่มต้นได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);
  
  useEffect(() => {
    if (!searchValue) {
      setFiltered(data);
      return;
    }
    const lower = searchValue.toLowerCase();
    setFiltered(
      data.filter((r) => {
        const activityName = r.activity?.activityName?.toLowerCase() ?? "";
        const staffName = `${r.staff?.FirstName ?? ""} ${r.staff?.LastName ?? ""}`.trim().toLowerCase();
        const location = r.activity?.location?.toLowerCase() ?? "";
        return activityName.includes(lower) || staffName.includes(lower) || location.includes(lower);
      })
    );
  }, [data, searchValue]);

  // ---------- Handlers for Schedule ----------
  const openAddSchedule = () => {
    scheduleForm.resetFields();
    setEditingSchedule(null);
    setScheduleModalOpen(true);
  };

  const openEditSchedule = (record: ActivityRecord) => {
    setEditingSchedule(record);
    scheduleForm.setFieldsValue({
      activityId: record.activity.activity_ID,
      staffId: record.staff.StaffID,
      maxParticipants: record.max,
      dateRange: [
        record.startDate ? dayjs(record.startDate) : dayjs(),
        record.endDate ? dayjs(record.endDate) : dayjs(),
      ],
      timeRange: [
        record.startTime ? dayjs(record.startTime, "HH:mm:ss") : dayjs("08:00", "HH:mm"),
        record.endTime ? dayjs(record.endTime, "HH:mm:ss") : dayjs("10:00", "HH:mm"),
      ],
    });
    setScheduleModalOpen(true);
  };

  const onFinishSchedule = async (values: ActivityScheduleFormValues) => {
    const payload = {
      activityId: values.activityId,
      staffId: values.staffId,
      maxParticipants: Number(values.maxParticipants),
      startDate: values.dateRange?.[0] ? values.dateRange[0].toISOString() : null,
      endDate: values.dateRange?.[1] ? values.dateRange[1].toISOString() : null,
      startTime: values.timeRange?.[0] ? values.timeRange[0].format("HH:mm:ss") : null,
      endTime: values.timeRange?.[1] ? values.timeRange[1].format("HH:mm:ss") : null,
    };
    try {
      setLoading(true);
      if (editingSchedule) {
        await axios.put(`${BASE}/schedules/${editingSchedule.schedule_ID}`, payload);
        toast.success("ปรับปรุงข้อมูลสำเร็จ", "ข้อมูลตารางเวลาได้รับการอัปเดตแล้ว");
      } else {
        await axios.post(`${BASE}/schedules`, payload);
        toast.success("เพิ่มตารางเวลาสำเร็จ", "ตารางเวลาใหม่ถูกเพิ่มในระบบเรียบร้อยแล้ว");
      }
      setScheduleModalOpen(false);
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    try {
      setLoading(true);
      await axios.delete(`${BASE}/schedules/${scheduleId}`);
      toast.success("ลบตารางเวลาสำเร็จ");
      await fetchSchedules();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "ไม่สามารถลบตารางเวลาได้");
    } finally {
      setLoading(false);
    }
  };

  // ---------- Handlers for Master Activity ----------
  const openActivityManagement = () => setActivityManagementModalOpen(true);
  const openAddActivityForm = () => { activityForm.resetFields(); setEditingActivity(null); setActivityFormModalOpen(true); };
  const openEditActivityForm = (record: ActivityMasterRecord) => { setEditingActivity(record); activityForm.setFieldsValue(record); setActivityFormModalOpen(true); };
  
  const handleFinishActivity = async (values: ActivityMasterFormValues) => {
    setLoading(true);
    try {
      if (editingActivity) {
        await axios.put(`${BASE}/activities/${editingActivity.activity_ID}`, values);
        toast.success("แก้ไขกิจกรรมสำเร็จ");
      } else {
        await axios.post(`${BASE}/activities`, values);
        toast.success("สร้างกิจกรรมใหม่สำเร็จ");
      }
      setActivityFormModalOpen(false);
      await fetchActivities();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteActivity = async (activityId: number) => {
    setLoading(true);
    try {
      await axios.delete(`${BASE}/activities/${activityId}`);
      toast.success("ลบกิจกรรมสำเร็จ");
      await fetchActivities();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "ไม่สามารถลบกิจกรรมได้");
    } finally {
      setLoading(false);
    }
  };
  
  // --- Handlers for Participants ---
  const openParticipantModal = (record: ActivityRecord) => { setCurrentSchedule(record); setParticipantModalOpen(true); };
  
  const handleAddParticipant = async (values: { prisonerId: number }) => {
    if (!currentSchedule) return;
    if ((currentSchedule.enrollment || []).some((e) => e.prisoner?.Prisoner_ID === values.prisonerId)) {
      toast.warning("ผู้ต้องขังคนนี้อยู่ในรายการแล้ว");
      return;
    }
    try {
    setLoading(true);
    await axios.post(`${BASE}/enrollments`, {
      scheduleId: currentSchedule.schedule_ID,
      prisonerId: values.prisonerId,
    });
    toast.success("เพิ่มผู้เข้าร่วมเรียบร้อย");
    participantForm.resetFields();

    // ✅ ขั้นตอนสำคัญ: ดึงข้อมูลทั้งหมดแล้วอัปเดต State ของ Modal ทันที
    const scheduleResponse = await axios.get(`${BASE}/schedules`);
    const allSchedules: ActivityRecord[] = (scheduleResponse.data || []).map(mapSchedule);
    setData(allSchedules); // อัปเดต State หลัก

    const updatedSchedule = allSchedules.find(s => s.schedule_ID === currentSchedule.schedule_ID);
    if (updatedSchedule) {
      setCurrentSchedule(updatedSchedule); // ✅ อัปเดต State ที่ Modal ใช้อยู่
    }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "ไม่สามารถเพิ่มผู้เข้าร่วมได้");
    } finally {
      setLoading(false);
    }
  };

  const openWithdrawal = (enrollment: EnrollmentRecord) => {
    setCurrentEnrollment(enrollment);
    withdrawalForm.resetFields();
    setWithdrawalModalOpen(true);
  };

  const handleConfirmWithdrawal = async (values: { remarks: string }) => {
  if (!currentSchedule || !currentEnrollment) return;
  try {
    setLoading(true);
    await axios.put(`${BASE}/enrollments/${currentEnrollment.enrollment_ID}/status`, {
      status: 0,
      remarks: values.remarks,
    });
    toast.success("บันทึกการสละสิทธิ์เรียบร้อย");
    setWithdrawalModalOpen(false);

    // ✅ ดึงข้อมูลใหม่ทั้งหมดแล้วอัปเดต State ทันที
    const scheduleResponse = await axios.get(`${BASE}/schedules`);
    const allSchedules: ActivityRecord[] = (scheduleResponse.data || []).map(mapSchedule);
    setData(allSchedules); // อัปเดต State หลัก

    const updatedSchedule = allSchedules.find(s => s.schedule_ID === currentSchedule.schedule_ID);
    if (updatedSchedule) {
      setCurrentSchedule(updatedSchedule); // ✅ อัปเดต State ที่ Modal ใช้อยู่
    }

  } catch (err: any) {
    const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกสถานะ";
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const handleSetToParticipated = async (enrollmentId: number) => {
  if (!currentSchedule) return;
  try {
    setLoading(true);
    await axios.put(`${BASE}/enrollments/${enrollmentId}/status`, {
      status: 1,
      remarks: "",
    });
    toast.success("เปลี่ยนสถานะเป็น 'เข้าร่วม' เรียบร้อย");

    // ✅ ดึงข้อมูลใหม่ทั้งหมดแล้วอัปเดต State ทันที
    const scheduleResponse = await axios.get(`${BASE}/schedules`);
    const allSchedules: ActivityRecord[] = (scheduleResponse.data || []).map(mapSchedule);
    setData(allSchedules); // อัปเดต State หลัก

    const updatedSchedule = allSchedules.find(s => s.schedule_ID === currentSchedule.schedule_ID);
    if (updatedSchedule) {
      setCurrentSchedule(updatedSchedule); // ✅ อัปเดต State ที่ Modal ใช้อยู่
    }

  } catch (err: any) {
    const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ";
    toast.error(errorMessage);
  } finally {
    setLoading(false);
  }
};

  // --- Table Column Definitions ---
  const scheduleActionMenuItems = (record: ActivityRecord): MenuProps["items"] => [
    { key: "edit", icon: <EditOutlined />, label: "แก้ไข", onClick: () => openEditSchedule(record) },
    { key: "delete", icon: <DeleteOutlined />, danger: true, label: "ลบ", onClick: () => setConfirmDeleteId(record.schedule_ID) },
  ];
  
  const scheduleColumns = [
    { title: "ลำดับ", render: (_: any, __: any, idx: number) => <Text>{idx + 1}</Text>, width: 60 },
    { title: "ชื่อกิจกรรม", dataIndex: ["activity", "activityName"], render: (text: string) => <Text strong>{text || "-"}</Text> },
    { title: "วันที่", dataIndex: "startDate", render: (_: any, r: ActivityRecord) => r.startDate && r.endDate ? `${dayjs(r.startDate).format("DD/MM/YY")} - ${dayjs(r.endDate).format("DD/MM/YY")}` : "-" },
    { title: "เวลา", dataIndex: "startTime", render: (_: any, r: ActivityRecord) => r.startTime && r.endTime ? `${dayjs(r.startTime, "HH:mm:ss").format("HH:mm")} - ${dayjs(r.endTime, "HH:mm:ss").format("HH:mm")}` : "-" },
    { title: "วิทยากร", dataIndex: ["staff", "FirstName"], render: (_: any, r: ActivityRecord) => `${r.staff?.FirstName || ""} ${r.staff?.LastName || ""}`.trim() || "-", },
    { title: "สถานที่", dataIndex: ["activity", "location"] },
    { title: "จำนวน", render: (_: any, r: ActivityRecord) => `${(r.enrollment || []).filter((e) => e.status === 1).length} / ${r.max}` },
    { title: "จัดการ", key: "actions", width: 150, align: 'center' as const, render: (_: any, record: ActivityRecord) => (
      <Space>
        <Button icon={<EyeOutlined />} onClick={() => openParticipantModal(record)}>ดูรายชื่อ</Button>
        <Popconfirm
          title="แน่ใจหรือไม่ว่าจะลบ?"
          open={confirmDeleteId === record.schedule_ID}
          onConfirm={() => { handleDeleteSchedule(record.schedule_ID); setConfirmDeleteId(null); }}
          onCancel={() => setConfirmDeleteId(null)}
          okText="ลบ"
          cancelText="ยกเลิก"
          okButtonProps={{ loading }}
        >
          <Dropdown menu={{ items: scheduleActionMenuItems(record) }} trigger={["click"]}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        </Popconfirm>
      </Space>
    )},
  ];

  const activityColumns = [
    { title: "ชื่อกิจกรรม", dataIndex: "activityName", key: "activityName", sorter: (a: ActivityMasterRecord, b: ActivityMasterRecord) => a.activityName.localeCompare(b.activityName) },
    { title: "สถานที่", dataIndex: "location", key: "location" },
    { title: "รายละเอียด", dataIndex: "description", key: "description", ellipsis: true },
    { title: "จัดการ", key: "actions", width: 200, align: 'center' as const, render: (_: any, record: ActivityMasterRecord) => (
      <Space>
        <Button icon={<EditOutlined />} onClick={() => openEditActivityForm(record)}>แก้ไข</Button>
        <Popconfirm
          title="แน่ใจว่าจะลบกิจกรรมนี้?"
          description="การลบจะทำได้เมื่อไม่มีตารางเวลาใช้งานอยู่"
          onConfirm={() => handleDeleteActivity(record.activity_ID)}
          okText="ลบ"
          cancelText="ยกเลิก"
          okButtonProps={{ loading }}
        >
          <Button danger icon={<DeleteOutlined />}>ลบ</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  const participantColumns = [
    { title: "ลำดับ", render: (_: any, __: any, idx: number) => idx + 1, width: 60 },
    { title: "รหัสผู้ต้องขัง", dataIndex: ["prisoner", "Inmate_ID"] },
    { title: "ชื่อ-นามสกุล", render: (_: any, r: EnrollmentRecord) => `${r.prisoner?.FirstName || ""} ${r.prisoner?.LastName || ""}`.trim() || "-", },
    { title: "สถานะ", dataIndex: "status", render: (status: number) => status === 1 ? <Tag color="success">เข้าร่วม</Tag> : <Tag color="error">สละสิทธิ์</Tag>, },
    { title: "หมายเหตุ", dataIndex: "remarks" },
    { title: "จัดการ", key: "actions", render: (_: any, record: EnrollmentRecord) => (
      record.status === 1 ?
        <Button size="small" danger onClick={() => openWithdrawal(record)}>สละสิทธิ์</Button> :
        <Button size="small" onClick={() => handleSetToParticipated(record.enrollment_ID)}>เข้าร่วม</Button>
    )},
  ];

  return (
    <div style={{ padding: "24px" }}>
      {contextHolder}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>ตารางกิจกรรมและฝึกวิชาชีพ</Title>
          <Text type="secondary">จัดการข้อมูลกิจกรรมและตารางเวลาทั้งหมดในระบบ</Text>
        </Col>
        <Col>
          <Space>
            <Input placeholder="ค้นหากิจกรรม, วิทยากร..." prefix={<SearchOutlined />} value={searchValue} onChange={e => setSearchValue(e.target.value)} style={{ width: 250 }} allowClear />
            <Button onClick={openActivityManagement}>จัดการกิจกรรม</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAddSchedule}>เพิ่มตารางเวลา</Button>
          </Space>
        </Col>
      </Row>

      <Table columns={scheduleColumns} dataSource={filtered} rowKey="schedule_ID" loading={loading} bordered />

      <Modal title={editingSchedule ? "แก้ไขตารางเวลา" : "เพิ่มตารางเวลาใหม่"} open={scheduleModalOpen} onCancel={() => setScheduleModalOpen(false)} footer={null} width={900} destroyOnClose>
        <Form form={scheduleForm} layout="vertical" onFinish={onFinishSchedule} style={{ marginTop: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12}><Form.Item label="ชื่อกิจกรรม" name="activityId" rules={[{ required: true, message: "กรุณาเลือกกิจกรรม" }]}><Select showSearch placeholder="เลือกกิจกรรม" optionFilterProp="children">{activities.map((act) => (<Option key={act.activity_ID} value={act.activity_ID}>{`${act.activityName} (${act.location})`}</Option>))}</Select></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="วิทยากร/ครูฝึก" name="staffId" rules={[{ required: true }]}><Select showSearch placeholder="เลือกวิทยากร" optionFilterProp="children">{staffs.filter(s => s.Status === "ทำงานอยู่").map((s) => (<Option key={s.StaffID} value={s.StaffID}>{s.FirstName} {s.LastName}</Option>))}</Select></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="ช่วงวันที่" name="dateRange" rules={[{ required: true }]}><RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="ช่วงเวลา" name="timeRange" rules={[{ required: true }]}><TimePicker.RangePicker style={{ width: "100%" }} format="HH:mm" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="จำนวนผู้เข้าร่วมสูงสุด" name="maxParticipants" rules={[{ required: true }]}><Input type="number" min={1} /></Form.Item></Col>
            <Col span={24} style={{ textAlign: "right", marginTop: 16 }}><Space><Button onClick={() => setScheduleModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit" loading={loading}>{editingSchedule ? "บันทึก" : "เพิ่ม"}</Button></Space></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="จัดการกิจกรรมหลัก" open={activityManagementModalOpen} onCancel={() => setActivityManagementModalOpen(false)} footer={<Button onClick={() => setActivityManagementModalOpen(false)}>ปิด</Button>} width={1000}>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16, marginTop: 24 }} onClick={openAddActivityForm}>สร้างกิจกรรมใหม่</Button>
        <Table loading={loading} columns={activityColumns} dataSource={activities} rowKey="activity_ID" bordered />
      </Modal>

      <Modal title={editingActivity ? "แก้ไขกิจกรรม" : "สร้างกิจกรรมใหม่"} open={activityFormModalOpen} onCancel={() => setActivityFormModalOpen(false)} footer={null} destroyOnClose>
        <Form form={activityForm} layout="vertical" onFinish={handleFinishActivity} style={{ marginTop: 24 }}>
          <Form.Item label="ชื่อกิจกรรม" name="activityName" rules={[{ required: true }]}><Input placeholder="เช่น ฝึกทำอาหาร, สอนคอมพิวเตอร์"/></Form.Item>
          <Form.Item label="สถานที่" name="location" rules={[{ required: true }]}><Input placeholder="เช่น อาคาร 3, ห้องสมุด"/></Form.Item>
          <Form.Item label="รายละเอียด (ถ้ามี)" name="description"><TextArea rows={4} /></Form.Item>
          <Form.Item style={{ textAlign: 'right' }}><Space><Button onClick={() => setActivityFormModalOpen(false)}>ยกเลิก</Button><Button type="primary" htmlType="submit" loading={loading}>{editingActivity ? 'บันทึก' : 'สร้าง'}</Button></Space></Form.Item>
        </Form>
      </Modal>
      
      <Modal title={`รายชื่อผู้เข้าร่วม: ${currentSchedule?.activity?.activityName || "..."}`} open={participantModalOpen} onCancel={() => setParticipantModalOpen(false)} footer={null} width={800} destroyOnClose>
        <Form form={participantForm} layout="inline" onFinish={handleAddParticipant} style={{ marginBottom: 20, marginTop: 24 }}>
          <Form.Item name="prisonerId" rules={[{ required: true, message: "กรุณาเลือกผู้ต้องขัง" }]} style={{ flex: 1 }} >
            <Select showSearch placeholder="ค้นหาและเลือกผู้ต้องขัง (พิมพ์รหัส หรือ ชื่อ)" optionFilterProp="children" >
              {prisoners.map((p) => (
                <Option key={p.Prisoner_ID} value={p.Prisoner_ID}>
                  {p.Inmate_ID} - {p.FirstName} {p.LastName}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={loading}>
              เพิ่ม
            </Button>
          </Form.Item>
        </Form>
        <Table columns={participantColumns} dataSource={currentSchedule?.enrollment} pagination={{ pageSize: 5 }} bordered rowKey="enrollment_ID" locale={{ emptyText: "ยังไม่มีผู้เข้าร่วม" }} />
      </Modal>
      
      <Modal title="ยืนยันการสละสิทธิ์" open={withdrawalModalOpen} onCancel={() => setWithdrawalModalOpen(false)} footer={null} destroyOnClose>
        <Form form={withdrawalForm} onFinish={handleConfirmWithdrawal} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item label="เหตุผลในการสละสิทธิ์" name="remarks" rules={[{ required: true, message: "กรุณากรอกเหตุผล" }]}>
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setWithdrawalModalOpen(false)}>ยกเลิก</Button>
              <Button type="primary" danger htmlType="submit" loading={loading}>ยืนยัน</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActivityAndVocationalTrainingSchedule;
