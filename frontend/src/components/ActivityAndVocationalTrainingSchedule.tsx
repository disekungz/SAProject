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
interface PrisonerRecord {
  Prisoner_ID: number;
  Inmate_ID: string;
  FirstName: string;
  LastName: string;
}

interface StaffRecord {
  StaffID: number;
  FirstName: string;
  LastName: string;
  Status: string;
}

interface EnrollmentRecord {
  enrollment_ID: number;
  prisoner: PrisonerRecord;
  status: number;
  remarks: string;
}

interface ActivityRecord {
  schedule_ID: number;
  activity: {
    activity_ID: number;
    activityName: string;
    location: string;
    description: string;
  };
  staff: StaffRecord;
  startDate: Dayjs | null;
  endDate: Dayjs | null;
  startTime: string | null;
  endTime: string | null;
  max: number;
  enrollment: EnrollmentRecord[];
}

interface ActivityFormValues {
  activityName: string;
  description: string;
  staffId: number;
  dateRange: [Dayjs, Dayjs];
  timeRange: [Dayjs, Dayjs];
  room: string;
  maxParticipants: number;
}

// ---------- Mappers ----------
const mapPrisoner = (p: any): PrisonerRecord => ({
  Prisoner_ID: p.Prisoner_ID ?? p.prisonerId ?? p.id,
  Inmate_ID: p.Inmate_ID ?? p.inmateId ?? "",
  FirstName: p.FirstName ?? p.firstName ?? "",
  LastName: p.LastName ?? p.lastName ?? "",
});

const mapStaff = (s: any): StaffRecord => ({
  StaffID: s.StaffID ?? s.staffId ?? s.id,
  FirstName: s.FirstName ?? s.firstName ?? "",
  LastName: s.LastName ?? s.lastName ?? "",
  Status: s.Status ?? s.status ?? "",
});

const mapEnrollment = (e: any): EnrollmentRecord => ({
  enrollment_ID: e.enrollment_ID ?? e.enrollmentId ?? e.ID ?? e.id,
  prisoner: e.prisoner ? mapPrisoner(e.prisoner ?? e.Prisoner) : ({} as PrisonerRecord),
  status: e.status ?? e.Status ?? 0,
  remarks: e.remarks ?? e.Remarks ?? "",
});

const mapSchedule = (s: any): ActivityRecord => {
  const act = s.activity ?? s.Activity ?? {};
  const stf = s.staff ?? s.Staff ?? {};
  const enroll = s.enrollment ?? s.Enrollment ?? [];
  const startDate = s.startDate ?? s.StartDate ?? null;
  const endDate = s.endDate ?? s.EndDate ?? null;

  return {
    schedule_ID: s.schedule_ID ?? s.scheduleId ?? s.ID ?? s.id,
    activity: {
      activity_ID: act.activity_ID ?? act.activityId ?? act.ID ?? act.id ?? 0,
      activityName: act.activityName ?? act.ActivityName ?? "",
      location: act.location ?? act.Location ?? "",
      description: act.description ?? act.Description ?? "",
    },
    staff: mapStaff(stf),
    startDate: startDate ? dayjs(startDate) : null,
    endDate: endDate ? dayjs(endDate) : null,
    startTime: s.startTime ?? s.StartTime ?? null,
    endTime: s.endTime ?? s.EndTime ?? null,
    max: s.max ?? s.Max ?? s.maxParticipants ?? 0,
    enrollment: Array.isArray(enroll) ? enroll.map(mapEnrollment) : [],
  };
};

// ---------- Component ----------
const ActivityAndVocationalTrainingSchedule: FC = () => {
  const [form] = Form.useForm<ActivityFormValues>();
  const [participantForm] = Form.useForm();
  const [withdrawalForm] = Form.useForm();
  
  const [notify, contextHolder] = notification.useNotification();
  
  const toast = {
    success: (msg: string, desc?: string) =>
      notify.success({ message: msg, description: desc, placement: "bottomRight" }),
    error: (msg: string, desc?: string) =>
      notify.error({ message: msg, description: desc, placement: "bottomRight" }),
    warning: (msg: string, desc?: string) =>
      notify.warning({ message: msg, description: desc, placement: "bottomRight" }),
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [data, setData] = useState<ActivityRecord[]>([]);
  const [filtered, setFiltered] = useState<ActivityRecord[]>([]);
  const [prisoners, setPrisoners] = useState<PrisonerRecord[]>([]);
  const [staffs, setStaffs] = useState<StaffRecord[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRecord | null>(null);
  const [participantModalOpen, setParticipantModalOpen] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<ActivityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [currentEnrollment, setCurrentEnrollment] = useState<EnrollmentRecord | null>(null);

  // ---------- API ----------
  const fetchSchedules = async () => {
    try {
      const res = await axios.get(`${BASE}/schedules`);
      const records: ActivityRecord[] = (res.data || []).map(mapSchedule);
      setData(records);
      setFiltered(records);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลตารางกิจกรรมได้");
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [schedulesRes, prisonersRes, staffsRes] = await Promise.all([
        axios.get(`${BASE}/schedules`),
        axios.get(`${BASE}/prisoners`),
        axios.get(`${BASE}/staffs`),
      ]);
      const schedules = (schedulesRes.data || []).map(mapSchedule);
      setData(schedules);
      setFiltered(schedules);
      setPrisoners((prisonersRes.data || []).map(mapPrisoner));
      setStaffs((staffsRes.data || []).map(mapStaff));
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
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
        const staffName = `${r.staff?.FirstName ?? ""} ${r.staff?.LastName ?? ""}`
          .trim()
          .toLowerCase();
        const location = r.activity?.location?.toLowerCase() ?? "";
        return (
          activityName.includes(lower) ||
          staffName.includes(lower) ||
          location.includes(lower)
        );
      })
    );
  }, [data, searchValue]);

  // ---------- Handlers ----------
  const openAdd = () => {
    form.resetFields();
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (record: ActivityRecord) => {
    setEditing(record);
    form.setFieldsValue({
      activityName: record.activity.activityName,
      description: record.activity.description,
      staffId: record.staff.StaffID,
      room: record.activity.location,
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
    setModalOpen(true);
  };

  const onFinish = async (values: ActivityFormValues) => {
    const payload = {
      activityName: values.activityName,
      description: values.description,
      room: values.room,
      staffId: values.staffId,
      maxParticipants: Number(values.maxParticipants),
      startDate: values.dateRange?.[0] ? values.dateRange[0].toISOString() : null,
      endDate: values.dateRange?.[1] ? values.dateRange[1].toISOString() : null,
      startTime: values.timeRange?.[0] ? values.timeRange[0].format("HH:mm:ss") : null,
      endTime: values.timeRange?.[1] ? values.timeRange[1].format("HH:mm:ss") : null,
    };
    try {
      setLoading(true);
      if (editing) {
        await axios.put(`${BASE}/schedules/${editing.schedule_ID}`, payload);
        toast.success("ปรับปรุงข้อมูลสำเร็จ", "ข้อมูลกิจกรรมได้รับการอัปเดตแล้ว");
      } else {
        await axios.post(`${BASE}/schedules`, payload);
        toast.success("เพิ่มกิจกรรมสำเร็จ", "กิจกรรมใหม่ถูกเพิ่มในระบบเรียบร้อยแล้ว");
      }
      setModalOpen(false);
      await fetchSchedules();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (scheduleId: number) => {
    try {
      setLoading(true);
      await axios.delete(`${BASE}/schedules/${scheduleId}`);
      toast.success("ลบข้อมูลสำเร็จ");
      await fetchSchedules();
    } catch {
      toast.error("ไม่สามารถลบข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const openParticipantModal = (record: ActivityRecord) => {
    setCurrentActivity(record);
    setParticipantModalOpen(true);
  };

  const refreshDataAndUpdateCurrentActivity = async (currentScheduleId: number) => {
    try {
      const res = await axios.get(`${BASE}/schedules`);
      const schedules: ActivityRecord[] = (res.data || []).map(mapSchedule);
      setData(schedules);
      const updated = schedules.find((s) => s.schedule_ID === currentScheduleId);
      if (updated) setCurrentActivity(updated);
      else setParticipantModalOpen(false);
    } catch {
      toast.error("ไม่สามารถรีเฟรชข้อมูลกิจกรรมได้");
    }
  };

  const handleAddParticipant = async (values: { prisonerId: number }) => {
    if (!currentActivity) return;
    const currentCount = (currentActivity.enrollment || []).filter((e) => e.status === 1).length;
    if (currentCount >= currentActivity.max) {
      toast.warning("กิจกรรมนี้มีผู้เข้าร่วมเต็มแล้ว");
      return;
    }
    if ((currentActivity.enrollment || []).some((e) => e.prisoner?.Prisoner_ID === values.prisonerId)) {
      toast.warning("ผู้ต้องขังคนนี้อยู่ในรายการแล้ว");
      return;
    }
    try {
      setLoading(true);
      await axios.post(`${BASE}/enrollments`, {
        scheduleId: currentActivity.schedule_ID,
        prisonerId: values.prisonerId,
      });
      toast.success("เพิ่มผู้เข้าร่วมเรียบร้อย");
      participantForm.resetFields();
      await refreshDataAndUpdateCurrentActivity(currentActivity.schedule_ID);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || "ไม่สามารถเพิ่มผู้เข้าร่วมได้";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openWithdrawalModal = (enrollment: EnrollmentRecord) => {
    setCurrentEnrollment(enrollment);
    withdrawalForm.resetFields();
    setWithdrawalModalOpen(true);
  };

  const handleConfirmWithdrawal = async (values: { remarks: string }) => {
    if (!currentActivity || !currentEnrollment) return;
    try {
      setLoading(true);
      await axios.put(`${BASE}/enrollments/${currentEnrollment.enrollment_ID}/status`, {
        status: 0,
        remarks: values.remarks,
      });
      toast.success("บันทึกการสละสิทธิ์เรียบร้อย");
      setWithdrawalModalOpen(false);
      await refreshDataAndUpdateCurrentActivity(currentActivity.schedule_ID);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกสถานะ";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSetToParticipated = async (enrollmentId: number) => {
    if (!currentActivity) return;
    try {
      setLoading(true);
      await axios.put(`${BASE}/enrollments/${enrollmentId}/status`, {
        status: 1,
        remarks: "",
      });
      toast.success("เปลี่ยนสถานะเป็น 'เข้าร่วม' เรียบร้อย");
      await refreshDataAndUpdateCurrentActivity(currentActivity.schedule_ID);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const actionMenuItems = (record: ActivityRecord): MenuProps["items"] => [
    {
      key: "edit",
      icon: <EditOutlined />,
      label: "แก้ไข",
      onClick: () => openEdit(record),
    },
    {
      key: "delete",
      icon: <DeleteOutlined />,
      danger: true,
      label: "ลบ",
      onClick: () => setConfirmDeleteId(record.schedule_ID),
    },
  ];

  // ✅ [SCROLLBAR FIX] Removed fixed widths and `fixed` property to make table responsive
  const columns = [
    { title: "ลำดับ", render: (_: any, __: any, idx: number) => <Text>{idx + 1}</Text>, width: 70 },
    { title: "ชื่อกิจกรรม", dataIndex: ["activity", "activityName"], render: (text: string) => <Text strong>{text || "-"}</Text> },
    { title: "วันที่", dataIndex: "startDate", render: (_: any, r: ActivityRecord) => r.startDate && r.endDate ? `${dayjs(r.startDate).format("DD/MM/YY")} - ${dayjs(r.endDate).format("DD/MM/YY")}` : "-" },
    { title: "เวลา", dataIndex: "startTime", render: (_: any, r: ActivityRecord) => r.startTime && r.endTime ? `${dayjs(r.startTime, "HH:mm:ss").format("HH:mm")} - ${dayjs(r.endTime, "HH:mm:ss").format("HH:mm")}` : "-" },
    {
      title: "วิทยากร",
      dataIndex: ["staff", "FirstName"],
      render: (_: any, r: ActivityRecord) => `${r.staff?.FirstName || ""} ${r.staff?.LastName || ""}`.trim() || "-",
    },
    { title: "สถานที่", dataIndex: ["activity", "location"] },
    { title: "จำนวน", render: (_: any, r: ActivityRecord) => `${(r.enrollment || []).filter((e) => e.status === 1).length} / ${r.max}` },
    {
      title: "จัดการ",
      key: "actions",
      width: 150, // Keep width for action buttons for consistency
      render: (_: any, record: ActivityRecord) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => openParticipantModal(record)}>
            ดูรายชื่อ
          </Button>
          <Popconfirm
            title="แน่ใจหรือไม่ว่าจะลบ?"
            open={confirmDeleteId === record.schedule_ID}
            onConfirm={() => {
              handleDelete(record.schedule_ID);
              setConfirmDeleteId(null);
            }}
            onCancel={() => setConfirmDeleteId(null)}
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ loading: loading }}
          >
            <Dropdown menu={{ items: actionMenuItems(record) }} trigger={["click"]}>
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const participantColumns = [
    { title: "ลำดับ", render: (_: any, __: any, idx: number) => idx + 1, width: 70 },
    { title: "รหัสผู้ต้องขัง", dataIndex: ["prisoner", "Inmate_ID"] },
    {
      title: "ชื่อ-นามสกุล",
      render: (_: any, r: EnrollmentRecord) =>
        `${r.prisoner?.FirstName || ""} ${r.prisoner?.LastName || ""}`.trim() || "-",
    },
    {
      title: "สถานะ",
      dataIndex: "status",
      render: (status: number) =>
        status === 1 ? <Tag color="success">เข้าร่วม</Tag> : <Tag color="error">สละสิทธิ์</Tag>,
    },
    { title: "หมายเหตุ", dataIndex: "remarks" },
    {
      title: "จัดการ",
      key: "actions",
      render: (_: any, record: EnrollmentRecord) =>
        record.status === 1 ? (
          <Button size="small" danger onClick={() => openWithdrawalModal(record)}>
            สละสิทธิ์
          </Button>
        ) : (
          <Button size="small" onClick={() => handleSetToParticipated(record.enrollment_ID)}>
            เข้าร่วม
          </Button>
        ),
    },
  ];

  // ---------- UI ----------
  return (
    // ✅ [SCROLLBAR FIX] Removed minHeight and background from here. 
    // This should be handled by a parent Layout component.
    <div style={{ padding: "24px" }}>
      {contextHolder}

      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>ตารางกิจกรรมและฝึกวิชาชีพ</Title>
          <Text type="secondary">จัดการข้อมูลกิจกรรมทั้งหมดในระบบ</Text>
        </Col>
        <Col>
          <Space>
            <Input placeholder="ค้นหากิจกรรม, วิทยากร..." prefix={<SearchOutlined />} value={searchValue} onChange={(e) => setSearchValue(e.target.value)} style={{ width: 250 }} allowClear />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>เพิ่มกิจกรรม</Button>
          </Space>
        </Col>
      </Row>

      <Table
        loading={loading}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        rowKey="schedule_ID"
        style={{ background: "#fff", borderRadius: 8, padding: 8 }}
        bordered
      />

      <Modal title={editing ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรมใหม่"} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={900} destroyOnClose >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12}><Form.Item label="ชื่อกิจกรรม" name="activityName" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} sm={12}>
              <Form.Item label="วิทยากร/ครูฝึก" name="staffId" rules={[{ required: true }]}>
                <Select showSearch placeholder="เลือกวิทยากร" optionFilterProp="children">
                  {staffs
                    .filter(s => s.Status === "ทำงานอยู่")
                    .map((s) => (
                      <Option key={s.StaffID} value={s.StaffID}>
                        {s.FirstName} {s.LastName}
                      </Option>
                    ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}><Form.Item label="ช่วงวันที่" name="dateRange" rules={[{ required: true }]}><RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="ช่วงเวลา" name="timeRange" rules={[{ required: true }]}><TimePicker.RangePicker style={{ width: "100%" }} format="HH:mm" /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="ห้อง/สถานที่" name="room" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} sm={12}><Form.Item label="จำนวนผู้เข้าร่วมสูงสุด" name="maxParticipants" rules={[{ required: true }]}><Input type="number" min={1} /></Form.Item></Col>
            <Col xs={24}><Form.Item label="รายละเอียดกิจกรรม" name="description"><TextArea rows={3} /></Form.Item></Col>
            <Col span={24} style={{ textAlign: "right" }}>
              <Space>
                <Button onClick={() => setModalOpen(false)}>ยกเลิก</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editing ? "บันทึก" : "เพิ่ม"}
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Modal title={`รายชื่อผู้เข้าร่วม: ${currentActivity?.activity?.activityName || "..."}`} open={participantModalOpen} onCancel={() => setParticipantModalOpen(false)} footer={null} width={800} destroyOnClose >
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
        <Table columns={participantColumns} dataSource={currentActivity?.enrollment} pagination={false} bordered rowKey="enrollment_ID" locale={{ emptyText: "ยังไม่มีผู้เข้าร่วม" }} />
      </Modal>

      <Modal title="ยืนยันการสละสิทธิ์" open={withdrawalModalOpen} onCancel={() => setWithdrawalModalOpen(false)} footer={null} destroyOnClose >
        <Form form={withdrawalForm} onFinish={handleConfirmWithdrawal} layout="vertical" style={{ marginTop: 24 }}>
          <Form.Item label="เหตุผลในการสละสิทธิ์" name="remarks" rules={[{ required: true, message: "กรุณากรอกเหตุผล" }]} >
            <TextArea rows={4} />
          </Form.Item>
          <Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setWithdrawalModalOpen(false)}>ยกเลิก</Button>
              <Button type="primary" danger htmlType="submit" loading={loading}>
                ยืนยัน
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ActivityAndVocationalTrainingSchedule;
