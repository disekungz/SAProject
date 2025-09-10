// BehaviorEvaluation.tsx

import { useState, useEffect } from "react";
import {
  Input, Button, Form, DatePicker, Typography, Row, Col,
  Table, Space, Modal, Popconfirm, Select, InputNumber, Dropdown,
  notification, // ✅ 1. Import notification
} from "antd";
import {
  SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined, MoreOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import localeData from "dayjs/plugin/localizedFormat";
import axios from "axios";

dayjs.extend(localeData);

const { Title, Text } = Typography;
const { Option } = Select;
const BASE = "http://localhost:8088/api";

// Mock function to resolve the import error
const getUser = () => {
  return { MID: 1, FirstName: "ระบบ", LastName: "แอดมิน" };
};


// ---------- Types ----------
export interface Prisoner {
  prisonerId: number;
  inmateId: string;
  firstName: string;
  lastName: string;
}

export interface BehaviorEvaluationRecord {
  id?: number;
  sId: number;
  mId: number;
  bId: number;
  evaluationDate: string | Dayjs;
  notes: string;
  scoreBehavior?: { sId: number; prisonerId: number; score: number; prisoner?: Prisoner };
  member?: { mId: number; firstName: string; lastName: string };
  behaviorCriterion?: { bId: number; criterion: string };
  key?: string;
  prisonerId?: string;
  inmateId?: string;
  prisonerName?: string;
  recordedBy?: string;
  behaviorScore?: number;
  behaviorDescription?: string;
}

// ---------- Mappers ----------
const mapPrisoner = (p: any): Prisoner => ({
  prisonerId: p.Prisoner_ID ?? p.prisonerId ?? p.id,
  inmateId: p.Inmate_ID ?? p.inmateId ?? "",
  firstName: p.FirstName ?? p.firstName ?? "",
  lastName: p.LastName ?? p.lastName ?? "",
});

const mapEvaluation = (d: any): BehaviorEvaluationRecord => {
  const sb = d.scoreBehavior ?? d.ScoreBehavior ?? {};
  const mem = d.member ?? d.Member ?? {};
  const bc = d.behaviorCriterion ?? d.BehaviorCriterion ?? {};
  const prisoner = sb.prisoner ?? sb.Prisoner ?? null;
  const prisonerIdRaw = sb.prisonerId ?? sb.Prisoner_ID ?? prisoner?.Prisoner_ID;
  const inmateIdRaw = prisoner?.Inmate_ID ?? "";
  const prisonerFullName = prisoner
    ? `${prisoner.FirstName ?? prisoner.firstName ?? ""} ${prisoner.LastName ?? prisoner.lastName ?? ""}`.trim()
    : "ไม่พบข้อมูล";
  const recordedBy = mem
    ? `${mem.FirstName ?? mem.firstName ?? ""} ${mem.LastName ?? mem.lastName ?? ""}`.trim()
    : "ไม่พบข้อมูล";
  const evalDate = d.evaluationDate ?? d.EvaluationDate ?? null;

  return {
    ...d,
    id: d.id ?? d.ID,
    key: (d.id ?? d.ID ?? "").toString(),
    evaluationDate: evalDate ? dayjs(evalDate) : null,
    prisonerId: prisonerIdRaw ? String(prisonerIdRaw) : "",
    inmateId: inmateIdRaw,
    prisonerName: prisonerFullName,
    recordedBy,
    behaviorScore: sb.score ?? sb.Score ?? 0,
    behaviorDescription: bc.criterion ?? bc.Criterion ?? "ไม่พบข้อมูล",
    sId: d.sId ?? d.SID,
    mId: d.mId ?? d.MID,
    bId: d.bId ?? d.BID,
    notes: d.notes ?? d.Notes ?? "",
  };
};

export default function BehaviorEvaluation() {
  const currentUser = getUser();
  const [form] = Form.useForm<BehaviorEvaluationRecord>();
  
  // ✅ 2. Use notification hook
  const [notify, contextHolder] = notification.useNotification();
  
  // ✅ 3. Create a toast helper
  const toast = {
    success: (msg: string, desc?: string) =>
      notify.success({ message: msg, description: desc, placement: "bottomRight" }),
    error: (msg: string, desc?: string) =>
      notify.error({ message: msg, description: desc, placement: "bottomRight" }),
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [prisoners, setPrisoners] = useState<Prisoner[]>([]);
  const [criteria, setCriteria] = useState<{ bId: number; criterion: string }[]>([]);
  const [members, setMembers] = useState<{ mId: number; firstName: string; lastName: string }[]>([]);
  const [data, setData] = useState<BehaviorEvaluationRecord[]>([]);
  const [filtered, setFiltered] = useState<BehaviorEvaluationRecord[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BehaviorEvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPrisonerScore, setCurrentPrisonerScore] = useState<number | null>(null);

  // ---------- API calls ----------
  const fetchEvaluations = async () => {
    try {
      const res = await axios.get(`${BASE}/evaluations`);
      const records: BehaviorEvaluationRecord[] = (res.data || []).map(mapEvaluation);
      setData(records);
      setFiltered(records);
    } catch {
      toast.error("โหลดข้อมูลการประเมินล้มเหลว");
    }
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [membersRes, prisonersRes, criteriaRes] = await Promise.all([
        axios.get(`${BASE}/members`),
        axios.get(`${BASE}/prisoners`),
        axios.get(`${BASE}/behaviorcriteria`),
      ]);
      setMembers((membersRes.data || []).map((m: any) => ({
        mId: m.MID ?? m.mId ?? m.id,
        firstName: m.FirstName ?? m.firstName ?? "",
        lastName: m.LastName ?? m.lastName ?? "",
      })));
      setPrisoners((prisonersRes.data || []).map(mapPrisoner));
      setCriteria((criteriaRes.data || []).map((c: any) => ({
        bId: c.BID ?? c.bId ?? c.id,
        criterion: c.Criterion ?? c.criterion ?? "",
      })));
      await fetchEvaluations();
    } catch {
      toast.error("เกิดข้อผิดพลาดในการโหลดข้อมูลเริ่มต้น");
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
      data.filter(
        (r) =>
          (r.inmateId ?? "").toLowerCase().includes(lower) ||
          (r.prisonerName ?? "").toLowerCase().includes(lower) ||
          (r.recordedBy ?? "").toLowerCase().includes(lower)
      )
    );
  }, [data, searchValue]);

  // ---------- Handlers ----------
  const openAdd = () => {
    form.resetFields();
    if (currentUser && typeof currentUser.MID === 'number') {
      form.setFieldsValue({ mId: currentUser.MID });
    }
    setEditing(null);
    setCurrentPrisonerScore(null);
    setModalOpen(true);
  };

  const openEdit = (record: BehaviorEvaluationRecord) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      evaluationDate: record.evaluationDate ? dayjs(record.evaluationDate) : undefined,
      mId: record.mId ?? record.member?.mId,
      prisonerId: record.prisonerId,
      bId: record.bId ?? record.behaviorCriterion?.bId,
      notes: record.notes,
    });
    setCurrentPrisonerScore(record.behaviorScore ?? null);
    setModalOpen(true);
  };

  const onFinish = async (values: any) => {
    const isCreating = !editing;
    const payload = {
      prisonerId: Number(values.prisonerId),
      bId: values.bId,
      mId: values.mId,
      evaluationDate: values.evaluationDate ? dayjs(values.evaluationDate).toISOString() : null,
      notes: values.notes ?? "",
    };
    try {
      setLoading(true);
      if (isCreating) {
        await axios.post(`${BASE}/evaluations`, payload);
        toast.success("เพิ่มการประเมินสำเร็จ", "ข้อมูลถูกบันทึกในระบบเรียบร้อยแล้ว");
      } else {
        await axios.put(`${BASE}/evaluations/${editing!.id}`, payload);
        toast.success("แก้ไขข้อมูลสำเร็จ", "ข้อมูลได้รับการปรับปรุงเรียบร้อยแล้ว");
      }
      setModalOpen(false);
      await fetchEvaluations();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || "เกิดข้อผิดพลาดในการบันทึกข้อมูล";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      setLoading(true);
      await axios.delete(`${BASE}/evaluations/${id}`);
      toast.success("ลบข้อมูลเรียบร้อย");
      await fetchEvaluations();
    } catch {
      toast.error("ลบข้อมูลล้มเหลว");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrisonerScore = async (pid: string | number) => {
    try {
      const res = await axios.get(`${BASE}/scorebehavior/prisoner/${pid}`);
      return res?.data?.score ?? res?.data?.Score ?? null;
    } catch {
      return null;
    }
  };

  const handlePrisonerChange = async (prisonerId: string) => {
    const prisoner = prisoners.find((p) => p.prisonerId.toString() === prisonerId);
    if (prisoner) {
      form.setFieldsValue({ prisonerName: `${prisoner.firstName} ${prisoner.lastName}` });
      const score = await fetchPrisonerScore(prisonerId);
      setCurrentPrisonerScore(typeof score === "number" ? score : null);
      if (score === null) {
        toast.error("ไม่สามารถโหลดคะแนนปัจจุบันของผู้ต้องขังได้");
      }
    }
  };

  // ---------- Columns ----------
  const columns = [
    { title: "ลำดับ", key: "index", render: (_: any, __: any, index: number) => index + 1, width: 80 },
    { title: "รหัสผู้ต้องขัง", dataIndex: "inmateId", width: 120 },
    { title: "ชื่อ-นามสกุล", dataIndex: "prisonerName", width: 180, render: (text: string) => <Text strong>{text}</Text> },
    {
      title: "วันที่ประเมิน",
      dataIndex: "evaluationDate",
      render: (d: Dayjs | null) => (d ? dayjs(d).format("DD/MM/YYYY") : "-"),
      width: 120,
    },
    { title: "คะแนนปัจจุบัน", dataIndex: "behaviorScore", width: 120 },
    { title: "ระดับพฤติกรรม", dataIndex: "behaviorDescription", width: 150 },
    { title: "หมายเหตุ", dataIndex: "notes" },
    { title: "ผู้ประเมิน", dataIndex: "recordedBy", width: 180 },
    {
      title: "จัดการ",
      key: "actions",
      width: 100,
      fixed: "right" as const,
      render: (_: any, record: BehaviorEvaluationRecord) => {
        const items = [
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
            onClick: () => setConfirmDeleteId(record.id ?? null),
          },
        ];
        return (
          <Popconfirm
            title="แน่ใจหรือไม่ว่าจะลบ?"
            open={confirmDeleteId === record.id}
            onConfirm={() => {
              handleDelete(record.id);
              setConfirmDeleteId(null);
            }}
            onCancel={() => setConfirmDeleteId(null)}
            okText="ลบ"
            cancelText="ยกเลิก"
            okButtonProps={{ loading: loading }}
          >
            <Dropdown menu={{ items }} trigger={["click"]}>
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Popconfirm>
        );
      },
    },
  ];

  // ---------- UI ----------
  return (
    <div style={{ padding: 24, background: "#fff", minHeight: "100vh" }}>
      {/* ✅ 4. Render the context holder */}
      {contextHolder}
      
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>บันทึกการประเมินพฤติกรรม</Title>
          <Text type="secondary">จัดการข้อมูลการประเมินพฤติกรรมผู้ต้องขัง</Text>
        </Col>
        <Col>
          <Space>
            <Input
              placeholder="ค้นหา รหัส, ชื่อ, ผู้ประเมิน"
              allowClear
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ width: 260 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
              เพิ่มการประเมิน
            </Button>
          </Space>
        </Col>
      </Row>

      <Table
        loading={loading}
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        bordered
        rowKey="key"
      />
      
      <Modal
        title={editing ? "แก้ไขการประเมิน" : "เพิ่มการประเมิน"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        width={900}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 12 }}>
          <Row gutter={24}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="รหัสผู้ต้องขัง"
                name="prisonerId"
                rules={[{ required: true, message: "กรุณาเลือกรหัสผู้ต้องขัง" }]}
              >
                <Select
                  placeholder="เลือกรหัส"
                  onChange={handlePrisonerChange}
                  showSearch
                  optionFilterProp="children"
                  disabled={!!editing}
                >
                  {prisoners.map((p) => (
                    <Option key={p.prisonerId} value={p.prisonerId.toString()}>
                      {p.inmateId} - {p.firstName} {p.lastName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="ชื่อผู้ต้องขัง" name="prisonerName">
                <Input disabled />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item label="คะแนนปัจจุบัน">
                <InputNumber value={currentPrisonerScore ?? undefined} style={{ width: "100%" }} disabled />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="วันที่ประเมิน"
                name="evaluationDate"
                rules={[{ required: true, message: "กรุณาเลือกวันที่" }]}
              >
                <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="เกณฑ์พฤติกรรม"
                name="bId"
                rules={[{ required: true, message: "กรุณาเลือกเกณฑ์" }]}
              >
                <Select placeholder="เลือกเกณฑ์" showSearch optionFilterProp="children">
                  {criteria.map((c) => (
                    <Option key={c.bId} value={c.bId}>{c.criterion}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                label="ผู้ประเมิน"
                name="mId"
                rules={[{ required: true, message: "กรุณาเลือกผู้ประเมิน" }]}
              >
                <Select
                  placeholder="เลือกผู้ประเมิน"
                  showSearch
                  optionFilterProp="children"
                  disabled={!editing}
                >
                  {members.map((m) => (
                    <Option key={m.mId} value={m.mId}>{m.firstName} {m.lastName}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col xs={24}>
              <Form.Item label="หมายเหตุ" name="notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>

            <Col span={24} style={{ textAlign: "right" }}>
              <Space>
                <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>ยกเลิก</Button>
                <Button type="primary" htmlType="submit" loading={loading}>
                  {editing ? "บันทึกการแก้ไข" : "เพิ่มการประเมิน"}
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
